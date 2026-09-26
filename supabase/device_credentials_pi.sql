-- Additive: mint / verify device API keys for Raspberry Pi agents.
-- Safe after schema.sql. Idempotent.
-- Requires pgcrypto (available by default on Supabase).

create extension if not exists pgcrypto with schema extensions;

-- Hash helper (sha256 hex)
create or replace function public.hash_device_api_key(p_api_key text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(extensions.digest(convert_to(p_api_key, 'utf8'), 'sha256'), 'hex');
$$;

-- Mint a one-time plaintext key for an admin of the device.
-- Returns: { credential_id, device_id, api_key, label }
create or replace function public.mint_device_credential(
  p_device_id uuid,
  p_label text default 'Raspberry Pi'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  v_hash text;
  v_id uuid;
  v_label text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.user_can_admin_device(p_device_id) then
    raise exception 'Not allowed to mint credentials for this device';
  end if;

  v_label := coalesce(nullif(trim(p_label), ''), 'Raspberry Pi');
  v_secret := 'bvpi_' || encode(gen_random_bytes(24), 'hex');
  v_hash := public.hash_device_api_key(v_secret);

  insert into public.device_credentials (device_id, key_hash, label)
  values (p_device_id, v_hash, v_label)
  returning id into v_id;

  return jsonb_build_object(
    'credential_id', v_id,
    'device_id', p_device_id,
    'api_key', v_secret,
    'label', v_label
  );
end;
$$;

grant execute on function public.mint_device_credential(uuid, text) to authenticated;
grant execute on function public.hash_device_api_key(text) to authenticated;
grant execute on function public.hash_device_api_key(text) to service_role;

-- Resolve a plaintext API key to a device_id (service role / Edge Functions).
-- Updates last_used_at on success. Returns null if invalid/revoked.
create or replace function public.verify_device_credential(p_api_key text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_device_id uuid;
  v_cred_id uuid;
begin
  if p_api_key is null or length(trim(p_api_key)) < 16 then
    return null;
  end if;

  v_hash := public.hash_device_api_key(trim(p_api_key));

  select c.id, c.device_id
    into v_cred_id, v_device_id
  from public.device_credentials c
  where c.key_hash = v_hash
    and c.revoked_at is null
  limit 1;

  if v_device_id is null then
    return null;
  end if;

  update public.device_credentials
  set last_used_at = now()
  where id = v_cred_id;

  return v_device_id;
end;
$$;

revoke all on function public.verify_device_credential(text) from public;
grant execute on function public.verify_device_credential(text) to service_role;

-- Revoke a credential (admin only)
create or replace function public.revoke_device_credential(p_credential_id uuid)
returns boolean
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
  from public.device_credentials
  where id = p_credential_id;

  if v_device_id is null then
    raise exception 'Credential not found';
  end if;

  if not public.user_can_admin_device(v_device_id) then
    raise exception 'Not allowed';
  end if;

  update public.device_credentials
  set revoked_at = now()
  where id = p_credential_id
    and revoked_at is null;

  return found;
end;
$$;

grant execute on function public.revoke_device_credential(uuid) to authenticated;

comment on function public.mint_device_credential(uuid, text) is
  'Mint a one-time Raspberry Pi / agent API key for a device the caller admins.';
comment on function public.verify_device_credential(text) is
  'Service-role helper: map device API key → device_id.';
