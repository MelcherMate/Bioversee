# Per-user device isolation — cutover

Destructive. Wipes shared actuator/sensor history and rebuilds around private devices.

## 1. Wipe old tables

In Supabase → **SQL Editor**, run:

[`wipe_and_migrate.sql`](./wipe_and_migrate.sql)

## 2. Apply new schema

Run the full contents of:

[`schema.sql`](./schema.sql)

This creates:

- `devices`, `device_members`, `device_credentials`
- device-scoped `actuator_sliders`, `actuator_switches`, `sensors`
- RLS helpers (`user_can_access_device`, `user_can_operate_device`, …)
- `ensure_my_devices` / signup provisioning of all four device types
- backfill: `ensure_user_devices` for every existing `auth.users` row

## 3. App

Redeploy or refresh the Vite app. On first load each signed-in user gets four private devices (Bioreactor, Pressure Vessel, Membrane MBR, Water Purifier).

## 4. Verify isolation

1. Sign in as **User A** → change rotor / vessel level / seed via **L+B**.
2. Sign out → sign in as **User B** → confirm A’s values do not appear.
3. Seed as B → confirm only B’s pages update.

## Notes

- Share links / teams / Pi API keys are schema-ready (`device_members`, `device_credentials`) but not exposed in UI yet.
- Pi ingest should use the **service role** or a future Edge Function that validates a device credential and inserts with `device_id`.
