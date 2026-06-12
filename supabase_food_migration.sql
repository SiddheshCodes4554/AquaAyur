-- Supabase Food Logging Database & Storage Migration
-- Execute this script in your Supabase SQL Editor to support meal photo uploads and macro tracking.

-- 1. Alter food_logs table to add image_url support
alter table public.food_logs 
  add column if not exists image_url text;

-- 2. Create the storage bucket for meals
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values 
  ('meals', 'meals', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']) -- 5MB limit
on conflict (id) do nothing;

-- 3. Storage Security Policies (RLS)
-- Allow users to upload photos into a folder matching their user ID
create policy "Users can upload their own meal photos"
  on storage.objects for insert
  with check (
    bucket_id = 'meals' 
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow anyone to view public meal photos
create policy "Users can view all public meal photos"
  on storage.objects for select
  using (bucket_id = 'meals');

-- Allow users to delete their own meal photos
create policy "Users can delete their own meal photos"
  on storage.objects for delete
  using (
    bucket_id = 'meals' 
    and (storage.foldername(name))[1] = auth.uid()::text
  );
