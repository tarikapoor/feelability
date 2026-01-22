-- Run this in your Supabase SQL editor to enable profiles + collaborators.

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  image_data text,
  punch_count int not null default 0,
  hug_count int not null default 0,
  kiss_count int not null default 0,
  notes_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.profile_collaborators (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  unique (profile_id, user_id)
);

create table if not exists public.profile_notes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  text text not null,
  emotion_type text default 'feelings' check (emotion_type in ('anger','feelings','appreciation')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profile_collaborators enable row level security;
alter table public.profile_notes enable row level security;

-- Drop existing policies for idempotent re-run
drop policy if exists "profiles_owner_select" on public.profiles;
drop policy if exists "profiles_owner_insert" on public.profiles;
drop policy if exists "profiles_owner_update" on public.profiles;
drop policy if exists "profiles_owner_delete" on public.profiles;
drop policy if exists "profiles_public_collab_select" on public.profiles;
drop policy if exists "profiles_public_select" on public.profiles;
drop policy if exists "profiles_owner_or_collab_update" on public.profiles;

drop policy if exists "collaborators_owner_select" on public.profile_collaborators;
drop policy if exists "collaborators_owner_delete" on public.profile_collaborators;
drop policy if exists "collaborators_public_insert" on public.profile_collaborators;

drop policy if exists "notes_owner_or_collab_select" on public.profile_notes;
drop policy if exists "notes_owner_or_collab_insert" on public.profile_notes;
drop policy if exists "notes_owner_or_collab_delete" on public.profile_notes;

-- Helper to avoid RLS recursion
drop function if exists public.is_profile_collaborator(uuid, uuid);
create function public.is_profile_collaborator(profile_id uuid, user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profile_collaborators pc
    where pc.profile_id = is_profile_collaborator.profile_id
      and pc.user_id = is_profile_collaborator.user_id
  );
$$;

-- Profiles: owner can manage, anyone can read public profiles
create policy "profiles_owner_select"
  on public.profiles for select
  using (owner_id = auth.uid());

create policy "profiles_owner_insert"
  on public.profiles for insert
  with check (owner_id = auth.uid());

create policy "profiles_owner_update"
  on public.profiles for update
  using (owner_id = auth.uid());

create policy "profiles_owner_delete"
  on public.profiles for delete
  using (owner_id = auth.uid());

create policy "profiles_public_select"
  on public.profiles for select
  using (visibility = 'public');

-- Collaborators: only owners can view/manage, any authed user can add self to public
create policy "collaborators_owner_select"
  on public.profile_collaborators for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_collaborators.profile_id
        and p.owner_id = auth.uid()
    )
  );

create policy "collaborators_owner_delete"
  on public.profile_collaborators for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_collaborators.profile_id
        and p.owner_id = auth.uid()
    )
  );

create policy "collaborators_public_insert"
  on public.profile_collaborators for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = profile_collaborators.profile_id
        and p.visibility = 'public'
        and p.owner_id <> auth.uid()
    )
  );

-- Notes: owner or collaborator on public profile can read/write
create policy "notes_owner_or_collab_select"
  on public.profile_notes for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_notes.profile_id
        and (
          p.owner_id = auth.uid()
          or (
            p.visibility = 'public'
            and public.is_profile_collaborator(p.id, auth.uid())
          )
        )
    )
  );

create policy "notes_owner_or_collab_insert"
  on public.profile_notes for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = profile_notes.profile_id
        and (
          p.owner_id = auth.uid()
          or (
            p.visibility = 'public'
            and public.is_profile_collaborator(p.id, auth.uid())
          )
        )
    )
  );

create policy "notes_owner_or_collab_delete"
  on public.profile_notes for delete
  using (
    user_id = auth.uid()
  );

-- Profiles update for owners or collaborators on public profiles (counts only are client-side)
create policy "profiles_owner_or_collab_update"
  on public.profiles for update
  using (
    owner_id = auth.uid()
    or (
      visibility = 'public'
      and public.is_profile_collaborator(profiles.id, auth.uid())
    )
  );
