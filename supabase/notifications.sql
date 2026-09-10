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
