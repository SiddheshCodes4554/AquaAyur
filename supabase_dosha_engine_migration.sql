-- AquaAyur Dynamic Dosha Engine DB Schema
-- SQL DDL Migration for Dynamic Dosha States

CREATE TABLE IF NOT EXISTS public.daily_dosha_states (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  vata_percentage numeric(5,2) NOT NULL CHECK (vata_percentage >= 0.0 AND vata_percentage <= 100.0),
  pitta_percentage numeric(5,2) NOT NULL CHECK (pitta_percentage >= 0.0 AND pitta_percentage <= 100.0),
  kapha_percentage numeric(5,2) NOT NULL CHECK (kapha_percentage >= 0.0 AND kapha_percentage <= 100.0),
  heart_rate_avg integer,
  temperature_avg numeric(4,2),
  steps_count integer DEFAULT 0,
  sleep_duration_minutes integer DEFAULT 0,
  water_intake_ml integer DEFAULT 0,
  taste_profile_summary jsonb DEFAULT '{}'::jsonb,
  explanation_summary jsonb DEFAULT '{"aggravating":[],"pacifying":[]}'::jsonb,
  trend_alert text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT sum_percentage_check CHECK (abs((vata_percentage + pitta_percentage + kapha_percentage) - 100.0) < 1.0),
  UNIQUE (user_id, date)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.daily_dosha_states ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists and create
DROP POLICY IF EXISTS "Users can manage their own daily dosha states." ON public.daily_dosha_states;
CREATE POLICY "Users can manage their own daily dosha states."
  ON public.daily_dosha_states FOR ALL
  USING (auth.uid() = user_id);

-- Performance Search Index
CREATE INDEX IF NOT EXISTS idx_dosha_user_date ON public.daily_dosha_states (user_id, date DESC);

-- Alter table commands to safely append columns to pre-existing tables in target Supabase instance
ALTER TABLE public.daily_dosha_states ADD COLUMN IF NOT EXISTS explanation_summary jsonb DEFAULT '{"aggravating":[],"pacifying":[]}'::jsonb;
ALTER TABLE public.daily_dosha_states ADD COLUMN IF NOT EXISTS trend_alert text;
