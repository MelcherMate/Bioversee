-- Bioversee Supabase schema (structure only — no seed data)
-- Run once in: Supabase Dashboard → SQL Editor

-- Profiles (mirrors auth.users for display)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Actuator sliders (0–100 style values)
create table if not exists public.actuator_sliders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state numeric not null default 0,
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists actuator_sliders_name_created_idx
  on public.actuator_sliders (name, created_at desc);

-- Actuator switches (boolean)
create table if not exists public.actuator_switches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state boolean not null default false,
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists actuator_switches_name_created_idx
  on public.actuator_switches (name, created_at desc);

-- Sensors (written later by device / service role; readable by app users)
create table if not exists public.sensors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  value numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sensors_name_created_idx
  on public.sensors (name, created_at desc);

-- Auto-create profile on signup
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
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.actuator_sliders enable row level security;
alter table public.actuator_switches enable row level security;
alter table public.sensors enable row level security;

create policy "Profiles are readable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Sliders readable by authenticated"
  on public.actuator_sliders for select
  to authenticated
  using (true);

create policy "Sliders insert by owner"
  on public.actuator_sliders for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Switches readable by authenticated"
  on public.actuator_switches for select
  to authenticated
  using (true);

create policy "Switches insert by owner"
  on public.actuator_switches for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Sensors readable by authenticated"
  on public.sensors for select
  to authenticated
  using (true);

-- Device writers can use the service role key (bypasses RLS).
