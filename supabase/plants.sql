-- Plants: workspace grouping for devices + production-line graph.
-- Additive / idempotent. Run in Supabase SQL Editor after schema.sql.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.plants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plants_owner_idx on public.plants (owner_id);

drop trigger if exists plants_set_updated_at on public.plants;
create trigger plants_set_updated_at
  before update on public.plants
  for each row execute function public.set_updated_at();

-- Nullable first so we can backfill existing rows.
alter table public.devices
  add column if not exists plant_id uuid references public.plants (id) on delete restrict;

create index if not exists devices_plant_idx on public.devices (plant_id);

create table if not exists public.plant_connections (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants (id) on delete cascade,
  source_device_id uuid not null references public.devices (id) on delete cascade,
  target_device_id uuid not null references public.devices (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (plant_id, source_device_id, target_device_id),
  check (source_device_id <> target_device_id)
);

create index if not exists plant_connections_plant_idx
  on public.plant_connections (plant_id);

create table if not exists public.plant_node_layouts (
  plant_id uuid not null references public.plants (id) on delete cascade,
  device_id uuid not null references public.devices (id) on delete cascade,
  x double precision not null default 0,
  y double precision not null default 0,
  updated_at timestamptz not null default now(),
  primary key (plant_id, device_id)
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.user_owns_plant(p_plant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.plants p
    where p.id = p_plant_id and p.owner_id = auth.uid()
  );
$$;

create or replace function public.ensure_my_default_plant()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_plant_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_plant_id
  from public.plants
  where owner_id = v_uid
  order by created_at asc
  limit 1;

  if v_plant_id is null then
    insert into public.plants (owner_id, name)
    values (v_uid, 'My plant')
    returning id into v_plant_id;
  end if;

  return v_plant_id;
end;
$$;

grant execute on function public.ensure_my_default_plant() to authenticated;

-- Backfill: one default plant per user that owns devices (or any user with none yet when they call ensure).
do $$
declare
  r record;
  v_plant uuid;
begin
  for r in
    select distinct owner_id from public.devices
  loop
    select id into v_plant
    from public.plants
    where owner_id = r.owner_id
    order by created_at asc
    limit 1;

    if v_plant is null then
      insert into public.plants (owner_id, name)
      values (r.owner_id, 'My plant')
      returning id into v_plant;
    end if;

    update public.devices
    set plant_id = v_plant
    where owner_id = r.owner_id
      and plant_id is null;
  end loop;
end;
$$;

-- Enforce NOT NULL after backfill (devices without plant should not remain).
-- Orphans (no owner match) get a plant from ensure path; leftover nulls stay until owned.
update public.devices d
set plant_id = (
  select p.id from public.plants p
  where p.owner_id = d.owner_id
  order by p.created_at asc
  limit 1
)
where d.plant_id is null
  and exists (select 1 from public.plants p where p.owner_id = d.owner_id);

-- Only set NOT NULL if no nulls remain.
do $$
begin
  if not exists (select 1 from public.devices where plant_id is null) then
    alter table public.devices alter column plant_id set not null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Connection integrity
-- ---------------------------------------------------------------------------

create or replace function public.plant_connection_devices_in_plant()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.devices d
    where d.id = new.source_device_id and d.plant_id = new.plant_id
  ) then
    raise exception 'Source device is not in this plant';
  end if;
  if not exists (
    select 1 from public.devices d
    where d.id = new.target_device_id and d.plant_id = new.plant_id
  ) then
    raise exception 'Target device is not in this plant';
  end if;
  return new;
end;
$$;

drop trigger if exists plant_connections_check_devices on public.plant_connections;
create trigger plant_connections_check_devices
  before insert or update on public.plant_connections
  for each row execute function public.plant_connection_devices_in_plant();

create or replace function public.plant_layout_device_in_plant()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.devices d
    where d.id = new.device_id and d.plant_id = new.plant_id
  ) then
    raise exception 'Device is not in this plant';
  end if;
  return new;
end;
$$;

drop trigger if exists plant_node_layouts_check_device on public.plant_node_layouts;
create trigger plant_node_layouts_check_device
  before insert or update on public.plant_node_layouts
  for each row execute function public.plant_layout_device_in_plant();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.plants enable row level security;
alter table public.plant_connections enable row level security;
alter table public.plant_node_layouts enable row level security;

