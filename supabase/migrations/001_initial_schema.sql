-- ============================================================
-- profiles
-- ============================================================
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- weddings
-- ============================================================
create table weddings (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  date          date,
  location      text,
  cover_image   text,
  join_mode     text not null default 'invite'
                  check (join_mode in ('open', 'password', 'invite')),
  join_password text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ============================================================
-- wedding_members
-- ============================================================
create table wedding_members (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references weddings(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'guest'
                check (role in ('owner', 'admin', 'reviewer', 'guest')),
  joined_at   timestamptz default now(),
  unique (wedding_id, user_id)
);

-- ============================================================
-- speeches
-- ============================================================
create table speeches (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references weddings(id) on delete cascade,
  slug          text not null,
  title         text not null,
  speaker_name  text not null,
  delivered_at  date,
  hero_image    text,
  status        text not null default 'draft'
                  check (status in ('draft', 'live')),
  view_count    int not null default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (wedding_id, slug)
);

-- ============================================================
-- speech_stanzas
-- ============================================================
create table speech_stanzas (
  id          uuid primary key default gen_random_uuid(),
  speech_id   uuid not null references speeches(id) on delete cascade,
  position    int not null,
  body        text not null,
  created_at  timestamptz default now(),
  unique (speech_id, position)
);

-- ============================================================
-- annotations
-- ============================================================
create table annotations (
  id            uuid primary key default gen_random_uuid(),
  speech_id     uuid not null references speeches(id) on delete cascade,
  author_id     uuid not null references auth.users(id),
  char_start    int not null,
  char_end      int not null,
  selected_text text not null,
  body          text,
  media_url     text,
  upvotes       int not null default 0,
  status        text not null default 'live'
                  check (status in ('live', 'removed')),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  constraint no_zero_range check (char_end > char_start)
);

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

-- ============================================================
-- annotation_votes
-- ============================================================
create table annotation_votes (
  id            uuid primary key default gen_random_uuid(),
  annotation_id uuid not null references annotations(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  value         int not null check (value in (1, -1)),
  created_at    timestamptz default now(),
  unique (annotation_id, user_id)
);

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

-- ============================================================
-- annotation_comments
-- ============================================================
create table annotation_comments (
  id            uuid primary key default gen_random_uuid(),
  annotation_id uuid not null references annotations(id) on delete cascade,
  author_id     uuid not null references auth.users(id),
  body          text not null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ============================================================
-- RLS helpers
-- ============================================================
create or replace function is_wedding_member(wid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from wedding_members
    where wedding_id = wid and user_id = auth.uid()
  );
$$;

create or replace function is_wedding_role(wid uuid, r text)
returns boolean language sql security definer as $$
  select exists (
    select 1 from wedding_members
    where wedding_id = wid and user_id = auth.uid() and role = r
  );
$$;

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

-- ============================================================
-- RLS policies
-- ============================================================
alter table profiles enable row level security;
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_update" on profiles for update using (auth.uid() = id);

alter table weddings enable row level security;
create policy "weddings_select" on weddings for select using (true);
create policy "weddings_update" on weddings for update using (is_wedding_role(id, 'owner'));

alter table wedding_members enable row level security;
create policy "members_select" on wedding_members for select using (is_wedding_member(wedding_id));
create policy "members_insert" on wedding_members for insert with check (true); -- controlled via edge function
create policy "members_update" on wedding_members for update using (is_wedding_role(wedding_id, 'owner'));

alter table speeches enable row level security;
create policy "speeches_select" on speeches for select using (
  status = 'live'
  or is_wedding_role(wedding_id, 'owner')
  or is_wedding_role(wedding_id, 'admin')
);
create policy "speeches_insert" on speeches for insert with check (
  is_wedding_role(wedding_id, 'owner') or is_wedding_role(wedding_id, 'admin')
);
create policy "speeches_update" on speeches for update using (
  is_wedding_role(wedding_id, 'owner') or is_wedding_role(wedding_id, 'admin')
);

alter table speech_stanzas enable row level security;
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

alter table annotations enable row level security;
create policy "annotations_select" on annotations for select using (
  status = 'live' and
  exists (
    select 1 from speeches s
    where s.id = speech_id and can_access_wedding(s.wedding_id)
  )
);
create policy "annotations_insert" on annotations for insert with check (
  auth.uid() is not null and
  author_id = auth.uid() and
  exists (
    select 1 from speeches s
    where s.id = speech_id and can_access_wedding(s.wedding_id)
  )
);
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

alter table annotation_votes enable row level security;
create policy "votes_select" on annotation_votes for select using (
  exists (
    select 1 from annotations a
    join speeches s on s.id = a.speech_id
    where a.id = annotation_id and can_access_wedding(s.wedding_id)
  )
);
create policy "votes_insert" on annotation_votes for insert with check (
  auth.uid() is not null and user_id = auth.uid()
);
create policy "votes_delete" on annotation_votes for delete using (user_id = auth.uid());

alter table annotation_comments enable row level security;
create policy "comments_select" on annotation_comments for select using (
  exists (
    select 1 from annotations a
    join speeches s on s.id = a.speech_id
    where a.id = annotation_id and can_access_wedding(s.wedding_id)
  )
);
create policy "comments_insert" on annotation_comments for insert with check (
  auth.uid() is not null and
  author_id = auth.uid() and
  exists (
    select 1 from annotations a
    join speeches s on s.id = a.speech_id
    where a.id = annotation_id and can_access_wedding(s.wedding_id)
  )
);
create policy "comments_update" on annotation_comments for update using (author_id = auth.uid());

-- Allow any authenticated user to create a wedding
create policy "weddings_insert" on weddings for insert with check (auth.uid() is not null);
