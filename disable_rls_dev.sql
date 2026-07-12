-- AquaAyur Development Script: Bypass/Disable RLS
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- to resolve "violates row-level security policy" errors during development.

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lifestyle DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.allergies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_conditions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_preferences DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_goals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pairings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.heart_rate_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.temperature_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleep_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.hydration_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_analysis DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dosha_assessments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_dosha_states DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_agni_scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_ojas_scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dinacharya_recommendations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dinacharya_completions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensor_streams DISABLE ROW LEVEL SECURITY;

-- 12. STORAGE OBJECTS RLS BYPASS
-- Creates a permissive wildcard policy allowing all reads/writes in development
-- (bypasses owner restriction issues).
drop policy if exists "Wildcard storage objects access" on storage.objects;
create policy "Wildcard storage objects access"
  on storage.objects for all
  using (true)
  with check (true);

-- Output confirmation
SELECT 'RLS successfully disabled for all telemetry, diagnostic, and storage tables. Your mobile app can now sync data.' as status;
