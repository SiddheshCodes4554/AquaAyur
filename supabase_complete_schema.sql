-- AquaAyur Complete Supabase Database Schema
-- Production-Ready PostgreSQL DDL Migration Script

-- Enable UUID Extension
create extension if not exists "uuid-ossp";

-- =========================================================================
-- 1. AUTHENTICATION & PROFILES
-- =========================================================================

-- Profiles Table (Extends Supabase Auth users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  full_name text,
  avatar_url text,
  birth_date date,
  gender text check (gender in ('male', 'female', 'other', 'prefer_not_to_say')),
  weight_kg numeric(5,2),
  height_cm numeric(5,2),
  dominant_dosha text check (dominant_dosha in ('vata', 'pitta', 'kapha', 'dual_vata_pitta', 'dual_pitta_kapha', 'dual_vata_kapha', 'tridoshic')),
  daily_water_goal_ml integer default 2500 not null,
  daily_calorie_goal_kcal integer default 2000 not null
);

-- Enable RLS for Profiles
alter table public.profiles enable row level security;

create policy "Users can view and edit their own profiles."
  on public.profiles for all
  using (auth.uid() = id);

-- =========================================================================
-- 2. DEVICES & PAIRINGS
-- =========================================================================

-- Registered Wearable Devices
create table if not exists public.devices (
  id uuid default gen_random_uuid() primary key,
  mac_address text unique not null,
  device_name text not null,
  firmware_version text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Devices (Public read, Admin/System write)
alter table public.devices enable row level security;

create policy "Users can view registered devices."
  on public.devices for select
  using (true);

create policy "Authenticated users can insert devices."
  on public.devices for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update devices."
  on public.devices for update
  using (auth.role() = 'authenticated');

-- User-to-Device Pairings
create table if not exists public.pairings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  device_id uuid references public.devices(id) on delete cascade not null,
  paired_at timestamp with time zone default timezone('utc'::text, now()) not null,
  is_active boolean default true not null,
  last_connected_at timestamp with time zone,
  unique (user_id, device_id)
);

-- Enable RLS for Pairings
alter table public.pairings enable row level security;

create policy "Users can manage their own device pairings."
  on public.pairings for all
  using (auth.uid() = user_id);

-- =========================================================================
-- 3. SENSOR DATA (TELEMETRY LOGS)
-- =========================================================================

-- Heart Rate Logs
create table if not exists public.heart_rate_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  timestamp timestamp with time zone not null,
  bpm integer not null check (bpm > 0 and bpm < 300),
  hrv_ms integer check (hrv_ms >= 0)
);

alter table public.heart_rate_logs enable row level security;
create policy "Users can manage their own heart rate logs."
  on public.heart_rate_logs for all
  using (auth.uid() = user_id);

-- Temperature Logs
create table if not exists public.temperature_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  timestamp timestamp with time zone not null,
  temperature_celsius numeric(4,2) not null check (temperature_celsius > 30.0 and temperature_celsius < 45.0)
);

alter table public.temperature_logs enable row level security;
create policy "Users can manage their own temperature logs."
  on public.temperature_logs for all
  using (auth.uid() = user_id);

-- Activity Logs (Motion / Accelerometer / Steps)
create table if not exists public.activity_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  timestamp timestamp with time zone not null,
  steps_count integer default 0 not null check (steps_count >= 0),
  calories_burned_kcal integer default 0 not null check (calories_burned_kcal >= 0),
  accel_x_avg integer,
  accel_y_avg integer,
  activity_type text check (activity_type in ('sedentary', 'walking', 'running', 'yoga', 'other')) default 'sedentary'
);

alter table public.activity_logs enable row level security;
create policy "Users can manage their own activity logs."
  on public.activity_logs for all
  using (auth.uid() = user_id);

-- Sleep Logs
create table if not exists public.sleep_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  duration_minutes integer not null check (duration_minutes >= 0),
  deep_sleep_minutes integer check (deep_sleep_minutes >= 0),
  light_sleep_minutes integer check (light_sleep_minutes >= 0),
  rem_sleep_minutes integer check (rem_sleep_minutes >= 0),
  awake_minutes integer check (awake_minutes >= 0),
  sleep_score integer check (sleep_score >= 0 and sleep_score <= 100),
  check (end_time > start_time)
);

alter table public.sleep_logs enable row level security;
create policy "Users can manage their own sleep logs."
  on public.sleep_logs for all
  using (auth.uid() = user_id);

-- Hydration Logs
create table if not exists public.hydration_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  amount_ml integer not null check (amount_ml > 0),
  source text default 'manual'::text check (source in ('manual', 'wearable_alert', 'ai_recommendation'))
);

alter table public.hydration_logs enable row level security;
create policy "Users can manage their own hydration logs."
  on public.hydration_logs for all
  using (auth.uid() = user_id);

-- =========================================================================
-- 4. NUTRITION
-- =========================================================================

-- Food Logs
create table if not exists public.food_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  meal_type text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')) not null,
  food_name text not null,
  quantity_g numeric(6,2) not null check (quantity_g > 0.0),
  calories_kcal integer not null check (calories_kcal >= 0)
);

alter table public.food_logs enable row level security;
create policy "Users can manage their own food logs."
  on public.food_logs for all
  using (auth.uid() = user_id);

