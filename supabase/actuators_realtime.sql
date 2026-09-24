-- Live actuator sync (web + iOS Realtime) for switches and sliders.
-- Run in Supabase SQL Editor. Idempotent.

alter table public.actuator_switches replica identity full;
alter table public.actuator_sliders replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.actuator_switches;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'supabase_realtime publication missing — enable Realtime in Dashboard';
end $$;

do $$
begin
  alter publication supabase_realtime add table public.actuator_sliders;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'supabase_realtime publication missing — enable Realtime in Dashboard';
end $$;
