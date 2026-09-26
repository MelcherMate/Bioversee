# Bioversee Raspberry Pi app

**Version: v1.3** (`1.3.0`) — **native desktop setup wizard** (CustomTkinter), not a website or browser window.

## Recommended install (from the website)

On the Raspberry Pi, open **Install on this Pi** on the Bioversee site.

1. Tap **Copy install command**
2. Open **Terminal** (Ctrl+Alt+T)
3. Paste (Ctrl+Shift+V) and press Enter
4. Confirm the Install dialog

Then open **Bioversee** from the Desktop or the Applications menu.

## Sign in

Tap **Continue on bioversee.com** in the app. Your system browser opens the Bioversee website; after you sign in, you’re returned to the desktop app. Email/password inside the app still works as a fallback.

## What you get

1. **Bioversee desktop wizard** (tk / CustomTkinter)
   - Sign in on the website (or with email in the app)
   - Pick which process device this Pi controls
   - Live **40-pin GPIO** wiring with guess/confirm
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
bioversee   # opens the desktop wizard
```

Requires `python3-tk` (installed by `install.sh`).

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
