# 01 — Data Model

## Supabase Schema

Run these migrations in order. All tables use UUID primary keys and `created_at` / `updated_at` timestamps by default.

---

### `profiles`

Created automatically for every new auth user via trigger. Stores the optional display name shown on annotations and comments.

```sql
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Auto-create a profile row on user signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

---

### `weddings`

```sql
create table weddings (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,              -- e.g. "Sarah & James"
  date          date,
  location      text,
  cover_image   text,                       -- Supabase Storage path
  join_mode     text not null default 'invite'
                  check (join_mode in ('open', 'password', 'invite')),
  join_password text,                       -- bcrypt hash, null unless join_mode = 'password'
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
```

---

### `wedding_members`

Maps authenticated users to weddings. Roles: `owner`, `admin`, `reviewer`, `guest`.

```sql
create table wedding_members (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references weddings(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'guest'
                check (role in ('owner', 'admin', 'reviewer', 'guest')),
  joined_at   timestamptz default now(),
  unique (wedding_id, user_id)
);
```

---

### `speeches`

```sql
create table speeches (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references weddings(id) on delete cascade,
  slug          text not null,
  title         text not null,
  speaker_name  text not null,
  delivered_at  date,
  hero_image    text,                       -- Supabase Storage path
  status        text not null default 'draft'
                  check (status in ('draft', 'live')),
  view_count    int not null default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (wedding_id, slug)
);
```

> Speeches have no approval step. An admin or owner publishes directly — clicking Publish sets `status = 'live'` immediately. Drafts are visible only to owners and admins.

---

### `speech_stanzas`

The transcript is broken into discrete stanzas/paragraphs at submission time. Ordering is explicit so reordering is possible later.

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
  id            uuid primary key default gen_random_uuid(),
  speech_id     uuid not null references speeches(id) on delete cascade,
  author_id     uuid not null references auth.users(id),
  char_start    int not null,
  char_end      int not null,
  selected_text text not null,            -- snapshot of the highlighted string
  body          text,                     -- Tiptap JSON (rich text)
  media_url     text,                     -- Supabase Storage path (optional)
  upvotes       int not null default 0,
  status        text not null default 'live'
                  check (status in ('live', 'removed')),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
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

> Maintain `annotations.upvotes` via a Postgres trigger that sums `annotation_votes.value` on insert/update/delete.

```sql
create or replace function sync_annotation_upvotes()
returns trigger language plpgsql as $$
begin
  update annotations
  set upvotes = (
    select coalesce(sum(value), 0)
    from annotation_votes
    where annotation_id = coalesce(new.annotation_id, old.annotation_id)
  )
  where id = coalesce(new.annotation_id, old.annotation_id);
  return null;
end;
$$;

create trigger sync_upvotes
after insert or update or delete on annotation_votes
for each row execute function sync_annotation_upvotes();
```

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

Enable RLS on all tables. Helper functions are defined once and reused across policies.

```sql
-- Check membership in any role
create or replace function is_wedding_member(wid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from wedding_members
    where wedding_id = wid and user_id = auth.uid()
  );
$$;

-- Check specific role
create or replace function is_wedding_role(wid uuid, r text)
returns boolean language sql security definer as $$
  select exists (
    select 1 from wedding_members
    where wedding_id = wid and user_id = auth.uid() and role = r
  );
$$;

-- Check if current user can access wedding content (open OR is a member)
create or replace function can_access_wedding(wid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from weddings w
    where w.id = wid and (
      w.join_mode = 'open'
      or exists (
        select 1 from wedding_members
        where wedding_id = wid and user_id = auth.uid()
      )
    )
  );
$$;
```

### `profiles` policies

```sql
alter table profiles enable row level security;

-- Anyone can read profiles (display names shown on annotations)
create policy "profiles_select" on profiles for select using (true);

-- Users update their own profile
create policy "profiles_update" on profiles for update using (auth.uid() = id);
```

### `weddings` policies

```sql
alter table weddings enable row level security;

-- Anyone can read weddings (global directory — limited metadata)
create policy "weddings_select" on weddings for select using (true);

-- Only owners can update
create policy "weddings_update" on weddings for update using (
  is_wedding_role(id, 'owner')
);
```

### `speeches` policies

```sql
alter table speeches enable row level security;

-- Live speeches are publicly readable (for chart and directory)
-- Drafts are visible only to owners and admins
create policy "speeches_select" on speeches for select using (
  status = 'live'
  or is_wedding_role(wedding_id, 'owner')
  or is_wedding_role(wedding_id, 'admin')
);

-- Owners and admins can insert speeches
create policy "speeches_insert" on speeches for insert with check (
  is_wedding_role(wedding_id, 'owner') or is_wedding_role(wedding_id, 'admin')
);

-- Owners and admins can update (publish, edit)
create policy "speeches_update" on speeches for update using (
  is_wedding_role(wedding_id, 'owner') or is_wedding_role(wedding_id, 'admin')
);
```

### `speech_stanzas` policies

```sql
alter table speech_stanzas enable row level security;

-- Transcript content: open weddings = any visitor; password/invite = members only
create policy "stanzas_select" on speech_stanzas for select using (
  exists (
    select 1 from speeches s
    where s.id = speech_id and s.status = 'live' and can_access_wedding(s.wedding_id)
  )
  or exists (
    select 1 from speeches s
    where s.id = speech_id and (
      is_wedding_role(s.wedding_id, 'owner') or is_wedding_role(s.wedding_id, 'admin')
    )
  )
);

-- Owners and admins can insert/update stanzas
create policy "stanzas_insert" on speech_stanzas for insert with check (
  exists (
    select 1 from speeches s
    where s.id = speech_id and (
      is_wedding_role(s.wedding_id, 'owner') or is_wedding_role(s.wedding_id, 'admin')
    )
  )
);

create policy "stanzas_update" on speech_stanzas for update using (
  exists (
    select 1 from speeches s
    where s.id = speech_id and (
      is_wedding_role(s.wedding_id, 'owner') or is_wedding_role(s.wedding_id, 'admin')
    )
  )
);
```

### `annotations` policies

```sql
alter table annotations enable row level security;

-- Read: open wedding = any visitor; password/invite = members only
create policy "annotations_select" on annotations for select using (
  status = 'live' and
  exists (
    select 1 from speeches s
    where s.id = speech_id and can_access_wedding(s.wedding_id)
  )
);

-- Write: must be authenticated; open wedding OR member
create policy "annotations_insert" on annotations for insert with check (
  auth.uid() is not null and
  author_id = auth.uid() and
  exists (
    select 1 from speeches s
    where s.id = speech_id and can_access_wedding(s.wedding_id)
  )
);

-- Author, owner, admin, or reviewer can update/remove
create policy "annotations_update" on annotations for update using (
  author_id = auth.uid() or
  exists (
    select 1 from speeches s
    where s.id = speech_id and (
      is_wedding_role(s.wedding_id, 'owner') or
      is_wedding_role(s.wedding_id, 'admin') or
      is_wedding_role(s.wedding_id, 'reviewer')
    )
  )
);
```

### `annotation_votes` policies

```sql
alter table annotation_votes enable row level security;

-- Read: same access as the parent annotation
create policy "votes_select" on annotation_votes for select using (
  exists (
    select 1 from annotations a
    join speeches s on s.id = a.speech_id
    where a.id = annotation_id and can_access_wedding(s.wedding_id)
  )
);

-- Write: must be authenticated
create policy "votes_insert" on annotation_votes for insert with check (
  auth.uid() is not null and user_id = auth.uid()
);

create policy "votes_delete" on annotation_votes for delete using (
  user_id = auth.uid()
);
```

### `annotation_comments` policies

```sql
alter table annotation_comments enable row level security;

-- Read: same access as the parent annotation
create policy "comments_select" on annotation_comments for select using (
  exists (
    select 1 from annotations a
    join speeches s on s.id = a.speech_id
    where a.id = annotation_id and can_access_wedding(s.wedding_id)
  )
);

-- Write: must be authenticated
create policy "comments_insert" on annotation_comments for insert with check (
  auth.uid() is not null and
  author_id = auth.uid() and
  exists (
    select 1 from annotations a
    join speeches s on s.id = a.speech_id
    where a.id = annotation_id and can_access_wedding(s.wedding_id)
  )
);

-- Authors can edit their own comments; owners/admins/reviewers can delete
create policy "comments_update" on annotation_comments for update using (
  author_id = auth.uid()
);
```

---

## Supabase Storage Buckets

| Bucket | Purpose | Access |
|---|---|---|
| `speech-heroes` | Speech banner images | Authenticated read (signed URLs) |
| `annotation-media` | Photos/images attached to annotations | Authenticated read (signed URLs) |
| `wedding-covers` | Wedding page cover images | Authenticated read (signed URLs) |

All buckets are private. Signed URLs are generated server-side for display.
