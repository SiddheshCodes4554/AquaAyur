-- Supabase Agni Score Engine Database Column Rename Migration
-- Execute this script in your Supabase SQL Editor to align your schema with the codebase.

do $$
declare
  r record;
begin
  -- 1. Rename columns if old columns exist. If both exist, merge data and drop the old column.
  
  -- timing_score -> s_timing
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='daily_agni_scores' and column_name='timing_score') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='daily_agni_scores' and column_name='s_timing') then
      alter table public.daily_agni_scores rename column timing_score to s_timing;
    else
      update public.daily_agni_scores set s_timing = coalesce(s_timing, timing_score);
      alter table public.daily_agni_scores drop column timing_score;
    end if;
  end if;

  -- diet_score -> s_diet
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='daily_agni_scores' and column_name='diet_score') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='daily_agni_scores' and column_name='s_diet') then
      alter table public.daily_agni_scores rename column diet_score to s_diet;
    else
      update public.daily_agni_scores set s_diet = coalesce(s_diet, diet_score);
      alter table public.daily_agni_scores drop column diet_score;
    end if;
  end if;

  -- vitals_score -> s_vitals
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='daily_agni_scores' and column_name='vitals_score') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='daily_agni_scores' and column_name='s_vitals') then
      alter table public.daily_agni_scores rename column vitals_score to s_vitals;
    else
      update public.daily_agni_scores set s_vitals = coalesce(s_vitals, vitals_score);
      alter table public.daily_agni_scores drop column vitals_score;
    end if;
  end if;

  -- hydration_score -> s_hydration
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='daily_agni_scores' and column_name='hydration_score') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='daily_agni_scores' and column_name='s_hydration') then
      alter table public.daily_agni_scores rename column hydration_score to s_hydration;
    else
      update public.daily_agni_scores set s_hydration = coalesce(s_hydration, hydration_score);
      alter table public.daily_agni_scores drop column hydration_score;
    end if;
  end if;

  -- activity_score -> s_activity
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='daily_agni_scores' and column_name='activity_score') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='daily_agni_scores' and column_name='s_activity') then
      alter table public.daily_agni_scores rename column activity_score to s_activity;
    else
      update public.daily_agni_scores set s_activity = coalesce(s_activity, activity_score);
      alter table public.daily_agni_scores drop column activity_score;
    end if;
  end if;

  -- sleep_score -> s_sleep
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='daily_agni_scores' and column_name='sleep_score') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='daily_agni_scores' and column_name='s_sleep') then
      alter table public.daily_agni_scores rename column sleep_score to s_sleep;
    else
      update public.daily_agni_scores set s_sleep = coalesce(s_sleep, sleep_score);
      alter table public.daily_agni_scores drop column sleep_score;
    end if;
  end if;

  -- 2. Ensure columns exist as numeric(5,2) in case they are missing completely
  alter table public.daily_agni_scores add column if not exists s_timing numeric(5,2);
  alter table public.daily_agni_scores add column if not exists s_diet numeric(5,2);
  alter table public.daily_agni_scores add column if not exists s_vitals numeric(5,2);
  alter table public.daily_agni_scores add column if not exists s_hydration numeric(5,2);
  alter table public.daily_agni_scores add column if not exists s_activity numeric(5,2);
  alter table public.daily_agni_scores add column if not exists s_sleep numeric(5,2);

  -- 3. Drop all check constraints dynamically to avoid conflict during alteration
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

  -- 4. Set fallback values for any existing NULL scores in component columns
  update public.daily_agni_scores set s_timing = 75.00 where s_timing is null;
  update public.daily_agni_scores set s_diet = 75.00 where s_diet is null;
  update public.daily_agni_scores set s_vitals = 70.00 where s_vitals is null;
  update public.daily_agni_scores set s_hydration = 100.00 where s_hydration is null;
  update public.daily_agni_scores set s_activity = 100.00 where s_activity is null;
  update public.daily_agni_scores set s_sleep = 75.00 where s_sleep is null;

  -- 5. Data Repair: Ensure agni_state contains valid values only
  update public.daily_agni_scores 
  set agni_state = 'Moderate' 
  where agni_state is null or agni_state not in ('Weak', 'Moderate', 'Strong');

  -- Ensure agni_score is within [0, 100] bounds
  update public.daily_agni_scores 
  set agni_score = 70.00 
  where agni_score is null or agni_score < 0.00 or agni_score > 100.00;

  -- Ensure component scores are within [0, 100] bounds
  update public.daily_agni_scores set s_timing = greatest(0.00, least(100.00, s_timing)) where s_timing < 0.00 or s_timing > 100.00;
  update public.daily_agni_scores set s_diet = greatest(0.00, least(100.00, s_diet)) where s_diet < 0.00 or s_diet > 100.00;
  update public.daily_agni_scores set s_vitals = greatest(0.00, least(100.00, s_vitals)) where s_vitals < 0.00 or s_vitals > 100.00;
  update public.daily_agni_scores set s_hydration = greatest(0.00, least(100.00, s_hydration)) where s_hydration < 0.00 or s_hydration > 100.00;
  update public.daily_agni_scores set s_activity = greatest(0.00, least(100.00, s_activity)) where s_activity < 0.00 or s_activity > 100.00;
  update public.daily_agni_scores set s_sleep = greatest(0.00, least(100.00, s_sleep)) where s_sleep < 0.00 or s_sleep > 100.00;

  -- 6. Alter columns to correct decimal types and enforce NOT NULL
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

  -- 7. Add updated check constraints
  alter table public.daily_agni_scores
    add constraint daily_agni_scores_agni_score_check check (agni_score >= 0.00 and agni_score <= 100.00),
    add constraint daily_agni_scores_agni_state_check check (agni_state in ('Weak', 'Moderate', 'Strong')),
    add constraint daily_agni_scores_s_timing_check check (s_timing >= 0.00 and s_timing <= 100.00),
    add constraint daily_agni_scores_s_diet_check check (s_diet >= 0.00 and s_diet <= 100.00),
    add constraint daily_agni_scores_s_vitals_check check (s_vitals >= 0.00 and s_vitals <= 100.00),
    add constraint daily_agni_scores_s_hydration_check check (s_hydration >= 0.00 and s_hydration <= 100.00),
    add constraint daily_agni_scores_s_activity_check check (s_activity >= 0.00 and s_activity <= 100.00),
    add constraint daily_agni_scores_s_sleep_check check (s_sleep >= 0.00 and s_sleep <= 100.00);

  -- 8. Force PostgREST to reload its schema cache
  execute 'NOTIFY pgrst, ''reload schema''';

exception
  when others then
    raise exception 'Agni column rename migration failed: %', SQLERRM;
end $$;
