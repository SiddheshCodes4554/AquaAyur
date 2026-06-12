-- 1. Profiles Table (extends Supabase Auth)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  full_name text,
  birth_date date,
  gender text check (gender in ('male', 'female', 'other', 'prefer_not_to_say')),
  weight_kg numeric(5,2),
  height_cm numeric(5,2),
  dominant_dosha text check (dominant_dosha in ('vata', 'pitta', 'kapha', 'dual_vata_pitta', 'dual_pitta_kapha', 'dual_vata_kapha', 'tridoshic')),
  daily_water_goal_ml integer default 2500 not null
);

alter table public.profiles enable row level security;

create policy "Users can view and edit their own profile." on public.profiles
  for all using (auth.uid() = id);

-- 2. Telemetry Logs Table
create table if not exists public.telemetry_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  timestamp timestamp with time zone not null,
  heart_rate integer not null,
  skin_temperature numeric(4,2) not null,
  accel_x integer not null,
  accel_y integer not null,
  step_count integer default 0 not null
);

create index if not exists telemetry_logs_user_timestamp_idx on public.telemetry_logs (user_id, timestamp desc);
alter table public.telemetry_logs enable row level security;

create policy "Users can access their own telemetry logs." on public.telemetry_logs
  for all using (auth.uid() = user_id);

create policy "Users can insert their own telemetry logs." on public.telemetry_logs
  for insert with check (auth.uid() = user_id);

-- 3. Hydration Logs Table
create table if not exists public.hydration_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  amount_ml integer not null,
  source text default 'manual'::text check (source in ('manual', 'wearable_alert', 'ai_recommendation'))
);

create index if not exists hydration_logs_user_timestamp_idx on public.hydration_logs (user_id, timestamp desc);
alter table public.hydration_logs enable row level security;

create policy "Users can manage their own hydration logs." on public.hydration_logs
  for all using (auth.uid() = user_id);

create policy "Users can insert their own hydration logs." on public.hydration_logs
  for insert with check (auth.uid() = user_id);

-- 4. AI Recommendations Table
create table if not exists public.ai_recommendations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  biometrics_snapshot jsonb not null, -- { avg_heart_rate, avg_temp, activity_level }
  recommendation_text text not null,
  ayurvedic_insights text not null,
  feedback_rating integer check (feedback_rating in (1, -1)) -- thumbs up/down
);

create index if not exists ai_recs_user_timestamp_idx on public.ai_recommendations (user_id, timestamp desc);
alter table public.ai_recommendations enable row level security;

create policy "Users can view and rate their own AI recommendations." on public.ai_recommendations
  for all using (auth.uid() = user_id);

create policy "Users can insert their own AI recommendations." on public.ai_recommendations
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own AI recommendations." on public.ai_recommendations
  for update using (auth.uid() = user_id);

-- 5. Trigger to automatically create a profile after signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, daily_water_goal_ml)
  values (new.id, new.raw_user_meta_data->>'full_name', 2500);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
