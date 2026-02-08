-- E2EE Migration: Add encrypted note storage and key management tables
-- Run this AFTER schema.sql in Supabase SQL Editor

-- 1. Add E2EE columns to profile_notes (ciphertext + iv for encrypted content)
-- Make text nullable so E2EE notes store only ciphertext
alter table public.profile_notes
  add column if not exists ciphertext text,
  add column if not exists iv text;

-- Make text nullable for E2EE (plaintext never stored for new notes)
alter table public.profile_notes alter column text drop not null;

-- 2. User public keys for key exchange (each user uploads their public key)
create table if not exists public.user_encryption_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  public_key_jwk jsonb not null,
  created_at timestamptz not null default now()
);

-- 3. Wrapped profile keys (profile key encrypted for each collaborator)
create table if not exists public.profile_key_shares (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  wrapped_key text not null,
  created_at timestamptz not null default now(),
  unique (profile_id, user_id)
);

-- Enable RLS
alter table public.user_encryption_keys enable row level security;
alter table public.profile_key_shares enable row level security;

-- RLS: user_encryption_keys
-- Users can insert/update their own public key; any authenticated user can read (needed to fetch collaborator's key)
drop policy if exists "user_keys_own_insert" on public.user_encryption_keys;
drop policy if exists "user_keys_own_update" on public.user_encryption_keys;
drop policy if exists "user_keys_authenticated_select" on public.user_encryption_keys;

create policy "user_keys_own_insert" on public.user_encryption_keys for insert
  with check (auth.uid() = user_id);

create policy "user_keys_own_update" on public.user_encryption_keys for update
  using (auth.uid() = user_id);

create policy "user_keys_authenticated_select" on public.user_encryption_keys for select
  using (auth.uid() IS NOT NULL);

-- RLS: profile_key_shares
-- Profile owner can insert when adding collaborator; users can read their own wrapped keys
drop policy if exists "key_shares_owner_insert" on public.profile_key_shares;
drop policy if exists "key_shares_owner_delete" on public.profile_key_shares;
drop policy if exists "key_shares_user_select" on public.profile_key_shares;

create policy "key_shares_owner_insert" on public.profile_key_shares for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = profile_key_shares.profile_id and p.owner_id = auth.uid()
    )
  );

create policy "key_shares_owner_delete" on public.profile_key_shares for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_key_shares.profile_id and p.owner_id = auth.uid()
    )
  );

create policy "key_shares_user_select" on public.profile_key_shares for select
  using (user_id = auth.uid());

-- Index for key lookups
create index if not exists profile_key_shares_profile_user_idx
  on public.profile_key_shares (profile_id, user_id);
