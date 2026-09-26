-- Additive: per-device JSON config (geometry, etc.).
-- Safe after schema.sql / device_manage.sql. Idempotent.

alter table public.devices
  add column if not exists config jsonb not null default '{}'::jsonb;

comment on column public.devices.config is
  'Type-specific device configuration (e.g. bioreactor geometry).';

create or replace function public.update_my_device_config(
  p_device_id uuid,
  p_config jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_merged jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_config is null or jsonb_typeof(p_config) <> 'object' then
    raise exception 'Config must be a JSON object';
  end if;

  if not public.user_can_admin_device(p_device_id) then
    raise exception 'Not allowed to update this device config';
  end if;

  update public.devices
  set config = coalesce(config, '{}'::jsonb) || p_config
  where id = p_device_id
  returning config into v_merged;

  if v_merged is null then
    raise exception 'Device not found';
  end if;

  return v_merged;
end;
$$;

grant execute on function public.update_my_device_config(uuid, jsonb) to authenticated;
