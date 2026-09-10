-- Allow authenticated users to permanently delete their own account.
-- Cascades to profiles, owned devices, memberships, settings, etc.
-- Idempotent. Run in Supabase SQL editor.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Drop owned devices first (members / telemetry cascade from devices).
  delete from public.devices
  where owner_id = uid;

  -- Remove auth user; public.profiles and related rows cascade from auth.users.
  delete from auth.users
  where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
