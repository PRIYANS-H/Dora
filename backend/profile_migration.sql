-- DORI profile onboarding migration
-- Run this separately in the Supabase SQL Editor. It does not drop existing tables.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username = lower(username)),
  full_name text not null,
  email text not null,
  bio text not null default '',
  avatar_url text,
  is_professional boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;
grant select, insert, update on table profiles to anon, authenticated;
drop policy if exists "public_profiles_read" on profiles;
drop policy if exists "users_create_own_profile" on profiles;
drop policy if exists "users_update_own_profile" on profiles;
create policy "public_profiles_read" on profiles for select using (true);
create policy "users_create_own_profile" on profiles for insert with check (auth.uid() = id);
create policy "users_update_own_profile" on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

grant select, insert, update, delete on table storage.objects to authenticated;
drop policy if exists "public_avatar_read" on storage.objects;
drop policy if exists "users_upload_own_avatar" on storage.objects;
drop policy if exists "users_update_own_avatar" on storage.objects;
drop policy if exists "users_delete_own_avatar" on storage.objects;
create policy "public_avatar_read" on storage.objects for select using (bucket_id = 'avatars');
create policy "users_upload_own_avatar" on storage.objects for insert with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text)
);
create policy "users_update_own_avatar" on storage.objects for update using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text)
);
create policy "users_delete_own_avatar" on storage.objects for delete using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text)
);
