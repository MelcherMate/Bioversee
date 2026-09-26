# Bioversee Raspberry Pi app

**Version: v1.1** (`1.1.1`)

Setup wizard and monitoring agent that binds a Raspberry Pi to a Bioversee device, maps GPIO wiring, and syncs sensors/actuators through Supabase.

## Recommended install (from the website)

On the Raspberry Pi, open the Bioversee landing page and click **Download setup**.

1. Open **Files → Downloads**
2. Double-click **`bioversee-pi-setup.deb`** (like a Windows installer)
3. Click **Install** and enter your password
4. The wizard opens — sign in (cloud is already configured)

Advanced / terminal fallback: `bash bioversee-pi-setup.sh`

## Manual / developer install

1. **Setup wizard** (browser at `http://<pi>:8787`)
   - Sign in / create a Bioversee account
   - Pick which process device this Pi controls
   - Live **40-pin GPIO** view — highlights pins when hardware is detected, guesses the peripheral, asks you to confirm
   - Enables the agent to start on boot
   - **Check / pull updates** from GitHub (shows current version in the header)
2. **`bioversee-agent`** (systemd) — reads sensors, applies actuator commands, talks to `pi-ingest`

## Cloud setup (once)

In the Supabase SQL editor, run:

[`supabase/device_credentials_pi.sql`](../supabase/device_credentials_pi.sql)

Deploy Edge Functions:

```bash
supabase functions deploy mint-device-key
supabase functions deploy pi-ingest --no-verify-jwt
```

## Install on a Raspberry Pi

```bash
# On the Pi, from this folder (or a release checkout):
export BIOVERSEE_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export BIOVERSEE_SUPABASE_ANON_KEY="your-anon-key"
sudo -E ./packaging/install.sh
```

Then open **http://\<pi-ip\>:8787** and complete the wizard.

After **Finish**, the installer path enables:

```bash
sudo systemctl status bioversee-agent
sudo systemctl status bioversee-wizard
```

Config is stored at `~/.config/bioversee/config.toml` (API key mode `0600`).

## Updates

Version is tracked in [`VERSION`](./VERSION) (this release is **1.1.1** → displayed as **v1.1**).

From the wizard UI: **Check** → **Update now**.

From the shell on the Pi:

```bash
bioversee-update check
sudo bioversee-update apply
# or
sudo ./packaging/update.sh
```

Updates download `MelcherMate/Bioversee` (`master` / `raspberry-pi-app`), replace `/opt/bioversee-pi`, reinstall the package, and restart services. Bump `VERSION` (and `pyproject.toml` / `bioversee_pi/version.py`) whenever you ship a new build, then push to GitHub so Pis can detect it.

## Develop on a Mac / PC

GPIO is simulated automatically when not running on a Pi:

```bash
cd raspberry-pi-app
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
export BIOVERSEE_SUPABASE_URL=...
export BIOVERSEE_SUPABASE_ANON_KEY=...
bioversee-wizard
# open http://127.0.0.1:8787 — use “Simulate …” buttons on the wiring step
```

## Peripheral catalog (v1)

| Guess | Bus | Cloud name |
|-------|-----|------------|
| DS18B20 temperature | 1-Wire (GPIO 4) | `temperature` |
| pH I2C ADC | I2C | `ph` |
| Pressure I2C | I2C | `pressure` |
| Rotor / aerator / pumps | Digital GPIO | `rotor`, `aerator`, `switchWarmWaterPump`, … |

You can always change the guess or add a peripheral manually in the wizard.

## Agent ingest API

`POST /functions/v1/pi-ingest` with header `X-Device-Key: bvpi_…`

- `{ "action": "sensors", "readings": [{ "name": "temperature", "value": 28.1 }] }`
- `{ "action": "actuators" }` → latest slider/switch map
- `{ "action": "config", "config": { "pi": { "wiring": [...] } } }`
