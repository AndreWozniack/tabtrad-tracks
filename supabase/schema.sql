create extension if not exists "pgcrypto";

insert into storage.buckets (id, name, public)
values ('tracks', 'tracks', false)
on conflict (id) do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null unique,
  visibility text not null default 'private' check (visibility in ('private', 'team', 'public')),
  public_share_token uuid unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  notes text,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  storage_provider text not null default 'supabase' check (storage_provider in ('supabase', 'r2')),
  storage_bucket text,
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint,
  duration_seconds integer,
  visibility text not null default 'private' check (visibility in ('private', 'team', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collection_tracks (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections (id) on delete cascade,
  track_id uuid not null references public.tracks (id) on delete cascade,
  sort_order integer not null,
  unique (collection_id, track_id),
  unique (collection_id, sort_order)
);

create table if not exists public.collection_members (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  permission text not null default 'viewer' check (permission in ('viewer', 'editor')),
  unique (collection_id, profile_id)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.is_collection_owner(target_collection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.collections c
    where c.id = target_collection_id
      and c.owner_id = auth.uid()
  );
$$;

create or replace function public.is_collection_member(target_collection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.collection_members cm
    where cm.collection_id = target_collection_id
      and cm.profile_id = auth.uid()
  );
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.collections enable row level security;
alter table public.tracks enable row level security;
alter table public.collection_tracks enable row level security;
alter table public.collection_members enable row level security;

drop policy if exists "profiles can read themselves" on public.profiles;
drop policy if exists "profiles can update themselves" on public.profiles;
drop policy if exists "owners and members can read collections" on public.collections;
drop policy if exists "owners can manage collections" on public.collections;
drop policy if exists "owners and members can read tracks" on public.tracks;
drop policy if exists "owners can read tracks" on public.tracks;
drop policy if exists "owners can manage tracks" on public.tracks;
drop policy if exists "users can upload own audio objects" on storage.objects;
drop policy if exists "users can read own audio objects" on storage.objects;
drop policy if exists "users can delete own audio objects" on storage.objects;
drop policy if exists "members can read collection tracks" on public.collection_tracks;
drop policy if exists "owners can manage collection tracks" on public.collection_tracks;
drop policy if exists "members can read own memberships" on public.collection_members;
drop policy if exists "owners can manage members" on public.collection_members;

create policy "profiles can read themselves"
on public.profiles
for select
using (auth.uid() = id);

create policy "profiles can update themselves"
on public.profiles
for update
using (auth.uid() = id);

create policy "owners and members can read collections"
on public.collections
for select
using (
  public.collections.owner_id = auth.uid()
  or public.collections.visibility = 'public'
  or public.is_collection_member(public.collections.id)
);

create policy "owners can manage collections"
on public.collections
for all
using (public.collections.owner_id = auth.uid())
with check (public.collections.owner_id = auth.uid());

create policy "owners can read tracks"
on public.tracks
for select
using (
  public.tracks.owner_id = auth.uid()
  or public.tracks.visibility = 'public'
);

create policy "owners can manage tracks"
on public.tracks
for all
using (public.tracks.owner_id = auth.uid())
with check (public.tracks.owner_id = auth.uid());

create policy "users can upload own audio objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'tracks'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users can read own audio objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'tracks'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users can delete own audio objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'tracks'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "members can read collection tracks"
on public.collection_tracks
for select
using (
  public.is_collection_owner(collection_id)
  or public.is_collection_member(collection_id)
  or exists (
    select 1
    from public.collections c
    where c.id = public.collection_tracks.collection_id
      and c.visibility = 'public'
  )
);

create policy "owners can manage collection tracks"
on public.collection_tracks
for all
using (public.is_collection_owner(collection_id))
with check (public.is_collection_owner(collection_id));

create policy "members can read own memberships"
on public.collection_members
for select
using (profile_id = auth.uid());

create policy "owners can manage members"
on public.collection_members
for all
using (public.is_collection_owner(collection_id))
with check (public.is_collection_owner(collection_id));
