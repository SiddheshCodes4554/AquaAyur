-- Supabase Dosha Assessments Migration
-- Execute this script in your Supabase SQL Editor to support Prakriti/Vikriti tracking over time.

-- 1. Create the dosha_assessments table
create table if not exists public.dosha_assessments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  vata_score integer not null check (vata_score >= 0),
  pitta_score integer not null check (pitta_score >= 0),
  kapha_score integer not null check (kapha_score >= 0),
  vata_percentage numeric(5,2) not null check (vata_percentage >= 0.0 and vata_percentage <= 100.0),
  pitta_percentage numeric(5,2) not null check (pitta_percentage >= 0.0 and pitta_percentage <= 100.0),
  kapha_percentage numeric(5,2) not null check (kapha_percentage >= 0.0 and kapha_percentage <= 100.0),
  result_dosha text not null check (result_dosha in ('vata', 'pitta', 'kapha', 'dual_vata_pitta', 'dual_pitta_kapha', 'dual_vata_kapha', 'tridoshic'))
);

-- 2. Enable Row Level Security (RLS)
alter table public.dosha_assessments enable row level security;

-- 3. Set up RLS policies for CRUD operations
create policy "Users can manage their own dosha assessments."
  on public.dosha_assessments for all
  using (auth.uid() = user_id);

create policy "Users can insert their own dosha assessments."
  on public.dosha_assessments for insert
  with check (auth.uid() = user_id);

-- 4. Create search indexes for quick aggregation queries
create index if not exists idx_dosha_user_time on public.dosha_assessments (user_id, timestamp desc);