-- Nutrition Analysis Details (1:1 with food_logs)
create table if not exists public.nutrition_analysis (
  id uuid default gen_random_uuid() primary key,
  food_log_id uuid references public.food_logs(id) on delete cascade not null unique,
  carbs_g numeric(5,2) default 0.0 check (carbs_g >= 0.0),
  protein_g numeric(5,2) default 0.0 check (protein_g >= 0.0),
  fat_g numeric(5,2) default 0.0 check (fat_g >= 0.0),
  fiber_g numeric(5,2) default 0.0 check (fiber_g >= 0.0),
  water_content_ml integer default 0 check (water_content_ml >= 0),
  ayurvedic_taste text check (ayurvedic_taste in ('sweet', 'sour', 'salty', 'bitter', 'pungent', 'astringent')),
  dosha_effect text
);

alter table public.nutrition_analysis enable row level security;
create policy "Users can manage their own nutrition analyses."
  on public.nutrition_analysis for all
  using (
    exists (
      select 1 from public.food_logs
      where public.food_logs.id = public.nutrition_analysis.food_log_id
      and public.food_logs.user_id = auth.uid()
    )
  );

-- =========================================================================
-- 5. ARTIFICIAL INTELLIGENCE (AI)
-- =========================================================================

-- AI Insights / Reports Logs
create table if not exists public.ai_insights (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  insight_type text check (insight_type in ('daily_summary', 'hydration_alert', 'dosha_shift', 'sleep_advice')) not null,
  title text not null,
  content_markdown text not null,
  metadata_snapshot jsonb
);

alter table public.ai_insights enable row level security;
create policy "Users can view and delete their own AI insights."
  on public.ai_insights for all
  using (auth.uid() = user_id);

-- Chat Conversations History
create table if not exists public.chat_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  sender text check (sender in ('user', 'ai')) not null,
  message_text text not null
);

alter table public.chat_history enable row level security;
create policy "Users can manage their own chat histories."
  on public.chat_history for all
  using (auth.uid() = user_id);

-- =========================================================================
-- 6. HEALTH REPORTS (WEEKLY/MONTHLY ANALYSIS)
-- =========================================================================

create table if not exists public.health_reports (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  report_type text check (report_type in ('weekly', 'monthly')) not null,
  start_date date not null,
  end_date date not null,
  summary_markdown text not null,
  pdf_storage_path text, -- Pointer to supabase storage file
  check (end_date >= start_date)
);

alter table public.health_reports enable row level security;
create policy "Users can view their own health reports."
  on public.health_reports for all
  using (auth.uid() = user_id);

-- =========================================================================
-- 7. PERFORMANCE SEARCH INDEXES (Optimized Queries)
-- =========================================================================

-- Indexing for telemetry sorting (extremely vital for real-time aggregation queries)
create index if not exists idx_hr_user_time on public.heart_rate_logs (user_id, timestamp desc);
create index if not exists idx_temp_user_time on public.temperature_logs (user_id, timestamp desc);
create index if not exists idx_act_user_time on public.activity_logs (user_id, timestamp desc);
create index if not exists idx_sleep_user_time on public.sleep_logs (user_id, start_time desc);

-- Indexing for nutrition & logs journals
create index if not exists idx_food_user_time on public.food_logs (user_id, timestamp desc);
create index if not exists idx_insights_user_time on public.ai_insights (user_id, timestamp desc);
create index if not exists idx_chat_user_time on public.chat_history (user_id, timestamp desc);
create index if not exists idx_hydration_user_time on public.hydration_logs (user_id, timestamp desc);

-- =========================================================================
-- 8. AUTOMATION TRIGGERS
-- =========================================================================

-- Trigger to automatically create a profile after signup
create or replace function public.handle_new_auth_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url, daily_water_goal_ml, daily_calorie_goal_kcal)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Yogi'),
    new.raw_user_meta_data->>'avatar_url',
    2500,
    2000
  );
  return new;
end;
$$ language plpgsql security definer;

-- Remove duplicate trigger if exists, then register
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- =========================================================================
-- 9. STORAGE BUCKETS CONFIGURATION (Supabase Storage SQL Setup)
-- =========================================================================

-- Insert Storage Buckets into storage.buckets table
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values 
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']), -- 5MB limit
  ('health_reports', 'health_reports', false, 10485760, array['application/pdf']) -- 10MB limit, private bucket
on conflict (id) do nothing;

-- Set up RLS for Storage Objects (users can only interact with files matching their user ID folder structure)
create policy "Users can upload their own avatars"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars' 
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can view all public avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can delete their own avatars"
  on storage.objects for delete
  using (
    bucket_id = 'avatars' 
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can manage their own health report files"
  on storage.objects for all
  using (
    bucket_id = 'health_reports' 
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =========================================================================
-- 10. SENSOR STREAMS FOR SIMULATOR REALTIME
-- =========================================================================

create table if not exists public.sensor_streams (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  heart_rate integer not null,
  skin_temperature numeric(4,2) not null,
  steps integer not null,
  activity text not null
);

alter table public.sensor_streams enable row level security;

create policy "Users can manage their own sensor streams."
  on public.sensor_streams for all
  using (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_rel pr
    join pg_publication p on pr.prpubid = p.oid
    join pg_class c on pr.prrelid = c.oid
    join pg_namespace n on c.relnamespace = n.oid
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'sensor_streams'
  ) then
    alter publication supabase_realtime add table public.sensor_streams;
  end if;
exception
  when others then
    null;
end $$;

