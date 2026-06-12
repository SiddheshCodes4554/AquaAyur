-- Supabase Ojas Score Engine Database Migration
-- Execute this script in your Supabase SQL Editor to support daily Ojas score tracking.

-- 1. Create public.daily_ojas_scores table
create table if not exists public.daily_ojas_scores (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
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

-- 2. Enable Row Level Security (RLS)
alter table public.daily_ojas_scores enable row level security;

-- 3. Create RLS Policies
drop policy if exists "Users can manage their own Ojas scores" on public.daily_ojas_scores;
create policy "Users can manage their own Ojas scores"
  on public.daily_ojas_scores for all
  using (auth.uid() = user_id);

-- 4. Create search index optimized for sorting by date desc
create index if not exists idx_ojas_user_date on public.daily_ojas_scores (user_id, date desc);

-- 5. Dynamic Schema Migration: If the table already existed with the old check constraints, update data and constraint.
do $$
begin
  -- Update existing rows in daily_ojas_scores table to translate old values to new category names
  update public.daily_ojas_scores
  set ojas_state = case 
    when ojas_state = 'Weak' then 'Low Ojas'
    when ojas_state = 'Moderate' then 'Moderate Ojas'
    when ojas_state = 'Strong' then 'High Ojas'
    else ojas_state
  end;

  -- Drop old check constraint and add the new one
  alter table public.daily_ojas_scores drop constraint if exists daily_ojas_scores_ojas_state_check;
  alter table public.daily_ojas_scores add constraint daily_ojas_scores_ojas_state_check check (ojas_state in ('Low Ojas', 'Moderate Ojas', 'High Ojas'));
exception
  when others then
    raise notice 'Dynamic constraint update skipped or failed: %', SQLERRM;
end $$;

