-- Live device list sync (web + iOS Realtime).
-- Run in Supabase SQL Editor. Idempotent.
-- Also run device_members_select_for_realtime.sql so leave/DELETE events deliver.

alter table public.devices replica identity full;
alter table public.device_members replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.devices;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'supabase_realtime publication missing — enable Realtime in Dashboard';
end $$;

do $$
begin
  alter publication supabase_realtime add table public.device_members;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'supabase_realtime publication missing — enable Realtime in Dashboard';
end $$;
