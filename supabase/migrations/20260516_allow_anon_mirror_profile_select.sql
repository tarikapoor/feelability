drop policy if exists "profiles_public_mirror_anon_select" on public.profiles;

create policy "profiles_public_mirror_anon_select"
  on public.profiles for select
  using (
    visibility = 'public'
    and profile_type = 'mirror'
  );