drop policy if exists "Plants readable by owner" on public.plants;
drop policy if exists "Plants insert by owner self" on public.plants;
drop policy if exists "Plants update by owner" on public.plants;
drop policy if exists "Plants delete by owner" on public.plants;

create policy "Plants readable by owner"
  on public.plants for select
  using (owner_id = auth.uid());

create policy "Plants insert by owner self"
  on public.plants for insert
  with check (owner_id = auth.uid());

create policy "Plants update by owner"
  on public.plants for update
  using (owner_id = auth.uid());

create policy "Plants delete by owner"
  on public.plants for delete
  using (owner_id = auth.uid());

drop policy if exists "Plant connections by plant owner" on public.plant_connections;
create policy "Plant connections by plant owner"
  on public.plant_connections for all
  using (public.user_owns_plant(plant_id))
  with check (public.user_owns_plant(plant_id));

drop policy if exists "Plant layouts by plant owner" on public.plant_node_layouts;
create policy "Plant layouts by plant owner"
  on public.plant_node_layouts for all
  using (public.user_owns_plant(plant_id))
  with check (public.user_owns_plant(plant_id));

-- ---------------------------------------------------------------------------
-- Plant CRUD RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_my_plant(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := trim(p_name);
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if v_name is null or v_name = '' then
    raise exception 'Plant name is required';
  end if;
  if char_length(v_name) > 80 then
    raise exception 'Plant name is too long';
  end if;

  insert into public.plants (owner_id, name)
  values (v_uid, v_name)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_my_plant(text) to authenticated;

create or replace function public.rename_my_plant(p_plant_id uuid, p_name text)
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
  if not public.user_owns_plant(p_plant_id) then
    raise exception 'Plant not found';
  end if;
  if v_name is null or v_name = '' then
    raise exception 'Plant name is required';
  end if;

  update public.plants set name = v_name where id = p_plant_id;
end;
$$;

grant execute on function public.rename_my_plant(uuid, text) to authenticated;

create or replace function public.delete_my_plant(p_plant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_other uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.user_owns_plant(p_plant_id) then
    raise exception 'Plant not found';
  end if;

  select count(*) into v_count
  from public.plants
  where owner_id = auth.uid();

  if v_count <= 1 then
    raise exception 'Cannot delete your only plant';
  end if;

  select id into v_other
  from public.plants
  where owner_id = auth.uid() and id <> p_plant_id
  order by created_at asc
  limit 1;

  -- Move devices to another plant so ON DELETE RESTRICT succeeds.
  update public.devices
  set plant_id = v_other
  where plant_id = p_plant_id;

  delete from public.plants where id = p_plant_id;
end;
$$;

grant execute on function public.delete_my_plant(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- create_my_device — require / default plant
-- ---------------------------------------------------------------------------

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

-- Keep 4-arg grant working for older clients (Postgres overloads).
grant execute on function public.create_my_device(
  public.device_type,
  text,
  text[],
  public.device_member_role
) to authenticated;

-- ---------------------------------------------------------------------------
-- Card snapshots (latest sensors per device)
-- ---------------------------------------------------------------------------

create or replace function public.device_card_snapshots(p_device_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb := '[]'::jsonb;
  v_id uuid;
  v_device record;
  v_metrics jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_device_ids is null then
    return v_result;
  end if;

  foreach v_id in array p_device_ids
  loop
    if not public.user_can_access_device(v_id) then
      continue;
    end if;

    select d.id, d.name, d.type, d.plant_id, d.updated_at
    into v_device
    from public.devices d
    where d.id = v_id;

    if not found then
      continue;
    end if;

    select coalesce(jsonb_agg(m order by m->>'name'), '[]'::jsonb)
    into v_metrics
    from (
      select distinct on (s.name)
        jsonb_build_object(
          'name', s.name,
          'value', s.value,
          'created_at', s.created_at
        ) as m
      from public.sensors s
      where s.device_id = v_id
      order by s.name, s.created_at desc
      limit 8
    ) q;

    v_result := v_result || jsonb_build_array(
      jsonb_build_object(
        'id', v_device.id,
        'name', v_device.name,
        'type', v_device.type,
        'plant_id', v_device.plant_id,
        'updated_at', v_device.updated_at,
        'metrics', coalesce(v_metrics, '[]'::jsonb)
      )
    );
  end loop;

  return v_result;
end;
$$;

grant execute on function public.device_card_snapshots(uuid[]) to authenticated;
