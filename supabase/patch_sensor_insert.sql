-- Run in Supabase SQL Editor if schema.sql was already applied earlier.
create policy "Sensors insert by authenticated"
  on public.sensors for insert
  to authenticated
  with check (true);
