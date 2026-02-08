-- Storage: profile-images bucket and policies
-- Run this in Supabase SQL Editor for both Dev and Production
-- Ensures consistent setup across environments

-- 1. Create the profile-images bucket (public for viewing images)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images',
  'profile-images',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2. Drop existing policies if they exist (for idempotent re-run)
drop policy if exists "profile_images_select" on storage.objects;
drop policy if exists "profile_images_insert" on storage.objects;
drop policy if exists "profile_images_update" on storage.objects;
drop policy if exists "profile_images_delete" on storage.objects;

-- 3. SELECT: Allow public read (bucket is public)
create policy "profile_images_select"
  on storage.objects for select
  using (bucket_id = 'profile-images');

-- 4. INSERT: Allow authenticated users to upload to their own folder
create policy "profile_images_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = 'profiles'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- 5. UPDATE: Allow authenticated users to update their own files
create policy "profile_images_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = 'profiles'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = 'profiles'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- 6. DELETE: Allow authenticated users to delete their own files
create policy "profile_images_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = 'profiles'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
