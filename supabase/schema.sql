-- Bioversee Supabase schema — per-user devices
-- Destructive cutover: see wipe_and_migrate.sql / CUTOVER.md
-- Run in: Supabase Dashboard → SQL Editor

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Devices (one process instance; multi-instance ready)
-- ---------------------------------------------------------------------------

create type public.device_type as enum (
  'bioreactor',
  'pressure_vessel',
  'membrane_bioreactor',
  'water_purifier'
);

create type public.device_member_role as enum (
  'owner',
  'admin',
  'operator',
  'viewer'
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  type public.device_type not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists devices_owner_type_idx
  on public.devices (owner_id, type);

create table if not exists public.device_members (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.device_member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, user_id)
);

create index if not exists device_members_user_idx
  on public.device_members (user_id);

create table if not exists public.device_credentials (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  key_hash text not null,
  label text,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (device_id, key_hash)
);

-- ---------------------------------------------------------------------------
-- Actuators & sensors (device-scoped)
-- ---------------------------------------------------------------------------

create table if not exists public.actuator_sliders (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  name text not null,
  state numeric not null default 0,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists actuator_sliders_device_name_created_idx
  on public.actuator_sliders (device_id, name, created_at desc);

create table if not exists public.actuator_switches (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  name text not null,
  state boolean not null default false,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists actuator_switches_device_name_created_idx
  on public.actuator_switches (device_id, name, created_at desc);

create table if not exists public.sensors (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  name text not null,
  value numeric not null default 0,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sensors_device_name_created_idx
  on public.sensors (device_id, name, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists devices_set_updated_at on public.devices;
create trigger devices_set_updated_at
  before update on public.devices
  for each row execute function public.set_updated_at();

drop trigger if exists device_members_set_updated_at on public.device_members;
create trigger device_members_set_updated_at
  before update on public.device_members
  for each row execute function public.set_updated_at();

drop trigger if exists actuator_sliders_set_updated_at on public.actuator_sliders;
create trigger actuator_sliders_set_updated_at
  before update on public.actuator_sliders
  for each row execute function public.set_updated_at();

drop trigger if exists actuator_switches_set_updated_at on public.actuator_switches;
create trigger actuator_switches_set_updated_at
  before update on public.actuator_switches
  for each row execute function public.set_updated_at();

drop trigger if exists sensors_set_updated_at on public.sensors;
create trigger sensors_set_updated_at
  before update on public.sensors
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Access helpers (SECURITY DEFINER to avoid RLS recursion)
-- ---------------------------------------------------------------------------

create or replace function public.user_can_access_device(p_device_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.device_members m
    where m.device_id = p_device_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.user_can_operate_device(p_device_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.device_members m
    where m.device_id = p_device_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin', 'operator')
  );
$$;

create or replace function public.user_can_admin_device(p_device_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.device_members m
    where m.device_id = p_device_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- Provision four default devices for a user (idempotent)
-- ---------------------------------------------------------------------------

create or replace function public.ensure_user_devices(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  new_device_id uuid;
begin
  for rec in
    select *
    from (
      values
        ('bioreactor'::public.device_type, 'Bioreactor'),
        ('pressure_vessel'::public.device_type, 'Pressure Vessel'),
        ('membrane_bioreactor'::public.device_type, 'Membrane MBR'),
        ('water_purifier'::public.device_type, 'Water Purifier')
    ) as t(type, name)
  loop
    if not exists (
      select 1
      from public.devices d
      where d.owner_id = p_user_id
        and d.type = rec.type
    ) then
      insert into public.devices (owner_id, type, name)
      values (p_user_id, rec.type, rec.name)
      returning id into new_device_id;

      insert into public.device_members (device_id, user_id, role)
      values (new_device_id, p_user_id, 'owner');
    end if;
  end loop;
end;
$$;

-- Client-safe wrapper: only provisions the caller’s own devices
create or replace function public.ensure_my_devices()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  perform public.ensure_user_devices(auth.uid());
end;
$$;

grant execute on function public.ensure_user_devices(uuid) to service_role;
grant execute on function public.ensure_my_devices() to authenticated;
grant execute on function public.user_can_access_device(uuid) to authenticated;
grant execute on function public.user_can_operate_device(uuid) to authenticated;
grant execute on function public.user_can_admin_device(uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      new.email
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  perform public.ensure_user_devices(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill devices for accounts that already exist
select public.ensure_user_devices(id) from auth.users;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.device_members enable row level security;
alter table public.device_credentials enable row level security;
alter table public.actuator_sliders enable row level security;
alter table public.actuator_switches enable row level security;
alter table public.sensors enable row level security;

-- Profiles
drop policy if exists "Profiles are readable by owner" on public.profiles;
drop policy if exists "Profiles are updatable by owner" on public.profiles;

create policy "Profiles are readable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id);

-- Devices
drop policy if exists "Devices readable by members" on public.devices;
drop policy if exists "Devices insert by owner self" on public.devices;
drop policy if exists "Devices update by admins" on public.devices;
drop policy if exists "Devices delete by owner" on public.devices;

create policy "Devices readable by members"
  on public.devices for select
  to authenticated
  using (public.user_can_access_device(id));

create policy "Devices insert by owner self"
  on public.devices for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "Devices update by admins"
  on public.devices for update
  to authenticated
  using (public.user_can_admin_device(id));

create policy "Devices delete by owner"
  on public.devices for delete
  to authenticated
  using (auth.uid() = owner_id);

-- Device members
drop policy if exists "Members readable by device members" on public.device_members;
drop policy if exists "Members insert by device admins" on public.device_members;
drop policy if exists "Members update by device admins" on public.device_members;
drop policy if exists "Members delete by device admins" on public.device_members;

create policy "Members readable by device members"
  on public.device_members for select
  to authenticated
  using (public.user_can_access_device(device_id));

create policy "Members insert by device admins"
  on public.device_members for insert
  to authenticated
  with check (public.user_can_admin_device(device_id));

create policy "Members update by device admins"
  on public.device_members for update
  to authenticated
  using (public.user_can_admin_device(device_id));

create policy "Members delete by device admins"
  on public.device_members for delete
  to authenticated
  using (public.user_can_admin_device(device_id));

-- Credentials (admin only; Pi ingest will use service role / edge function later)
drop policy if exists "Credentials readable by device admins" on public.device_credentials;
drop policy if exists "Credentials insert by device admins" on public.device_credentials;
drop policy if exists "Credentials update by device admins" on public.device_credentials;
drop policy if exists "Credentials delete by device admins" on public.device_credentials;

create policy "Credentials readable by device admins"
  on public.device_credentials for select
  to authenticated
  using (public.user_can_admin_device(device_id));

create policy "Credentials insert by device admins"
  on public.device_credentials for insert
  to authenticated
  with check (public.user_can_admin_device(device_id));

create policy "Credentials update by device admins"
  on public.device_credentials for update
  to authenticated
  using (public.user_can_admin_device(device_id));

create policy "Credentials delete by device admins"
  on public.device_credentials for delete
  to authenticated
  using (public.user_can_admin_device(device_id));

-- Sliders
drop policy if exists "Sliders readable by authenticated" on public.actuator_sliders;
drop policy if exists "Sliders insert by owner" on public.actuator_sliders;
drop policy if exists "Sliders readable by members" on public.actuator_sliders;
drop policy if exists "Sliders insert by operators" on public.actuator_sliders;

create policy "Sliders readable by members"
  on public.actuator_sliders for select
  to authenticated
  using (public.user_can_access_device(device_id));

create policy "Sliders insert by operators"
  on public.actuator_sliders for insert
  to authenticated
  with check (
    public.user_can_operate_device(device_id)
    and (user_id is null or user_id = auth.uid())
  );

-- Switches
drop policy if exists "Switches readable by authenticated" on public.actuator_switches;
drop policy if exists "Switches insert by owner" on public.actuator_switches;
drop policy if exists "Switches readable by members" on public.actuator_switches;
drop policy if exists "Switches insert by operators" on public.actuator_switches;

create policy "Switches readable by members"
  on public.actuator_switches for select
  to authenticated
  using (public.user_can_access_device(device_id));

create policy "Switches insert by operators"
  on public.actuator_switches for insert
  to authenticated
  with check (
    public.user_can_operate_device(device_id)
    and (user_id is null or user_id = auth.uid())
  );

-- Sensors
drop policy if exists "Sensors readable by authenticated" on public.sensors;
drop policy if exists "Sensors insert by authenticated" on public.sensors;
drop policy if exists "Sensors readable by members" on public.sensors;
drop policy if exists "Sensors insert by operators" on public.sensors;

create policy "Sensors readable by members"
  on public.sensors for select
  to authenticated
  using (public.user_can_access_device(device_id));

create policy "Sensors insert by operators"
  on public.sensors for insert
  to authenticated
  with check (
    public.user_can_operate_device(device_id)
    and (user_id is null or user_id = auth.uid())
  );

-- Device writers (Pi) can also use the service role key (bypasses RLS).
