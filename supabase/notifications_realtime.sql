-- Enable live inbox sync (web + iOS Realtime).
-- Run in Supabase SQL Editor. Idempotent.

-- DELETE events need full row for user_id filter.
alter table public.notifications replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then
    null;
  when undefined_object then
    raise notice 'supabase_realtime publication missing — enable Realtime in Dashboard';
end $$;
