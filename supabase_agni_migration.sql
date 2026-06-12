-- Supabase Agni Score Engine Database Migration
-- Execute this script in your Supabase SQL Editor to support daily Agni score tracking.

-- 1. Create public.daily_agni_scores table
create table if not exists public.daily_agni_scores (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
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

-- 2. Enable Row Level Security (RLS)
alter table public.daily_agni_scores enable row level security;

-- 3. Create RLS Policies
drop policy if exists "Users can manage their own Agni scores" on public.daily_agni_scores;
create policy "Users can manage their own Agni scores"
  on public.daily_agni_scores for all
  using (auth.uid() = user_id);

-- 4. Create search index optimized for sorting by date desc
create index if not exists idx_agni_user_date on public.daily_agni_scores (user_id, date desc);

-- 5. Dynamic Schema Migration: If the table already existed with the old column names, rename them and update constraints.
do $$
declare
  r record;
begin
  -- Rename columns if old columns exist
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='daily_agni_scores' and column_name='timing_score') then
    alter table public.daily_agni_scores rename column timing_score to s_timing;
  end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='daily_agni_scores' and column_name='diet_score') then
    alter table public.daily_agni_scores rename column diet_score to s_diet;
  end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='daily_agni_scores' and column_name='vitals_score') then
    alter table public.daily_agni_scores rename column vitals_score to s_vitals;
  end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='daily_agni_scores' and column_name='hydration_score') then
    alter table public.daily_agni_scores rename column hydration_score to s_hydration;
  end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='daily_agni_scores' and column_name='activity_score') then
    alter table public.daily_agni_scores rename column activity_score to s_activity;
  end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='daily_agni_scores' and column_name='sleep_score') then
    alter table public.daily_agni_scores rename column sleep_score to s_sleep;
  end if;

  -- Ensure columns exist (in case the table existed but missed some columns completely)
  alter table public.daily_agni_scores add column if not exists s_timing numeric(5,2);
  alter table public.daily_agni_scores add column if not exists s_diet numeric(5,2);
  alter table public.daily_agni_scores add column if not exists s_vitals numeric(5,2);
  alter table public.daily_agni_scores add column if not exists s_hydration numeric(5,2);
  alter table public.daily_agni_scores add column if not exists s_activity numeric(5,2);
  alter table public.daily_agni_scores add column if not exists s_sleep numeric(5,2);

  -- Drop all check constraints dynamically to avoid duplicate or outdated constraint errors
  for r in (
    select con.conname 
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_namespace ns on ns.oid = cl.relnamespace
    where ns.nspname = 'public' 
      and cl.relname = 'daily_agni_scores' 
      and con.contype = 'c'
  ) loop
    execute 'alter table public.daily_agni_scores drop constraint if exists ' || quote_ident(r.conname);
  end loop;

  -- Alter columns to correct type and set NOT NULL
  alter table public.daily_agni_scores 
    alter column agni_score type numeric(5,2),
    alter column agni_score set not null,
    alter column s_timing type numeric(5,2),
    alter column s_timing set not null,
    alter column s_diet type numeric(5,2),
    alter column s_diet set not null,
    alter column s_vitals type numeric(5,2),
    alter column s_vitals set not null,
    alter column s_hydration type numeric(5,2),
    alter column s_hydration set not null,
    alter column s_activity type numeric(5,2),
    alter column s_activity set not null,
    alter column s_sleep type numeric(5,2),
    alter column s_sleep set not null;

  -- Add updated check constraints
  alter table public.daily_agni_scores
    add constraint daily_agni_scores_agni_score_check check (agni_score >= 0.00 and agni_score <= 100.00),
    add constraint daily_agni_scores_agni_state_check check (agni_state in ('Weak', 'Moderate', 'Strong')),
    add constraint daily_agni_scores_s_timing_check check (s_timing >= 0.00 and s_timing <= 100.00),
    add constraint daily_agni_scores_s_diet_check check (s_diet >= 0.00 and s_diet <= 100.00),
    add constraint daily_agni_scores_s_vitals_check check (s_vitals >= 0.00 and s_vitals <= 100.00),
    add constraint daily_agni_scores_s_hydration_check check (s_hydration >= 0.00 and s_hydration <= 100.00),
    add constraint daily_agni_scores_s_activity_check check (s_activity >= 0.00 and s_activity <= 100.00),
    add constraint daily_agni_scores_s_sleep_check check (s_sleep >= 0.00 and s_sleep <= 100.00);

exception
  when others then
    raise notice 'Dynamic schema migration for daily_agni_scores failed: %', SQLERRM;
end $$;

