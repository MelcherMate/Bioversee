-- iOS / Android push device tokens.
-- Run in Supabase SQL Editor. Idempotent.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  platform text not null default 'ios',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_tokens_user_token_unique unique (user_id, token)
);

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "push_tokens_select_own" on public.push_tokens;
drop policy if exists "push_tokens_insert_own" on public.push_tokens;
drop policy if exists "push_tokens_update_own" on public.push_tokens;
drop policy if exists "push_tokens_delete_own" on public.push_tokens;

create policy "push_tokens_select_own"
  on public.push_tokens for select
  to authenticated
  using (auth.uid() = user_id);

create policy "push_tokens_insert_own"
  on public.push_tokens for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "push_tokens_update_own"
  on public.push_tokens for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "push_tokens_delete_own"
  on public.push_tokens for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.upsert_my_push_token(
  p_token text,
  p_platform text default 'ios'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_token is null or length(trim(p_token)) < 8 then
    raise exception 'Invalid token';
  end if;

  insert into public.push_tokens (user_id, token, platform, updated_at)
  values (auth.uid(), trim(p_token), coalesce(nullif(trim(p_platform), ''), 'ios'), now())
  on conflict (user_id, token)
  do update set
    platform = excluded.platform,
    updated_at = now();
end;
$$;

revoke all on function public.upsert_my_push_token(text, text) from public;
grant execute on function public.upsert_my_push_token(text, text) to authenticated;

-- Optional: Database Webhook on public.notifications INSERT → Edge Function `push-notify`
-- (configure in Dashboard → Database → Webhooks), or call via pg_net if enabled.
