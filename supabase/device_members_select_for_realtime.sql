-- Allow users to SELECT their own device_members rows so Realtime can
-- deliver DELETE events when they leave a shared device.
-- (user_can_access_device is false after the membership row is gone.)
-- Run in Supabase SQL Editor. Idempotent.

drop policy if exists "Members readable by device members" on public.device_members;

create policy "Members readable by device members"
  on public.device_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.user_can_access_device(device_id)
  );
