-- Per-user UI preferences (theme, accent, language). Synced when signed in.
-- Run in Supabase SQL Editor (idempotent).

create table if not exists public.user_settings (
  user_id uuid not null references auth.users (id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint user_settings_pkey primary key (user_id)
);

comment on table public.user_settings is
  'JSON preferences for Bioversee UI (theme, accent, language); RLS restricts to own row.';

create index if not exists user_settings_updated_at_idx
  on public.user_settings (updated_at desc);

alter table public.user_settings enable row level security;

drop policy if exists "user_settings_select_own" on public.user_settings;
drop policy if exists "user_settings_insert_own" on public.user_settings;
drop policy if exists "user_settings_update_own" on public.user_settings;
drop policy if exists "user_settings_delete_own" on public.user_settings;

create policy "user_settings_select_own"
  on public.user_settings for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_settings_insert_own"
  on public.user_settings for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_settings_update_own"
  on public.user_settings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_settings_delete_own"
  on public.user_settings for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.user_settings to authenticated;
