-- =========================================================================
-- CREATE SENSOR STREAMS TABLE FOR SIMULATOR REALTIME
-- =========================================================================

create table if not exists public.sensor_streams (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  heart_rate integer not null,
  skin_temperature numeric(4,2) not null,
  steps integer not null,
  activity text not null
);

-- Enable RLS
alter table public.sensor_streams enable row level security;

-- Policy for managing sensor streams
create policy "Users can manage their own sensor streams."
  on public.sensor_streams for all
  using (auth.uid() = user_id);

-- Enable Realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_rel pr
    join pg_publication p on pr.prpubid = p.oid
    join pg_class c on pr.prrelid = c.oid
    join pg_namespace n on c.relnamespace = n.oid
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'sensor_streams'
  ) then
    alter publication supabase_realtime add table public.sensor_streams;
  end if;
exception
  when others then
    null;
end $$;
