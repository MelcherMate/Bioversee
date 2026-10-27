-- Pipe fittings on the blueprint: new device type + handle-aware connections.
-- Idempotent. Run after plants.sql.

-- ---------------------------------------------------------------------------
-- device_type: pipe_fitting
-- ---------------------------------------------------------------------------

do $$
begin
  alter type public.device_type add value if not exists 'pipe_fitting';
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- plant_connections: per-handle endpoints
-- ---------------------------------------------------------------------------

alter table public.plant_connections
  add column if not exists source_handle text;

alter table public.plant_connections
  add column if not exists target_handle text;

update public.plant_connections
set source_handle = 'outlet'
where source_handle is null;

update public.plant_connections
set target_handle = 'inlet'
where target_handle is null;

alter table public.plant_connections
  alter column source_handle set default 'outlet';

alter table public.plant_connections
  alter column target_handle set default 'inlet';

alter table public.plant_connections
  alter column source_handle set not null;

alter table public.plant_connections
  alter column target_handle set not null;

alter table public.plant_connections
  drop constraint if exists plant_connections_plant_id_source_device_id_target_device_id_key;

alter table public.plant_connections
  drop constraint if exists plant_connections_unique_pair;

do $$
begin
  alter table public.plant_connections
    add constraint plant_connections_unique_handles
    unique (plant_id, source_device_id, source_handle, target_device_id, target_handle);
exception
  when duplicate_object then null;
end $$;
