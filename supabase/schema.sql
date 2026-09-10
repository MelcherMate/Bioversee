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

-- ---------------------------------------------------------------------------
-- Share links (also in share_links.sql for additive cutovers)
-- ---------------------------------------------------------------------------

create table if not exists public.device_share_links (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  token text not null unique,
  role public.device_member_role not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz,
  revoked_at timestamptz,
  use_count integer not null default 0,
  max_uses integer,
  created_at timestamptz not null default now(),
  constraint device_share_links_role_check
    check (role in ('admin', 'operator', 'viewer')),
  constraint device_share_links_max_uses_check
    check (max_uses is null or max_uses > 0)
);

create index if not exists device_share_links_device_idx
  on public.device_share_links (device_id);

alter table public.device_share_links enable row level security;

drop policy if exists "Share links readable by device admins" on public.device_share_links;
drop policy if exists "Share links insert by device admins" on public.device_share_links;
drop policy if exists "Share links update by device admins" on public.device_share_links;
drop policy if exists "Share links delete by device admins" on public.device_share_links;

create policy "Share links readable by device admins"
  on public.device_share_links for select
  to authenticated
  using (public.user_can_admin_device(device_id));

create policy "Share links insert by device admins"
  on public.device_share_links for insert
  to authenticated
  with check (
    public.user_can_admin_device(device_id)
    and created_by = auth.uid()
  );

create policy "Share links update by device admins"
  on public.device_share_links for update
  to authenticated
  using (public.user_can_admin_device(device_id));

create policy "Share links delete by device admins"
  on public.device_share_links for delete
  to authenticated
  using (public.user_can_admin_device(device_id));

drop policy if exists "Members can leave device" on public.device_members;
create policy "Members can leave device"
  on public.device_members for delete
  to authenticated
  using (user_id = auth.uid() and role <> 'owner');

