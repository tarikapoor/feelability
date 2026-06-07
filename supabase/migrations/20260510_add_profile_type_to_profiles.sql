alter table public.profiles
add column if not exists profile_type text not null default 'express'
check (profile_type in ('express', 'mirror'));
