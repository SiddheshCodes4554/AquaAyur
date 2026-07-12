-- =========================================================================
-- AQUAAYUR COMPLETE MASTER SCHEMA SETUP (CLERK AUTH INTEGRATION)
-- Drops all existing tables and recreates the database with text-based user IDs.
-- =========================================================================

-- Enable UUID Extension
create extension if not exists "uuid-ossp";

-- Clean drop of existing tables to avoid type/foreign key conflicts
drop table if exists public.sensor_streams cascade;
drop table if exists public.dinacharya_completions cascade;
drop table if exists public.dinacharya_recommendations cascade;
drop table if exists public.daily_ojas_scores cascade;
drop table if exists public.daily_agni_scores cascade;
drop table if exists public.daily_dosha_states cascade;
drop table if exists public.dosha_assessments cascade;
drop table if exists public.health_reports cascade;
drop table if exists public.chat_history cascade;
drop table if exists public.ai_insights cascade;
drop table if exists public.nutrition_analysis cascade;
drop table if exists public.food_logs cascade;
drop table if exists public.hydration_logs cascade;
drop table if exists public.sleep_logs cascade;
drop table if exists public.activity_logs cascade;
drop table if exists public.temperature_logs cascade;
drop table if exists public.heart_rate_logs cascade;
drop table if exists public.pairings cascade;
drop table if exists public.devices cascade;

-- Onboarding normalized tables
drop table if exists public.medical_conditions cascade;
drop table if exists public.allergies cascade;
drop table if exists public.food_preferences cascade;
drop table if exists public.health_goals cascade;
drop table if exists public.lifestyle cascade;
drop table if exists public.profiles cascade;

-- Remove Supabase Auth trigger function if exists
drop function if exists public.handle_new_auth_user() cascade;

-- =========================================================================
-- 1. AUTHENTICATION & PROFILES
-- =========================================================================

-- Profiles Table (Linked to Clerk Authentication user ID as text)
create table public.profiles (
  id text primary key, -- Clerk User ID (e.g. user_2W3...)
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  email text not null,
  first_name text,
  last_name text,
  full_name text,
  avatar_url text,
  age integer,
  gender text check (gender in ('male', 'female', 'other', 'prefer_not_to_say')),
  weight_kg numeric(5,2),
  height_cm numeric(5,2),
  blood_group text,
  country text,
  timezone text,
  preferred_language text,
  diet_preference text check (diet_preference in ('Vegetarian', 'Vegan', 'Eggetarian', 'Non-Vegetarian', 'Jain', 'Other')),
  dominant_dosha text check (dominant_dosha in ('vata', 'pitta', 'kapha', 'dual_vata_pitta', 'dual_pitta_kapha', 'dual_vata_kapha', 'tridoshic')),
  daily_water_goal_ml integer default 2500 not null,
  daily_calorie_goal_kcal integer default 2000 not null
);

-- Enable RLS for Profiles
alter table public.profiles enable row level security;

create policy "Users can view and edit their own profiles."
  on public.profiles for all
  using ((auth.jwt() ->> 'sub') = id);

-- =========================================================================
-- 1B. NORMALIZED ONBOARDING TABLES
-- =========================================================================

