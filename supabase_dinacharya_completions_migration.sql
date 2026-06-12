-- Supabase Dinacharya Completions Database Migration
-- Execute this script in your Supabase SQL Editor to support tracking daily routine completions.

-- 1. Create public.dinacharya_completions table
create table if not exists public.dinacharya_completions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  task_key text not null, -- 'wake_up', 'hydration', 'meal_timing', 'exercise_timing', 'sleep_timing'
  completed boolean default false not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, date, task_key)
);

-- 2. Enable Row Level Security (RLS)
alter table public.dinacharya_completions enable row level security;

-- 3. Create RLS Policies
drop policy if exists "Users can manage their own Dinacharya completions" on public.dinacharya_completions;
create policy "Users can manage their own Dinacharya completions"
  on public.dinacharya_completions for all
  using (auth.uid() = user_id);

-- 4. Create index for fast lookups by user and date
create index if not exists idx_dinacharya_completions_user_date on public.dinacharya_completions (user_id, date);
