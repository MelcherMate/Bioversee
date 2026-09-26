# Bioversee Raspberry Pi app

**Version: v1.2.1** (`1.2.1`) — **desktop app** on the Pi (not a website in the browser).

Native window via WebKit (`pywebview`) + background `bioversee-agent` for sensor/actuator sync.

## Recommended install (from the website)

On the Raspberry Pi, open **Install on this Pi** on the Bioversee site.

1. Tap **Copy install command**
2. Open **Terminal** (Ctrl+Alt+T)
3. Paste (Ctrl+Shift+V) and press Enter
4. Confirm the Install dialog

Then open **Bioversee** from the Desktop or the Applications menu — a desktop window, not Chrome.

## Sign in

Tap **Continue on bioversee.com** in the app. Your browser opens the Bioversee website; after you sign in, you’re sent back to the local app automatically. Email/password inside the app still works as a fallback.

## What you get

1. **Bioversee desktop app**
   - Sign in on the website (or with email in the app)
   - Pick which process device this Pi controls
   - Live **40-pin GPIO** wiring with guess/confirm
   - In-app updates
2. **`bioversee-agent`** (systemd) — reads sensors, applies actuators, talks to `pi-ingest` in the background

## Cloud setup (once)

In the Supabase SQL editor, run:

[`supabase/device_credentials_pi.sql`](../supabase/device_credentials_pi.sql)

Deploy Edge Functions:

```bash
supabase functions deploy mint-device-key
supabase functions deploy pi-ingest --no-verify-jwt
```

## Manual / developer install

```bash
export BIOVERSEE_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export BIOVERSEE_SUPABASE_ANON_KEY="your-anon-key"
sudo -E ./packaging/install.sh
bioversee   # opens the desktop app
```

## Updates

```bash
bioversee-update check
sudo bioversee-update apply
```

Bump `VERSION` when shipping; Pis detect updates from GitHub.

## Develop on a Mac / PC

```bash
cd raspberry-pi-app
python3 -m venv .venv && source .venv/bin/activate
pip install -e .
export BIOVERSEE_SUPABASE_URL=...
export BIOVERSEE_SUPABASE_ANON_KEY=...
bioversee   # desktop window if display available; else set BIOVERSEE_WIZARD_HEADLESS=1
```

## Agent ingest API

`POST /functions/v1/pi-ingest` with header `X-Device-Key: bvpi_…`

- `{ "action": "sensors", "readings": [...] }`
- `{ "action": "actuators" }`
- `{ "action": "config", "config": { "pi": { "wiring": [...] } } }`
