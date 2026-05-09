# 01 — Data Model

## Supabase Schema

Run these migrations in order. All tables use UUID primary keys and `created_at` / `updated_at` timestamps by default.

---

### `weddings`

```sql
create table weddings (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,              -- e.g. "Sarah & James"
  date         date,
  location     text,
  cover_image  text,                       -- Supabase Storage path
  join_mode    text not null default 'invite'
                check (join_mode in ('open', 'password', 'invite')),
  join_password text,                      -- bcrypt hash, null unless join_mode = 'password'
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
```

---

### `wedding_members`

Maps authenticated users to weddings. Roles: `owner`, `reviewer`, `guest`.

```sql
create table wedding_members (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references weddings(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'guest'
                check (role in ('owner', 'reviewer', 'guest')),
  joined_at   timestamptz default now(),
  unique (wedding_id, user_id)
);
```

---

### `speeches`

```sql
create table speeches (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references weddings(id) on delete cascade,
  slug            text not null,
  title           text not null,
  speaker_name    text not null,
  delivered_at    date,
  hero_image      text,                    -- Supabase Storage path
  status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected')),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (wedding_id, slug)
);
```

---

### `speech_stanzas`

The transcript is broken into discrete stanzas/paragraphs at upload time. Ordering is explicit so reordering is possible later.

```sql
create table speech_stanzas (
  id          uuid primary key default gen_random_uuid(),
  speech_id   uuid not null references speeches(id) on delete cascade,
  position    int not null,               -- 1-indexed display order
  body        text not null,
  created_at  timestamptz default now(),
  unique (speech_id, position)
);
```

> **Character offsets** for annotations are computed against the full concatenated transcript text (`stanzas ordered by position, joined by \n\n`). The `range-utils.ts` library handles this mapping.

---

### `annotations`

One annotation per text range. First user to claim a range owns it. Overlapping ranges are blocked at the application layer.

```sql
create table annotations (
  id              uuid primary key default gen_random_uuid(),
  speech_id       uuid not null references speeches(id) on delete cascade,
  author_id       uuid not null references auth.users(id),
  char_start      int not null,
  char_end        int not null,
  selected_text   text not null,          -- snapshot of the highlighted string
  body            text,                   -- Tiptap JSON (rich text)
  media_url       text,                   -- Supabase Storage path (optional)
  upvotes         int not null default 0,
  status          text not null default 'live'
                    check (status in ('live', 'removed')),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  constraint no_zero_range check (char_end > char_start)
);

-- Prevent overlapping ranges on the same speech
create or replace function check_annotation_overlap()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from annotations
    where speech_id = new.speech_id
      and status = 'live'
      and id != coalesce(new.id, '00000000-0000-0000-0000-000000000000')
      and char_start < new.char_end
      and char_end   > new.char_start
  ) then
    raise exception 'annotation_overlap';
  end if;
  return new;
end;
$$;

create trigger annotation_overlap_check
before insert or update on annotations
for each row execute function check_annotation_overlap();
```

---

### `annotation_votes`

Tracks which user voted on which annotation (one vote per user per annotation).

```sql
create table annotation_votes (
  id            uuid primary key default gen_random_uuid(),
  annotation_id uuid not null references annotations(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  value         int not null check (value in (1, -1)),
  created_at    timestamptz default now(),
  unique (annotation_id, user_id)
);
```

> Maintain `annotations.upvotes` via a Postgres trigger or Edge Function that sums `annotation_votes.value` on insert/update/delete.

---

### `annotation_comments`

```sql
create table annotation_comments (
  id            uuid primary key default gen_random_uuid(),
  annotation_id uuid not null references annotations(id) on delete cascade,
  author_id     uuid not null references auth.users(id),
  body          text not null,            -- plain text, max 1000 chars
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
```

---

## Row Level Security (RLS)

Enable RLS on all tables. Below are the policies. `is_wedding_member(wedding_id)` and `is_wedding_role(wedding_id, role)` are helper functions defined once and reused.

```sql
-- Helper: check membership
create or replace function is_wedding_member(wid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from wedding_members
    where wedding_id = wid and user_id = auth.uid()
  );
$$;

-- Helper: check role
create or replace function is_wedding_role(wid uuid, r text)
returns boolean language sql security definer as $$
  select exists (
    select 1 from wedding_members
    where wedding_id = wid and user_id = auth.uid() and role = r
  );
$$;
```

### `weddings` policies

```sql
alter table weddings enable row level security;

-- Anyone can read open weddings; members can read all
create policy "weddings_select" on weddings for select using (
  join_mode = 'open' or is_wedding_member(id)
);

-- Only owners can update
create policy "weddings_update" on weddings for update using (
  is_wedding_role(id, 'owner')
);
```

### `speeches` policies

```sql
alter table speeches enable row level security;

-- Members of the wedding can read approved speeches
create policy "speeches_select" on speeches for select using (
  is_wedding_member(wedding_id) and status = 'approved'
);

-- Owners and reviewers can read pending/rejected too
create policy "speeches_select_admin" on speeches for select using (
  is_wedding_role(wedding_id, 'owner') or is_wedding_role(wedding_id, 'reviewer')
);

-- Owners and reviewers can update (approve/reject)
create policy "speeches_update" on speeches for update using (
  is_wedding_role(wedding_id, 'owner') or is_wedding_role(wedding_id, 'reviewer')
);
```

### `annotations` policies

```sql
alter table annotations enable row level security;

-- Members can read live annotations
create policy "annotations_select" on annotations for select using (
  exists (
    select 1 from speeches s
    where s.id = speech_id and is_wedding_member(s.wedding_id)
  ) and status = 'live'
);

-- Members can insert (overlap check handled by trigger)
create policy "annotations_insert" on annotations for insert with check (
  exists (
    select 1 from speeches s
    where s.id = speech_id and is_wedding_member(s.wedding_id)
  ) and author_id = auth.uid()
);

-- Author, owner, or reviewer can update/remove
create policy "annotations_update" on annotations for update using (
  author_id = auth.uid() or
  exists (
    select 1 from speeches s
    where s.id = speech_id and (
      is_wedding_role(s.wedding_id, 'owner') or
      is_wedding_role(s.wedding_id, 'reviewer')
    )
  )
);
```

### `annotation_comments` policies

```sql
alter table annotation_comments enable row level security;

-- Members can read comments on speeches they can access
create policy "comments_select" on annotation_comments for select using (
  exists (
    select 1 from annotations a
    join speeches s on s.id = a.speech_id
    where a.id = annotation_id and is_wedding_member(s.wedding_id)
  )
);

-- Members can insert their own comments
create policy "comments_insert" on annotation_comments for insert with check (
  author_id = auth.uid() and
  exists (
    select 1 from annotations a
    join speeches s on s.id = a.speech_id
    where a.id = annotation_id and is_wedding_member(s.wedding_id)
  )
);

-- Authors can edit their own comments
create policy "comments_update" on annotation_comments for update using (
  author_id = auth.uid()
);
```

---

## Supabase Storage Buckets

| Bucket | Purpose | Access |
|---|---|---|
| `speech-heroes` | Speech banner images | Authenticated read |
| `annotation-media` | Photos/images attached to annotations | Authenticated read |
| `wedding-covers` | Wedding page cover images | Authenticated read |

All buckets are private. Signed URLs are generated server-side for display.
