-- Supabase Dinacharya Recommendation Engine Database Migration
-- Execute this script in your Supabase SQL Editor to support dynamic daily routine recommendations.

-- 1. Create public.dinacharya_recommendations table
create table if not exists public.dinacharya_recommendations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
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

-- 2. Enable Row Level Security (RLS)
alter table public.dinacharya_recommendations enable row level security;

-- 3. Create RLS Policies
drop policy if exists "Users can manage their own Dinacharya recommendations" on public.dinacharya_recommendations;
create policy "Users can manage their own Dinacharya recommendations"
  on public.dinacharya_recommendations for all
  using (auth.uid() = user_id);

-- 4. Create search index optimized for sorting by date desc
create index if not exists idx_dinacharya_user_date on public.dinacharya_recommendations (user_id, date desc);