-- Medical Conditions
create table public.medical_conditions (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
  condition_name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.medical_conditions enable row level security;
create policy "Users can manage their own medical conditions."
  on public.medical_conditions for all
  using ((auth.jwt() ->> 'sub') = user_id);

-- Allergies
create table public.allergies (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
  allergy_name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.allergies enable row level security;
create policy "Users can manage their own allergies."
  on public.allergies for all
  using ((auth.jwt() ->> 'sub') = user_id);

-- Disliked Foods & Preferences
create table public.food_preferences (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
  disliked_food text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.food_preferences enable row level security;
create policy "Users can manage their own food preferences."
  on public.food_preferences for all
  using ((auth.jwt() ->> 'sub') = user_id);

-- Health Goals
create table public.health_goals (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
  goal_name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.health_goals enable row level security;
create policy "Users can manage their own health goals."
  on public.health_goals for all
  using ((auth.jwt() ->> 'sub') = user_id);

-- Lifestyle Intake Details (1:1 with profiles)
create table public.lifestyle (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.profiles(id) on delete cascade not null unique,
  avg_sleep_hours numeric(3,1),
  activity_level text check (activity_level in ('sedentary', 'lightly_active', 'moderately_active', 'very_active')),
  occupation text,
  stress_level text check (stress_level in ('low', 'medium', 'high')),
  water_intake_ml integer,
  smoking boolean default false not null,
  alcohol text check (alcohol in ('none', 'occasional', 'frequent')),
  exercise_frequency text check (exercise_frequency in ('none', '1-2_times_week', '3-5_times_week', 'daily')),
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.lifestyle enable row level security;
create policy "Users can manage their own lifestyle profiles."
  on public.lifestyle for all
  using ((auth.jwt() ->> 'sub') = user_id);

-- =========================================================================
-- 2. DEVICES & PAIRINGS
-- =========================================================================

-- Registered Wearable Devices
create table public.devices (
  id uuid default gen_random_uuid() primary key,
  mac_address text unique not null,
  device_name text not null,
  firmware_version text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Devices
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
create table public.pairings (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
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
  using ((auth.jwt() ->> 'sub') = user_id);

-- =========================================================================
-- 3. BIOMETRIC SENSOR TELEMETRY LOGS
-- =========================================================================

-- Heart Rate Logs
create table public.heart_rate_logs (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
  timestamp timestamp with time zone not null,
  bpm integer not null check (bpm > 0 and bpm < 300),
  hrv_ms integer check (hrv_ms >= 0)
);

alter table public.heart_rate_logs enable row level security;
create policy "Users can manage their own heart rate logs."
  on public.heart_rate_logs for all
  using ((auth.jwt() ->> 'sub') = user_id);

-- Temperature Logs
create table public.temperature_logs (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
  timestamp timestamp with time zone not null,
  temperature_celsius numeric(4,2) not null check (temperature_celsius > 30.0 and temperature_celsius < 45.0)
);

alter table public.temperature_logs enable row level security;
create policy "Users can manage their own temperature logs."
  on public.temperature_logs for all
  using ((auth.jwt() ->> 'sub') = user_id);

-- Activity Logs
create table public.activity_logs (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
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
  using ((auth.jwt() ->> 'sub') = user_id);

-- Sleep Logs
create table public.sleep_logs (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
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
  using ((auth.jwt() ->> 'sub') = user_id);

-- Hydration Logs
create table public.hydration_logs (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  amount_ml integer not null check (amount_ml > 0),
  source text default 'manual'::text check (source in ('manual', 'wearable_alert', 'ai_recommendation'))
);

alter table public.hydration_logs enable row level security;
create policy "Users can manage their own hydration logs."
  on public.hydration_logs for all
  using ((auth.jwt() ->> 'sub') = user_id);

-- =========================================================================
-- 4. NUTRITION
-- =========================================================================

-- Food Logs
create table public.food_logs (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  meal_type text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')) not null,
  food_name text not null,
  quantity_g numeric(6,2) not null check (quantity_g > 0.0),
  calories_kcal integer not null check (calories_kcal >= 0),
  image_url text
);

alter table public.food_logs enable row level security;
create policy "Users can manage their own food logs."
  on public.food_logs for all
  using ((auth.jwt() ->> 'sub') = user_id);

-- Nutrition Analysis Details (1:1 with food_logs)
create table public.nutrition_analysis (
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
      where public.food_logs.id = food_log_id
      and public.food_logs.user_id = (auth.jwt() ->> 'sub')
    )
  );

-- =========================================================================
-- 5. ARTIFICIAL INTELLIGENCE & CHAT
-- =========================================================================

-- AI Insights / Alerts
create table public.ai_insights (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  insight_type text check (insight_type in ('daily_summary', 'hydration_alert', 'dosha_shift', 'sleep_advice')) not null,
  title text not null,
  content_markdown text not null,
  metadata_snapshot jsonb
);

alter table public.ai_insights enable row level security;
create policy "Users can view and delete their own AI insights."
  on public.ai_insights for all
  using ((auth.jwt() ->> 'sub') = user_id);

-- Chat Conversations History
create table public.chat_history (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  sender text check (sender in ('user', 'ai')) not null,
  message_text text not null
);

alter table public.chat_history enable row level security;
create policy "Users can manage their own chat histories."
  on public.chat_history for all
  using ((auth.jwt() ->> 'sub') = user_id);

-- Health Reports
create table public.health_reports (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  report_type text check (report_type in ('weekly', 'monthly')) not null,
  start_date date not null,
  end_date date not null,
  summary_markdown text not null,
  pdf_storage_path text,
  check (end_date >= start_date)
);

alter table public.health_reports enable row level security;
create policy "Users can view their own health reports."
  on public.health_reports for all
  using ((auth.jwt() ->> 'sub') = user_id);

-- =========================================================================
-- 6. AYURVEDIC DOSHA ASSESSMENTS & STATES
-- =========================================================================

-- Questionnaire Assessments
create table public.dosha_assessments (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  vata_score integer not null check (vata_score >= 0),
  pitta_score integer not null check (pitta_score >= 0),
  kapha_score integer not null check (kapha_score >= 0),
  vata_percentage numeric(5,2) not null check (vata_percentage >= 0.0 and vata_percentage <= 100.0),
  pitta_percentage numeric(5,2) not null check (pitta_percentage >= 0.0 and pitta_percentage <= 100.0),
  kapha_percentage numeric(5,2) not null check (kapha_percentage >= 0.0 and kapha_percentage <= 100.0),
  result_dosha text not null check (result_dosha in ('vata', 'pitta', 'kapha', 'dual_vata_pitta', 'dual_pitta_kapha', 'dual_vata_kapha', 'tridoshic'))
);

alter table public.dosha_assessments enable row level security;
create policy "Users can manage their own dosha assessments."
  on public.dosha_assessments for all
  using ((auth.jwt() ->> 'sub') = user_id);

-- Daily Calculated Dosha States
create table public.daily_dosha_states (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
  date date not null,
  vata_percentage numeric(5,2) not null check (vata_percentage >= 0.0 and vata_percentage <= 100.0),
  pitta_percentage numeric(5,2) not null check (pitta_percentage >= 0.0 and pitta_percentage <= 100.0),
  kapha_percentage numeric(5,2) not null check (kapha_percentage >= 0.0 and kapha_percentage <= 100.0),
  heart_rate_avg integer,
  temperature_avg numeric(4,2),
  steps_count integer default 0,
  sleep_duration_minutes integer default 0,
  water_intake_ml integer default 0,
  taste_profile_summary jsonb default '{}'::jsonb,
  explanation_summary jsonb default '{"aggravating":[],"pacifying":[]}'::jsonb,
  trend_alert text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint sum_percentage_check check (abs((vata_percentage + pitta_percentage + kapha_percentage) - 100.0) < 1.0),
  unique (user_id, date)
);

alter table public.daily_dosha_states enable row level security;
create policy "Users can manage their own daily dosha states."
  on public.daily_dosha_states for all
  using ((auth.jwt() ->> 'sub') = user_id);

-- =========================================================================
-- 7. METABOLIC ENGINES (AGNI & OJAS DAILY SCORES)
-- =========================================================================

-- Daily Agni (Digestive Fire) Scores
create table public.daily_agni_scores (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
  date date not null,
  agni_score numeric(5,2) not null check (agni_score >= 0.00 and agni_score <= 100.00),
  agni_state text not null check (agni_state in ('Weak', 'Moderate', 'Strong')),
  s_timing numeric(5,2) not null check (s_timing >= 0.00 and s_timing <= 100.00),
  s_diet numeric(5,2) not null check (s_diet >= 0.00 and s_diet <= 100.00),
  s_vitals numeric(5,2) not null check (s_vitals >= 0.00 and s_vitals <= 100.00),
  s_hydration numeric(5,2) not null check (s_hydration >= 0.00 and s_hydration <= 100.00),
  s_activity numeric(5,2) not null check (s_activity >= 0.00 and s_activity <= 100.00),
  s_sleep numeric(5,2) not null check (s_sleep >= 0.00 and s_sleep <= 100.00),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, date)
);

alter table public.daily_agni_scores enable row level security;
create policy "Users can manage their own Agni scores"
  on public.daily_agni_scores for all
  using ((auth.jwt() ->> 'sub') = user_id);

-- Daily Ojas (Immunity & Vitality) Scores
create table public.daily_ojas_scores (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
  date date not null,
  ojas_score numeric(5,2) not null check (ojas_score >= 0.00 and ojas_score <= 100.00),
  ojas_state text not null check (ojas_state in ('Low Ojas', 'Moderate Ojas', 'High Ojas')),
  s_sleep numeric(5,2) not null check (s_sleep >= 0.00 and s_sleep <= 100.00),
  s_recovery numeric(5,2) not null check (s_recovery >= 0.00 and s_recovery <= 100.00),
  s_rhr numeric(5,2) not null check (s_rhr >= 0.00 and s_rhr <= 100.00),
  s_activity numeric(5,2) not null check (s_activity >= 0.00 and s_activity <= 100.00),
  s_nutrition numeric(5,2) not null check (s_nutrition >= 0.00 and s_nutrition <= 100.00),
  s_hydration numeric(5,2) not null check (s_hydration >= 0.00 and s_hydration <= 100.00),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, date)
);

alter table public.daily_ojas_scores enable row level security;
create policy "Users can manage their own Ojas scores"
  on public.daily_ojas_scores for all
  using ((auth.jwt() ->> 'sub') = user_id);

-- =========================================================================
-- 8. DYNAMIC DINACHARYA (ROUTINE RECOMMENDATIONS & COMPLETIONS)
-- =========================================================================

-- Circadian Recommendations
create table public.dinacharya_recommendations (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
  date date not null,
  wake_up_rec text not null,
  hydration_rec text not null,
  meal_timing_rec text not null,
  exercise_timing_rec text not null,
  sleep_timing_rec text not null,
  meta_inputs jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, date)
);

alter table public.dinacharya_recommendations enable row level security;
create policy "Users can manage their own Dinacharya recommendations"
  on public.dinacharya_recommendations for all
  using ((auth.jwt() ->> 'sub') = user_id);

-- Circadian Completions Status
create table public.dinacharya_completions (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
  date date not null,
  task_key text not null,
  completed boolean default false not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, date, task_key)
);

alter table public.dinacharya_completions enable row level security;
create policy "Users can manage their own Dinacharya completions"
  on public.dinacharya_completions for all
  using ((auth.jwt() ->> 'sub') = user_id);

-- =========================================================================
-- 9. SENSOR STREAMS & REALTIME FOR SIMULATOR
-- =========================================================================

create table public.sensor_streams (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  heart_rate integer not null,
  skin_temperature numeric(4,2) not null,
  steps integer not null,
  activity text not null
);

alter table public.sensor_streams enable row level security;
create policy "Users can manage their own sensor streams."
  on public.sensor_streams for all
  using ((auth.jwt() ->> 'sub') = user_id);

-- Add to Realtime publication
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

-- =========================================================================
-- 10. INDEXES FOR QUERY OPTIMIZATION
-- =========================================================================

create index if not exists idx_hr_user_time on public.heart_rate_logs (user_id, timestamp desc);
create index if not exists idx_temp_user_time on public.temperature_logs (user_id, timestamp desc);
create index if not exists idx_act_user_time on public.activity_logs (user_id, timestamp desc);
create index if not exists idx_sleep_user_time on public.sleep_logs (user_id, start_time desc);
create index if not exists idx_food_user_time on public.food_logs (user_id, timestamp desc);
create index if not exists idx_insights_user_time on public.ai_insights (user_id, timestamp desc);
create index if not exists idx_chat_user_time on public.chat_history (user_id, timestamp desc);
create index if not exists idx_hydration_user_time on public.hydration_logs (user_id, timestamp desc);
create index if not exists idx_dosha_user_time on public.dosha_assessments (user_id, timestamp desc);
create index if not exists idx_dosha_user_date on public.daily_dosha_states (user_id, date desc);
create index if not exists idx_agni_user_date on public.daily_agni_scores (user_id, date desc);
create index if not exists idx_ojas_user_date on public.daily_ojas_scores (user_id, date desc);
create index if not exists idx_dinacharya_user_date on public.dinacharya_recommendations (user_id, date desc);
create index if not exists idx_dinacharya_completions_user_date on public.dinacharya_completions (user_id, date);
create index if not exists idx_med_conditions_user on public.medical_conditions (user_id);
create index if not exists idx_allergies_user on public.allergies (user_id);
create index if not exists idx_goals_user on public.health_goals (user_id);

-- =========================================================================
-- 11. STORAGE BUCKETS CONFIGURATION (Supabase Storage RLS Setup)
-- =========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values 
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('health_reports', 'health_reports', false, 10485760, array['application/pdf']),
  ('meals', 'meals', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "Users can upload their own avatars" on storage.objects;
create policy "Users can upload their own avatars"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars' 
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

drop policy if exists "Users can view all public avatars" on storage.objects;
create policy "Users can view all public avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can delete their own avatars" on storage.objects;
create policy "Users can delete their own avatars"
  on storage.objects for delete
  using (
    bucket_id = 'avatars' 
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

drop policy if exists "Users can manage their own health report files" on storage.objects;
create policy "Users can manage their own health report files"
  on storage.objects for all
  using (
    bucket_id = 'health_reports' 
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

drop policy if exists "Users can upload their own meal photos" on storage.objects;
create policy "Users can upload their own meal photos"
  on storage.objects for insert
  with check (
    bucket_id = 'meals' 
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

drop policy if exists "Users can view all public meal photos" on storage.objects;
create policy "Users can view all public meal photos"
  on storage.objects for select
  using (bucket_id = 'meals');

drop policy if exists "Users can delete their own meal photos" on storage.objects;
create policy "Users can delete their own meal photos"
  on storage.objects for delete
  using (
    bucket_id = 'meals' 
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );
