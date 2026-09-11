-- Self-service account deletion with optional owned-device cleanup.
-- Default: keep owned devices by transferring ownership to another member
-- when possible; sole-owner devices with no other members are still removed.
-- Idempotent. Run in Supabase SQL editor.

create or replace function public.delete_my_account(
  p_delete_owned_devices boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rec record;
  new_owner uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_delete_owned_devices then
    delete from public.devices
    where owner_id = uid;
  else
    for rec in
      select d.id
      from public.devices d
      where d.owner_id = uid
    loop
      select m.user_id
      into new_owner
      from public.device_members m
      where m.device_id = rec.id
        and m.user_id <> uid
      order by
        case m.role
          when 'admin' then 1
          when 'operator' then 2
          when 'viewer' then 3
          else 4
        end,
        m.created_at asc
      limit 1;

      if new_owner is null then
        delete from public.devices where id = rec.id;
      else
        update public.devices
        set owner_id = new_owner
        where id = rec.id;

        update public.device_members
        set role = 'owner'
        where device_id = rec.id
          and user_id = new_owner;
      end if;
    end loop;
  end if;

  -- Remove auth user; profile, memberships, settings, notifications cascade.
  delete from auth.users
  where id = uid;
end;
$$;

revoke all on function public.delete_my_account(boolean) from public;
grant execute on function public.delete_my_account(boolean) to authenticated;

-- Drop zero-arg overload if it still exists from earlier migrations.
drop function if exists public.delete_my_account();
