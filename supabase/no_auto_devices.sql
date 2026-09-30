-- Stop auto-provisioning four devices on signup / ensure_my_devices.
-- Users create devices with the header + button (create_my_device).
-- Also allow reading owner profiles for shared-device avatars.

create or replace function public.ensure_user_devices(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Intentionally empty: devices are created manually via create_my_device.
  return;
end;
$$;

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
  return;
end;
$$;

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
      nullif(trim(new.raw_user_meta_data->>'username'), ''),
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      new.email
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Let device members read the owner's profile (for shared-device avatars)
drop policy if exists "Profiles are readable by owner" on public.profiles;
drop policy if exists "Profiles readable by self or device peers" on public.profiles;

create policy "Profiles readable by self or device peers"
  on public.profiles for select
  to authenticated
  using (
    auth.uid() = id
    or exists (
      select 1
      from public.devices d
      join public.device_members m on m.device_id = d.id
      where m.user_id = auth.uid()
        and d.owner_id = profiles.id
    )
  );
