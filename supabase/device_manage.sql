-- Additive: delete / rename owned devices.
-- Safe after create_device.sql. Idempotent.

create or replace function public.delete_my_device(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.devices d
    where d.id = p_device_id
      and d.owner_id = auth.uid()
  ) then
    raise exception 'Only the owner can delete this device';
  end if;

  delete from public.devices where id = p_device_id;
end;
$$;

create or replace function public.rename_my_device(
  p_device_id uuid,
  p_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(p_name);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if v_name is null or v_name = '' then
    raise exception 'Device name is required';
  end if;

  if char_length(v_name) > 80 then
    raise exception 'Device name is too long';
  end if;

  if not public.user_can_admin_device(p_device_id) then
    raise exception 'Not allowed to rename this device';
  end if;

  update public.devices
  set name = v_name
  where id = p_device_id;
end;
$$;

create or replace function public.leave_device(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if exists (
    select 1 from public.devices
    where id = p_device_id and owner_id = auth.uid()
  ) then
    raise exception 'Owners cannot leave — delete the device instead';
  end if;

  delete from public.device_members
  where device_id = p_device_id
    and user_id = auth.uid();
end;
$$;

grant execute on function public.delete_my_device(uuid) to authenticated;
grant execute on function public.rename_my_device(uuid, text) to authenticated;
grant execute on function public.leave_device(uuid) to authenticated;