create or replace function public.create_device_share_link(
  p_device_id uuid,
  p_role public.device_member_role default 'viewer',
  p_expires_hours integer default 168,
  p_max_uses integer default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.user_can_admin_device(p_device_id) then
    raise exception 'Not allowed to share this device';
  end if;
  if p_role not in ('admin', 'operator', 'viewer') then
    raise exception 'Invalid share role';
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');

  insert into public.device_share_links (
    device_id, token, role, created_by, expires_at, max_uses
  ) values (
    p_device_id,
    v_token,
    p_role,
    auth.uid(),
    case
      when p_expires_hours is null then null
      else now() + make_interval(hours => p_expires_hours)
    end,
    p_max_uses
  );

  return v_token;
end;
$$;

create or replace function public.redeem_device_share_link(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.device_share_links%rowtype;
  v_device public.devices%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_link
  from public.device_share_links
  where token = p_token
  for update;

  if not found then
    raise exception 'Invite link not found';
  end if;
  if v_link.revoked_at is not null then
    raise exception 'Invite link revoked';
  end if;
  if v_link.expires_at is not null and v_link.expires_at < now() then
    raise exception 'Invite link expired';
  end if;
  if v_link.max_uses is not null and v_link.use_count >= v_link.max_uses then
    raise exception 'Invite link has no uses left';
  end if;

  select * into v_device from public.devices where id = v_link.device_id;
  if not found then
    raise exception 'Device not found';
  end if;

  insert into public.device_members (device_id, user_id, role)
  values (v_link.device_id, v_uid, v_link.role)
  on conflict (device_id, user_id) do update
    set role = excluded.role,
        updated_at = now()
  where public.device_members.role <> 'owner';

  update public.device_share_links
  set use_count = use_count + 1
  where id = v_link.id;

  return jsonb_build_object(
    'device_id', v_device.id,
    'type', v_device.type,
    'name', v_device.name,
    'role', v_link.role
  );
end;
$$;

create or replace function public.invite_device_member_by_email(
  p_device_id uuid,
  p_email text,
  p_role public.device_member_role default 'viewer'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_email text := lower(trim(p_email));
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.user_can_admin_device(p_device_id) then
    raise exception 'Not allowed to invite to this device';
  end if;
  if p_role not in ('admin', 'operator', 'viewer') then
    raise exception 'Invalid invite role';
  end if;
  if v_email = '' then
    raise exception 'Email required';
  end if;

  select id into v_uid
  from auth.users
  where lower(email) = v_email
  limit 1;

  if v_uid is null then
    raise exception 'No Bioversee account found for that email';
  end if;
  if v_uid = auth.uid() then
    raise exception 'You already have access';
  end if;

  insert into public.device_members (device_id, user_id, role)
  values (p_device_id, v_uid, p_role)
  on conflict (device_id, user_id) do update
    set role = excluded.role,
        updated_at = now()
  where public.device_members.role <> 'owner';
end;
$$;

create or replace function public.list_device_roster(p_device_id uuid)
returns table (
  member_id uuid,
  user_id uuid,
  role public.device_member_role,
  display_name text,
  avatar_url text,
  email text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.user_can_access_device(p_device_id) then
    raise exception 'Not allowed';
  end if;

  return query
  select
    m.id,
    m.user_id,
    m.role,
    coalesce(p.display_name, u.email, 'Member')::text,
    p.avatar_url,
    u.email::text,
    m.created_at
  from public.device_members m
  left join public.profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.device_id = p_device_id
  order by
    case m.role
      when 'owner' then 0
      when 'admin' then 1
      when 'operator' then 2
      else 3
    end,
    m.created_at;
end;
$$;

create or replace function public.revoke_device_share_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select device_id into v_device_id
  from public.device_share_links
  where id = p_link_id;

  if v_device_id is null then
    raise exception 'Link not found';
  end if;
  if not public.user_can_admin_device(v_device_id) then
    raise exception 'Not allowed';
  end if;

  update public.device_share_links
  set revoked_at = now()
  where id = p_link_id
    and revoked_at is null;
end;
$$;

grant execute on function public.create_device_share_link(uuid, public.device_member_role, integer, integer) to authenticated;
grant execute on function public.redeem_device_share_link(text) to authenticated;
grant execute on function public.invite_device_member_by_email(uuid, text, public.device_member_role) to authenticated;
grant execute on function public.list_device_roster(uuid) to authenticated;
grant execute on function public.revoke_device_share_link(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Notifications + pending invites (also in notifications.sql for additive cutovers)
-- ---------------------------------------------------------------------------

-- Additive: pending device invites + in-app notifications.
-- Run after share_links.sql (or full schema). Idempotent.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create table if not exists public.device_invites (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  invitee_id uuid not null references auth.users (id) on delete cascade,
  invited_by uuid not null references auth.users (id) on delete cascade,
  role public.device_member_role not null,
  status text not null default 'pending',
  share_link_id uuid references public.device_share_links (id) on delete set null,
  notification_id uuid references public.notifications (id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint device_invites_role_check
    check (role in ('admin', 'operator', 'viewer')),
  constraint device_invites_status_check
    check (status in ('pending', 'accepted', 'declined', 'revoked'))
);

create unique index if not exists device_invites_pending_unique
  on public.device_invites (device_id, invitee_id)
  where status = 'pending';

create index if not exists device_invites_invitee_idx
  on public.device_invites (invitee_id, status, created_at desc);

alter table public.notifications enable row level security;
alter table public.device_invites enable row level security;

drop policy if exists "Notifications readable by owner" on public.notifications;
drop policy if exists "Notifications update by owner" on public.notifications;
drop policy if exists "Invites readable by parties" on public.device_invites;

create policy "Notifications readable by owner"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "Notifications update by owner"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid());

create policy "Invites readable by parties"
  on public.device_invites for select
  to authenticated
  using (
    invitee_id = auth.uid()
    or invited_by = auth.uid()
    or public.user_can_admin_device(device_id)
  );

-- Core: create / refresh a pending invite + notification
create or replace function public.create_pending_device_invite_as(
  p_device_id uuid,
  p_invitee_id uuid,
  p_inviter_id uuid,
  p_role public.device_member_role,
  p_share_link_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device public.devices%rowtype;
  v_inviter_name text;
  v_invite_id uuid;
  v_notification_id uuid;
begin
  if p_role not in ('admin', 'operator', 'viewer') then
    raise exception 'Invalid invite role';
  end if;
  if p_invitee_id = p_inviter_id then
    raise exception 'You already have access';
  end if;

  select * into v_device from public.devices where id = p_device_id;
  if not found then
    raise exception 'Device not found';
  end if;

  if exists (
    select 1 from public.device_members
    where device_id = p_device_id
      and user_id = p_invitee_id
  ) then
    raise exception 'User already has access to this device';
  end if;

  select id into v_invite_id
  from public.device_invites
  where device_id = p_device_id
    and invitee_id = p_invitee_id
    and status = 'pending'
  limit 1;

  if v_invite_id is not null then
    update public.device_invites
    set role = p_role,
        invited_by = p_inviter_id,
        share_link_id = coalesce(p_share_link_id, share_link_id)
    where id = v_invite_id;
    return v_invite_id;
  end if;

  select coalesce(p.display_name, u.email, 'Someone')
  into v_inviter_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = p_inviter_id;

  insert into public.notifications (user_id, kind, title, body, data)
  values (
    p_invitee_id,
    'device_invite',
    'Device share invite',
    coalesce(v_inviter_name, 'Someone')
      || ' invited you to “'
      || v_device.name
      || '” as '
      || p_role
      || '.',
    jsonb_build_object(
      'device_id', v_device.id,
      'device_name', v_device.name,
      'device_type', v_device.type,
      'role', p_role,
      'inviter_id', p_inviter_id,
      'inviter_name', coalesce(v_inviter_name, 'Someone')
    )
  )
  returning id into v_notification_id;

  insert into public.device_invites (
    device_id, invitee_id, invited_by, role, share_link_id, notification_id
  ) values (
    p_device_id, p_invitee_id, p_inviter_id, p_role, p_share_link_id, v_notification_id
  )
  returning id into v_invite_id;

  update public.notifications
  set data = data || jsonb_build_object('invite_id', v_invite_id)
  where id = v_notification_id;

  return v_invite_id;
end;
$$;

create or replace function public.invite_device_member_by_email(
  p_device_id uuid,
  p_email text,
  p_role public.device_member_role default 'viewer'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_email text := lower(trim(p_email));
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.user_can_admin_device(p_device_id) then
    raise exception 'Not allowed to invite to this device';
  end if;
  if v_email = '' then
    raise exception 'Email required';
  end if;

  select id into v_uid
  from auth.users
  where lower(email) = v_email
  limit 1;

  if v_uid is null then
    raise exception 'No Bioversee account found for that email';
  end if;

  perform public.create_pending_device_invite_as(
    p_device_id, v_uid, auth.uid(), p_role, null
  );
end;
$$;

-- Share link creates a pending invite (device visible only after accept)
create or replace function public.redeem_device_share_link(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.device_share_links%rowtype;
  v_device public.devices%rowtype;
  v_uid uuid := auth.uid();
  v_invite_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_link
  from public.device_share_links
  where token = p_token
  for update;

  if not found then
    raise exception 'Invite link not found';
  end if;
  if v_link.revoked_at is not null then
    raise exception 'Invite link revoked';
  end if;
  if v_link.expires_at is not null and v_link.expires_at < now() then
    raise exception 'Invite link expired';
  end if;
  if v_link.max_uses is not null and v_link.use_count >= v_link.max_uses then
    raise exception 'Invite link has no uses left';
  end if;

  select * into v_device from public.devices where id = v_link.device_id;
  if not found then
    raise exception 'Device not found';
  end if;

  if exists (
    select 1 from public.device_members
    where device_id = v_link.device_id and user_id = v_uid
  ) then
    return jsonb_build_object(
      'status', 'already_member',
      'device_id', v_device.id,
      'type', v_device.type,
      'name', v_device.name,
      'role', v_link.role
    );
  end if;

  v_invite_id := public.create_pending_device_invite_as(
    v_link.device_id,
    v_uid,
    v_link.created_by,
    v_link.role,
    v_link.id
  );

  update public.device_share_links
  set use_count = use_count + 1
  where id = v_link.id;

  return jsonb_build_object(
    'status', 'pending',
    'invite_id', v_invite_id,
    'device_id', v_device.id,
    'type', v_device.type,
    'name', v_device.name,
    'role', v_link.role
  );
end;
$$;

create or replace function public.accept_device_invite(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.device_invites%rowtype;
  v_device public.devices%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite
  from public.device_invites
  where id = p_invite_id
  for update;

  if not found then
    raise exception 'Invite not found';
  end if;
  if v_invite.invitee_id <> auth.uid() then
    raise exception 'Not your invite';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'Invite is no longer pending';
  end if;

  select * into v_device from public.devices where id = v_invite.device_id;
  if not found then
    raise exception 'Device not found';
  end if;

  insert into public.device_members (device_id, user_id, role)
  values (v_invite.device_id, auth.uid(), v_invite.role)
  on conflict (device_id, user_id) do update
    set role = excluded.role,
        updated_at = now()
  where public.device_members.role <> 'owner';

  update public.device_invites
  set status = 'accepted',
      responded_at = now()
  where id = v_invite.id;

  if v_invite.notification_id is not null then
    update public.notifications
    set read_at = coalesce(read_at, now()),
        data = data || jsonb_build_object('resolved', 'accepted')
    where id = v_invite.notification_id;
  end if;

  return jsonb_build_object(
    'device_id', v_device.id,
    'type', v_device.type,
    'name', v_device.name,
    'role', v_invite.role
  );
end;
$$;

create or replace function public.decline_device_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.device_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite
  from public.device_invites
  where id = p_invite_id
  for update;

  if not found then
    raise exception 'Invite not found';
  end if;
  if v_invite.invitee_id <> auth.uid() then
    raise exception 'Not your invite';
  end if;
  if v_invite.status <> 'pending' then
    return;
  end if;

  update public.device_invites
  set status = 'declined',
      responded_at = now()
  where id = v_invite.id;

  if v_invite.notification_id is not null then
    update public.notifications
    set read_at = coalesce(read_at, now()),
        data = data || jsonb_build_object('resolved', 'declined')
    where id = v_invite.notification_id;
  end if;
end;
$$;

create or replace function public.list_my_notifications(p_limit integer default 40)
returns table (
  id uuid,
  kind text,
  title text,
  body text,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz,
  invite_status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    n.id,
    n.kind,
    n.title,
    n.body,
    n.data,
    n.read_at,
    n.created_at,
    i.status
  from public.notifications n
  left join public.device_invites i
    on i.id = nullif(n.data->>'invite_id', '')::uuid
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.notifications
  set read_at = now()
  where id = p_notification_id
    and user_id = auth.uid()
    and read_at is null;
end;
$$;

grant execute on function public.create_pending_device_invite_as(uuid, uuid, uuid, public.device_member_role, uuid) to authenticated;
grant execute on function public.accept_device_invite(uuid) to authenticated;
grant execute on function public.decline_device_invite(uuid) to authenticated;
grant execute on function public.list_my_notifications(integer) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.invite_device_member_by_email(uuid, text, public.device_member_role) to authenticated;
grant execute on function public.redeem_device_share_link(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Create named devices from header (also in create_device.sql)
-- ---------------------------------------------------------------------------

-- Additive: create a named device owned by the caller, with optional member invites.
-- Run after notifications.sql. Idempotent.

create or replace function public.create_my_device(
  p_type public.device_type,
  p_name text,
  p_member_emails text[] default '{}',
  p_member_role public.device_member_role default 'viewer'
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

  insert into public.devices (owner_id, type, name)
  values (v_uid, p_type, v_name)
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
  public.device_member_role
) to authenticated;

-- ---------------------------------------------------------------------------
-- Device manage: rename / delete / leave (also in device_manage.sql)
-- ---------------------------------------------------------------------------

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
