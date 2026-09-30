# Bioversee Raspberry Pi app

**Version: v1.4** (`1.4.0`) — **native desktop setup wizard** (CustomTkinter). Sign in and wire GPIO entirely in the app; control the bioreactor from the Bioversee website.

## Recommended install (from the website)

On the Raspberry Pi, open **Install on this Pi** on the Bioversee site (About → Raspberry Pi, or `/pi-setup`).

1. Tap **Copy install command**
2. Open **Terminal** (Ctrl+Alt+T)
3. Paste (Ctrl+Shift+V) and press Enter
4. Confirm the Install dialog

Then open **Bioversee** from the Desktop or the Applications menu.

## Sign in (in-app only)

- **Email + password** — sign in or create an account in the desktop window
- **Continue with Google** — opens an embedded sign-in window (no system browser)

## What you get

1. **Bioversee desktop wizard**
   - Sign in inside the app
   - Create a device or select one from your profile
   - Live **40-pin GPIO** board (HIGH / LOW / idle) with sensor auto-detect
2. **`bioversee-agent`** (systemd) — reads sensors, applies actuators, talks to `pi-ingest` in the background so the website can control the process

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
bioversee   # opens the desktop wizard
```

Requires `python3-tk` and WebKitGTK (`gir1.2-webkit2-4.1`) — installed by `install.sh`.

## Updates

```bash
bioversee-update check
sudo bioversee-update apply
```

Bump `VERSION` when shipping; Pis detect updates from GitHub.

## Develop on a Mac / PC

```bash
cd raspberry-pi-app
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
# macOS: Tk is included with python.org builds
bioversee
```

GPIO probing runs in simulation mode off-Pi.
