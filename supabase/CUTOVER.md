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
- no auto-provisioning — users add devices via **+** (`create_my_device`)
- share invites, notifications, rename/delete/leave

## 3. App

Redeploy or refresh the Vite app. New accounts start with **no** devices; use **+** in the header to create one.

## 4. Verify isolation

1. Sign in as **User A** → change rotor / vessel level / seed via **L+B**.
2. Sign out → sign in as **User B** → confirm A’s values do not appear.
3. Seed as B → confirm only B’s pages update.

## Share links (if you already ran schema before share landed)

Run [`share_links.sql`](./share_links.sql) once. Fresh installs get this from `schema.sql`.

## Notifications + accept-to-join (if share already applied)

Run [`notifications.sql`](./notifications.sql) once. Invites become pending until the recipient accepts from the bell.

## Create device from header

Run [`create_device.sql`](./create_device.sql) once so the **+** button can create named devices.

## Device settings / delete

Run [`device_manage.sql`](./device_manage.sql) once for rename, delete, and leave.

## No auto devices

Run [`no_auto_devices.sql`](./no_auto_devices.sql) so new accounts start with **zero** devices (users add via **+**). Also enables reading owner avatars on shared device icons.

## Notes

- Share UI: navbar Share → invite link / email / roster.
- Recipients get a notification and must **Accept** before the device appears.
- Header: **+** adds a device; circular icons open each instance (hover shows name).
- Shared devices show the **owner’s avatar** on the icon.
- Right-click a device icon → **Settings** or **Delete** / **Leave**.
- Pi API keys: table ready (`device_credentials`); mint UI + Edge Function still follow-up.
- Pi ingest should use the **service role** or a future Edge Function that validates a device credential and inserts with `device_id`.
