-- Supabase Health Reports check Constraint Update
-- Execute this script in your Supabase SQL Editor to support Daily, Weekly, and Monthly diagnostic reports.

-- 1. Drop existing check constraint if it exists
alter table public.health_reports 
  drop constraint if exists health_reports_report_type_check;

-- 2. Register the updated check constraint supporting 'daily' reports
alter table public.health_reports 
  add constraint health_reports_report_type_check 
  check (report_type in ('daily', 'weekly', 'monthly'));

-- 3. Add columns to store Health Score, Wellness Score, and aggregated Meta Stats
alter table public.health_reports
  add column if not exists health_score integer default 0,
  add column if not exists wellness_score integer default 0,
  add column if not exists meta_stats jsonb default '{}'::jsonb;
