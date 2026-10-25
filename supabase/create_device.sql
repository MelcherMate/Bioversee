-- Additive: create a named device owned by the caller, with optional member invites.
-- Prefer plants.sql for the full plant-aware version; this file stays in sync.
-- Run after notifications.sql (and plants.sql for plant helpers). Idempotent.

create or replace function public.create_my_device(
  p_type public.device_type,
  p_name text,
  p_member_emails text[] default '{}',
  p_member_role public.device_member_role default 'viewer',
  p_plant_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_device_id uuid;
  v_name text := trim(p_name);
  v_email text;
  v_invitee uuid;
  v_plant uuid := p_plant_id;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if v_name is null or v_name = '' then
    raise exception 'Device name is required';
  end if;

  if char_length(v_name) > 80 then
    raise exception 'Device name is too long';
  end if;

  if p_member_role not in ('admin', 'operator', 'viewer') then
    raise exception 'Invalid member role';
  end if;

  if v_plant is null then
    v_plant := public.ensure_my_default_plant();
  elsif not public.user_owns_plant(v_plant) then
    raise exception 'Plant not found';
  end if;

  insert into public.devices (owner_id, type, name, plant_id)
  values (v_uid, p_type, v_name, v_plant)
  returning id into v_device_id;

  insert into public.device_members (device_id, user_id, role)
  values (v_device_id, v_uid, 'owner');

  if p_member_emails is not null then
    foreach v_email in array p_member_emails
    loop
      v_email := lower(trim(v_email));
      if v_email = '' then
        continue;
      end if;

      select id into v_invitee
      from auth.users
      where lower(email) = v_email
      limit 1;

      if v_invitee is null then
        raise exception 'No Bioversee account found for %', v_email;
      end if;

      if v_invitee = v_uid then
        continue;
      end if;

      perform public.create_pending_device_invite_as(
        v_device_id,
        v_invitee,
        v_uid,
        p_member_role,
        null
      );
    end loop;
  end if;

  return v_device_id;
end;
$$;

grant execute on function public.create_my_device(
  public.device_type,
  text,
  text[],
  public.device_member_role,
  uuid
) to authenticated;

grant execute on function public.create_my_device(
  public.device_type,
  text,
  text[],
  public.device_member_role
) to authenticated;
