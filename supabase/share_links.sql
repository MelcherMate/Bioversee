-- Additive: device share links + invite RPCs.
-- Safe to run after schema.sql (idempotent). Existing cutovers: run this now.

-- ---------------------------------------------------------------------------
-- Table
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

-- Members may leave (except owner role)
drop policy if exists "Members can leave device" on public.device_members;
create policy "Members can leave device"
  on public.device_members for delete
  to authenticated
  using (user_id = auth.uid() and role <> 'owner');

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

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
