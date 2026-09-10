-- DESTRUCTIVE cutover for per-user device isolation.
-- Run this FIRST in Supabase SQL Editor, then run schema.sql.
-- This wipes actuator/sensor/device data. Auth users & profiles are kept
-- (profiles are truncated only if you uncomment that section).

begin;

-- Drop dependent policies / tables (order matters)
drop table if exists public.sensors cascade;
drop table if exists public.actuator_sliders cascade;
drop table if exists public.actuator_switches cascade;
drop table if exists public.device_invites cascade;
drop table if exists public.notifications cascade;
drop table if exists public.device_share_links cascade;
drop table if exists public.device_credentials cascade;
drop table if exists public.device_members cascade;
drop table if exists public.devices cascade;

drop type if exists public.device_member_role cascade;
drop type if exists public.device_type cascade;

-- Optional: wipe profile display cache (auth.users untouched)
-- truncate public.profiles;

commit;

-- Next: paste / run schema.sql (creates tables, RLS, ensure_user_devices backfill).
