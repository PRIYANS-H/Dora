-- DORI — Supabase Schema Migration
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/ukcjfuwvleufylxohwpf/sql

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- User profiles are separate from Supabase Auth so public profile URLs are stable.
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
drop policy if exists "public_profiles_read" on profiles;
drop policy if exists "users_create_own_profile" on profiles;
drop policy if exists "users_update_own_profile" on profiles;
create policy "public_profiles_read" on profiles for select using (true);
create policy "users_create_own_profile" on profiles for insert with check (auth.uid() = id);
create policy "users_update_own_profile" on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

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

-- Drop existing tables (safe re-run)
drop table if exists orders cascade;
drop table if exists remixes cascade;
drop table if exists tailors cascade;
drop table if exists posts cascade;

-- Posts table
create table posts (
  id text primary key,
  designer_name text not null,
  designer_handle text not null,
  image_url text not null,
  title text not null,
  base_attributes jsonb not null default '{}',
  price_reference integer not null default 250,
  tailor_id text,
  created_at timestamptz not null default now()
);

-- Remixes table
create table remixes (
  id text primary key default gen_random_uuid()::text,
  post_id text not null references posts(id),
  user_label text default 'Demo User',
  attributes jsonb not null default '{}',
  remixed_image_url text not null,
  created_at timestamptz not null default now()
);

-- Tailors table
create table tailors (
  id text primary key,
  name text not null,
  photo_url text not null,
  skills jsonb not null default '[]',
  lat float not null,
  lng float not null,
  rating float not null default 4.8,
  reviews_count integer default 42,
  price_band text default 'mid',
  portfolio_tags jsonb not null default '[]'
);

-- Orders table
create table orders (
  id text primary key default gen_random_uuid()::text,
  remix_id text not null references remixes(id),
  tailor_id text not null references tailors(id),
  match_score float not null,
  measurements jsonb not null default '{}',
  status text not null default 'placed',
  created_at timestamptz not null default now()
);

-- Enable Row Level Security (optional — disable for full backend access via service key)
alter table posts enable row level security;
alter table remixes enable row level security;
alter table tailors enable row level security;
alter table orders enable row level security;

-- Allow full access via service key (backend uses service_role)
create policy "service_role_all_posts" on posts for all using (true);
create policy "service_role_all_remixes" on remixes for all using (true);
create policy "service_role_all_tailors" on tailors for all using (true);
create policy "service_role_all_orders" on orders for all using (true);
