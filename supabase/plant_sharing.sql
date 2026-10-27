-- Plant-level membership, invites, and share links.
-- Users belong to a plant (owner / admin / operator / viewer). Device access
-- follows the plant role. Additive / idempotent. Run after plants.sql and
-- notifications.sql.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.plant_members (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.device_member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plant_id, user_id)
);

create index if not exists plant_members_user_idx on public.plant_members (user_id);
create index if not exists plant_members_plant_idx on public.plant_members (plant_id);

drop trigger if exists plant_members_set_updated_at on public.plant_members;
create trigger plant_members_set_updated_at
  before update on public.plant_members
  for each row execute function public.set_updated_at();

create table if not exists public.plant_share_links (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants (id) on delete cascade,
  token text not null unique,
  role public.device_member_role not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz,
  revoked_at timestamptz,
  use_count integer not null default 0,
  max_uses integer,
  created_at timestamptz not null default now(),
  constraint plant_share_links_role_check
    check (role in ('admin', 'operator', 'viewer')),
  constraint plant_share_links_max_uses_check
    check (max_uses is null or max_uses > 0)
);

create index if not exists plant_share_links_plant_idx
  on public.plant_share_links (plant_id);

create table if not exists public.plant_invites (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants (id) on delete cascade,
  invitee_id uuid not null references auth.users (id) on delete cascade,
  invited_by uuid not null references auth.users (id) on delete cascade,
  role public.device_member_role not null,
  status text not null default 'pending',
  share_link_id uuid references public.plant_share_links (id) on delete set null,
  notification_id uuid references public.notifications (id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint plant_invites_role_check
    check (role in ('admin', 'operator', 'viewer')),
  constraint plant_invites_status_check
    check (status in ('pending', 'accepted', 'declined', 'revoked'))
);

create unique index if not exists plant_invites_pending_unique
  on public.plant_invites (plant_id, invitee_id)
  where status = 'pending';

create index if not exists plant_invites_invitee_idx
  on public.plant_invites (invitee_id, status, created_at desc);

alter table public.plant_members enable row level security;
alter table public.plant_share_links enable row level security;
alter table public.plant_invites enable row level security;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.user_is_plant_member(p_plant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.plant_members m
    where m.plant_id = p_plant_id and m.user_id = auth.uid()
  )
  or exists (
    select 1 from public.plants p
    where p.id = p_plant_id and p.owner_id = auth.uid()
  );
$$;

create or replace function public.user_can_admin_plant(p_plant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.plant_members m
    where m.plant_id = p_plant_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  )
  or exists (
    select 1 from public.plants p
    where p.id = p_plant_id and p.owner_id = auth.uid()
  );
$$;

grant execute on function public.user_is_plant_member(uuid) to authenticated;
grant execute on function public.user_can_admin_plant(uuid) to authenticated;

-- Keep every device in a plant in step with plant_members (never demote a device owner).
create or replace function public.sync_user_to_plant_devices(
  p_plant_id uuid,
  p_user_id uuid,
  p_role public.device_member_role,
  p_remove boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_remove then
    delete from public.device_members m
    using public.devices d
    where m.device_id = d.id
      and d.plant_id = p_plant_id
      and m.user_id = p_user_id
      and m.role <> 'owner';
    return;
  end if;

  if p_role = 'owner' then
    return;
  end if;

  insert into public.device_members (device_id, user_id, role)
  select d.id, p_user_id, p_role
  from public.devices d
  where d.plant_id = p_plant_id
    and d.owner_id <> p_user_id
  on conflict (device_id, user_id) do update
    set role = excluded.role,
        updated_at = now()
    where public.device_members.role <> 'owner';
end;
$$;

create or replace function public.plant_members_sync_devices()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_user_to_plant_devices(
      old.plant_id, old.user_id, old.role, true
    );
    return old;
  end if;

  perform public.sync_user_to_plant_devices(
    new.plant_id, new.user_id, new.role, false
  );
  return new;
end;
$$;

drop trigger if exists plant_members_sync_devices on public.plant_members;
create trigger plant_members_sync_devices
  after insert or update of role on public.plant_members
  for each row execute function public.plant_members_sync_devices();

drop trigger if exists plant_members_sync_devices_del on public.plant_members;
create trigger plant_members_sync_devices_del
  after delete on public.plant_members
  for each row execute function public.plant_members_sync_devices();

-- New machines inherit everyone already on the plant.
create or replace function public.devices_inherit_plant_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.device_members (device_id, user_id, role)
  select new.id, m.user_id, m.role
  from public.plant_members m
  where m.plant_id = new.plant_id
    and m.user_id <> new.owner_id
    and m.role <> 'owner'
  on conflict (device_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists devices_inherit_plant_members on public.devices;
create trigger devices_inherit_plant_members
  after insert on public.devices
  for each row execute function public.devices_inherit_plant_members();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

drop policy if exists "Plant members readable by members" on public.plant_members;
create policy "Plant members readable by members"
  on public.plant_members for select
  to authenticated
  using (public.user_is_plant_member(plant_id));

drop policy if exists "Plant share links by admins" on public.plant_share_links;
create policy "Plant share links by admins"
  on public.plant_share_links for all
  to authenticated
  using (public.user_can_admin_plant(plant_id))
  with check (public.user_can_admin_plant(plant_id) and created_by = auth.uid());

drop policy if exists "Plant invites readable by parties" on public.plant_invites;
create policy "Plant invites readable by parties"
  on public.plant_invites for select
  to authenticated
  using (
    invitee_id = auth.uid()
    or invited_by = auth.uid()
    or public.user_can_admin_plant(plant_id)
  );

drop policy if exists "Plants readable by owner" on public.plants;
create policy "Plants readable by owner"
  on public.plants for select
  using (
    owner_id = auth.uid()
    or public.user_is_plant_member(id)
  );

drop policy if exists "Plant connections by plant owner" on public.plant_connections;
drop policy if exists "Plant connections readable by members" on public.plant_connections;
drop policy if exists "Plant connections writable by admins" on public.plant_connections;
create policy "Plant connections readable by members"
  on public.plant_connections for select
  using (public.user_is_plant_member(plant_id));
create policy "Plant connections writable by admins"
  on public.plant_connections for all
  using (public.user_can_admin_plant(plant_id))
  with check (public.user_can_admin_plant(plant_id));

drop policy if exists "Plant layouts by plant owner" on public.plant_node_layouts;
drop policy if exists "Plant layouts readable by members" on public.plant_node_layouts;
drop policy if exists "Plant layouts writable by admins" on public.plant_node_layouts;
create policy "Plant layouts readable by members"
  on public.plant_node_layouts for select
  using (public.user_is_plant_member(plant_id));
create policy "Plant layouts writable by admins"
  on public.plant_node_layouts for all
  using (public.user_can_admin_plant(plant_id))
  with check (public.user_can_admin_plant(plant_id));

-- ---------------------------------------------------------------------------
-- Backfill from existing plants + device memberships
-- ---------------------------------------------------------------------------

insert into public.plant_members (plant_id, user_id, role)
select p.id, p.owner_id, 'owner'::public.device_member_role
from public.plants p
on conflict (plant_id, user_id) do nothing;

insert into public.plant_members (plant_id, user_id, role)
select
  d.plant_id,
  m.user_id,
  case
    when bool_or(m.role = 'admin') then 'admin'::public.device_member_role
    when bool_or(m.role = 'operator') then 'operator'::public.device_member_role
    else 'viewer'::public.device_member_role
  end
from public.device_members m
join public.devices d on d.id = m.device_id
where m.role <> 'owner'
  and d.plant_id is not null
group by d.plant_id, m.user_id
on conflict (plant_id, user_id) do nothing;

-- Push plant roles onto every machine in the plant (skip device owners).
insert into public.device_members (device_id, user_id, role)
select d.id, pm.user_id, pm.role
from public.plant_members pm
join public.devices d on d.plant_id = pm.plant_id
where pm.role <> 'owner'
  and d.owner_id <> pm.user_id
on conflict (device_id, user_id) do update
  set role = excluded.role,
      updated_at = now()
  where public.device_members.role <> 'owner';

-- ---------------------------------------------------------------------------
-- Plant CRUD: keep owner in plant_members
-- ---------------------------------------------------------------------------

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

  insert into public.plant_members (plant_id, user_id, role)
  values (v_plant_id, v_uid, 'owner')
  on conflict (plant_id, user_id) do nothing;

  return v_plant_id;
end;
$$;

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

  insert into public.plant_members (plant_id, user_id, role)
  values (v_id, v_uid, 'owner');

  return v_id;
end;
$$;

create or replace function public.list_my_plants()
returns table (
  id uuid,
  owner_id uuid,
  name text,
  created_at timestamptz,
  updated_at timestamptz,
  role public.device_member_role
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
    p.id,
    p.owner_id,
    p.name,
    p.created_at,
    p.updated_at,
    coalesce(m.role, case when p.owner_id = auth.uid() then 'owner'::public.device_member_role end)
  from public.plants p
  left join public.plant_members m
    on m.plant_id = p.id and m.user_id = auth.uid()
  where p.owner_id = auth.uid()
     or m.user_id = auth.uid()
  order by p.created_at asc;
end;
$$;

grant execute on function public.list_my_plants() to authenticated;

-- ---------------------------------------------------------------------------
-- Roster / invites / links
-- ---------------------------------------------------------------------------

create or replace function public.list_plant_roster(p_plant_id uuid)
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
  if not public.user_is_plant_member(p_plant_id) then
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
  from public.plant_members m
  left join public.profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.plant_id = p_plant_id
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

create or replace function public.create_pending_plant_invite_as(
  p_plant_id uuid,
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
  v_plant public.plants%rowtype;
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

  select * into v_plant from public.plants where id = p_plant_id;
  if not found then
    raise exception 'Plant not found';
  end if;

  if exists (
    select 1 from public.plant_members
    where plant_id = p_plant_id
      and user_id = p_invitee_id
  ) then
    raise exception 'User already has access to this plant';
  end if;

  select id into v_invite_id
  from public.plant_invites
  where plant_id = p_plant_id
    and invitee_id = p_invitee_id
    and status = 'pending'
  limit 1;

  if v_invite_id is not null then
    update public.plant_invites
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
    'plant_invite',
    'Plant share invite',
    coalesce(v_inviter_name, 'Someone')
      || ' invited you to “'
      || v_plant.name
      || '” as '
      || p_role
      || '.',
    jsonb_build_object(
      'plant_id', v_plant.id,
      'plant_name', v_plant.name,
      'role', p_role,
      'inviter_id', p_inviter_id,
      'inviter_name', coalesce(v_inviter_name, 'Someone')
    )
  )
  returning id into v_notification_id;

  insert into public.plant_invites (
    plant_id, invitee_id, invited_by, role, share_link_id, notification_id
  ) values (
    p_plant_id, p_invitee_id, p_inviter_id, p_role, p_share_link_id, v_notification_id
  )
  returning id into v_invite_id;

  update public.notifications
  set data = data || jsonb_build_object('invite_id', v_invite_id)
  where id = v_notification_id;

  return v_invite_id;
end;
$$;

create or replace function public.invite_plant_member_by_email(
  p_plant_id uuid,
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
  if not public.user_can_admin_plant(p_plant_id) then
    raise exception 'Not allowed to invite to this plant';
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

  perform public.create_pending_plant_invite_as(
    p_plant_id, v_uid, auth.uid(), p_role, null
  );
end;
$$;

create or replace function public.create_plant_share_link(
  p_plant_id uuid,
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
  if not public.user_can_admin_plant(p_plant_id) then
    raise exception 'Not allowed to share this plant';
  end if;
  if p_role not in ('admin', 'operator', 'viewer') then
    raise exception 'Invalid share role';
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');

  insert into public.plant_share_links (
    plant_id, token, role, created_by, expires_at, max_uses
  ) values (
    p_plant_id,
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

create or replace function public.redeem_plant_share_link(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.plant_share_links%rowtype;
  v_plant public.plants%rowtype;
  v_invite_id uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_link
  from public.plant_share_links
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

  select * into v_plant from public.plants where id = v_link.plant_id;
  if not found then
    raise exception 'Plant not found';
  end if;

  if exists (
    select 1 from public.plant_members
    where plant_id = v_link.plant_id and user_id = v_uid
  ) then
    return jsonb_build_object(
      'status', 'already_member',
      'plant_id', v_plant.id,
      'name', v_plant.name,
      'role', v_link.role
    );
  end if;

  v_invite_id := public.create_pending_plant_invite_as(
    v_link.plant_id, v_uid, v_link.created_by, v_link.role, v_link.id
  );

  update public.plant_share_links
  set use_count = use_count + 1
  where id = v_link.id;

  return jsonb_build_object(
    'status', 'pending',
    'invite_id', v_invite_id,
    'plant_id', v_plant.id,
    'name', v_plant.name,
    'role', v_link.role
  );
end;
$$;

create or replace function public.redeem_share_link(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.plant_share_links where token = p_token) then
    return public.redeem_plant_share_link(p_token);
  end if;
  return public.redeem_device_share_link(p_token);
end;
$$;

create or replace function public.accept_plant_invite(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.plant_invites%rowtype;
  v_plant public.plants%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite
  from public.plant_invites
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

  select * into v_plant from public.plants where id = v_invite.plant_id;
  if not found then
    raise exception 'Plant not found';
  end if;

  insert into public.plant_members (plant_id, user_id, role)
  values (v_invite.plant_id, auth.uid(), v_invite.role)
  on conflict (plant_id, user_id) do update
    set role = excluded.role,
        updated_at = now()
    where public.plant_members.role <> 'owner';

  update public.plant_invites
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
    'plant_id', v_plant.id,
    'name', v_plant.name,
    'role', v_invite.role
  );
end;
$$;

create or replace function public.decline_plant_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.plant_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite
  from public.plant_invites
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

  update public.plant_invites
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

create or replace function public.revoke_plant_share_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select plant_id into v_plant_id
  from public.plant_share_links
  where id = p_link_id;

  if v_plant_id is null then
    raise exception 'Link not found';
  end if;
  if not public.user_can_admin_plant(v_plant_id) then
    raise exception 'Not allowed';
  end if;

  update public.plant_share_links
  set revoked_at = now()
  where id = p_link_id
    and revoked_at is null;
end;
$$;

create or replace function public.update_plant_member_role(
  p_member_id uuid,
  p_role public.device_member_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.plant_members%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_role not in ('admin', 'operator', 'viewer') then
    raise exception 'Invalid role';
  end if;

  select * into v_member from public.plant_members where id = p_member_id;
  if not found then
    raise exception 'Member not found';
  end if;
  if v_member.role = 'owner' then
    raise exception 'Cannot change the owner';
  end if;
  if not public.user_can_admin_plant(v_member.plant_id) then
    raise exception 'Not allowed';
  end if;

  update public.plant_members
  set role = p_role
  where id = p_member_id;
end;
$$;

create or replace function public.remove_plant_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.plant_members%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_member from public.plant_members where id = p_member_id;
  if not found then
    raise exception 'Member not found';
  end if;
  if v_member.role = 'owner' then
    raise exception 'Cannot remove the owner';
  end if;
  if not public.user_can_admin_plant(v_member.plant_id) then
    raise exception 'Not allowed';
  end if;

  delete from public.plant_members where id = p_member_id;
end;
$$;

create or replace function public.leave_plant(p_plant_id uuid)
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
    select 1 from public.plant_members
    where plant_id = p_plant_id
      and user_id = auth.uid()
      and role = 'owner'
  ) then
    raise exception 'Owners cannot leave their plant';
  end if;

  delete from public.plant_members
  where plant_id = p_plant_id
    and user_id = auth.uid()
    and role <> 'owner';
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
    coalesce(pi_by_id.status, pi_by_notif.status, di.status)
  from public.notifications n
  left join public.plant_invites pi_by_id
    on n.kind = 'plant_invite'
   and pi_by_id.id = nullif(n.data->>'invite_id', '')::uuid
  left join public.plant_invites pi_by_notif
    on n.kind = 'plant_invite'
   and pi_by_notif.notification_id = n.id
  left join public.device_invites di
    on n.kind = 'device_invite'
   and di.id = nullif(n.data->>'invite_id', '')::uuid
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
end;
$$;

grant execute on function public.list_plant_roster(uuid) to authenticated;
grant execute on function public.create_pending_plant_invite_as(uuid, uuid, uuid, public.device_member_role, uuid) to authenticated;
grant execute on function public.invite_plant_member_by_email(uuid, text, public.device_member_role) to authenticated;
grant execute on function public.create_plant_share_link(uuid, public.device_member_role, integer, integer) to authenticated;
grant execute on function public.redeem_plant_share_link(text) to authenticated;
grant execute on function public.redeem_share_link(text) to authenticated;
grant execute on function public.accept_plant_invite(uuid) to authenticated;
grant execute on function public.decline_plant_invite(uuid) to authenticated;
grant execute on function public.revoke_plant_share_link(uuid) to authenticated;
grant execute on function public.update_plant_member_role(uuid, public.device_member_role) to authenticated;
grant execute on function public.remove_plant_member(uuid) to authenticated;
grant execute on function public.leave_plant(uuid) to authenticated;
grant execute on function public.list_my_notifications(integer) to authenticated;
