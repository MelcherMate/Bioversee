#!/usr/bin/env bash
# Install Bioversee Pi desktop app + background agent on Raspberry Pi OS.
# Usage:
#   cd raspberry-pi-app
#   sudo ./packaging/install.sh
# Optional env before install:
#   BIOVERSEE_SUPABASE_URL=... BIOVERSEE_SUPABASE_ANON_KEY=... sudo -E ./packaging/install.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PREFIX="${BIOVERSEE_PREFIX:-/opt/bioversee-pi}"
SERVICE_USER="${BIOVERSEE_USER:-pi}"
ENV_DIR="/etc/bioversee"
ENV_FILE="${ENV_DIR}/pi.env"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

echo "==> Installing to ${PREFIX}"
mkdir -p "${PREFIX}" "${ENV_DIR}"
rsync -a --delete \
  --exclude '.venv' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude 'bioversee_pi.egg-info' \
  "${ROOT}/" "${PREFIX}/"

if ! id -u "${SERVICE_USER}" >/dev/null 2>&1; then
  SERVICE_USER="$(logname 2>/dev/null || echo root)"
  echo "User 'pi' not found — using ${SERVICE_USER}"
fi

apt-get update -y
# Tkinter powers the native desktop setup wizard (CustomTkinter).
# WebKitGTK powers the in-app Google OAuth webview (pywebview).
apt-get install -y \
  python3 python3-venv python3-pip python3-tk \
  i2c-tools \
  gir1.2-webkit2-4.1 \
  || apt-get install -y \
    python3 python3-venv python3-pip python3-tk \
    i2c-tools \
    gir1.2-webkit2-4.0 \
  || true

python3 -m venv "${PREFIX}/.venv"
"${PREFIX}/.venv/bin/pip" install --upgrade pip
"${PREFIX}/.venv/bin/pip" install -e "${PREFIX}[pi]" || \
  "${PREFIX}/.venv/bin/pip" install -e "${PREFIX}"

if [[ ! -f "${ENV_FILE}" ]] || [[ -n "${BIOVERSEE_SUPABASE_URL:-}" ]]; then
  cat > "${ENV_FILE}" <<EOF
BIOVERSEE_SUPABASE_URL=${BIOVERSEE_SUPABASE_URL:-}
BIOVERSEE_SUPABASE_ANON_KEY=${BIOVERSEE_SUPABASE_ANON_KEY:-}
BIOVERSEE_WIZARD_HOST=127.0.0.1
BIOVERSEE_WIZARD_PORT=8787
EOF
  # Anon/publishable key is public by design; must be readable by the desktop user.
  chmod 644 "${ENV_FILE}"
fi

# Ensure an existing install is not left root-only (breaks the desktop launcher).
if [[ -f "${ENV_FILE}" ]]; then
  chmod 644 "${ENV_FILE}" || true
fi

# Seed user config so the desktop app has project keys without pasting them.
USER_HOME="$(getent passwd "${SERVICE_USER}" | cut -d: -f6 || true)"
if [[ -n "${USER_HOME}" && -n "${BIOVERSEE_SUPABASE_URL:-}" && -n "${BIOVERSEE_SUPABASE_ANON_KEY:-}" ]]; then
  mkdir -p "${USER_HOME}/.config/bioversee"
  CONFIG_TOML="${USER_HOME}/.config/bioversee/config.toml"
  if [[ ! -f "${CONFIG_TOML}" ]] || ! grep -q 'supabase_url' "${CONFIG_TOML}" 2>/dev/null; then
    cat > "${CONFIG_TOML}" <<EOF
supabase_url = "${BIOVERSEE_SUPABASE_URL}"
supabase_anon_key = "${BIOVERSEE_SUPABASE_ANON_KEY}"
agent_enabled = false
wiring = []
EOF
    chmod 600 "${CONFIG_TOML}"
    chown "${SERVICE_USER}:${SERVICE_USER}" "${CONFIG_TOML}" || true
  fi
  chown -R "${SERVICE_USER}:${SERVICE_USER}" "${USER_HOME}/.config/bioversee" || true
fi

# Launcher that loads installer env then starts the desktop app.
LAUNCHER="${PREFIX}/bin/bioversee-launch"
mkdir -p "${PREFIX}/bin"
cat > "${LAUNCHER}" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
ENV_FILE="/etc/bioversee/pi.env"
if [[ -r "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ENV_FILE}"
  set +a
elif [[ -f "${ENV_FILE}" ]]; then
  echo "Warning: ${ENV_FILE} is not readable — continuing without it." >&2
fi
exec "/opt/bioversee-pi/.venv/bin/bioversee" "$@"
EOF
# Keep PREFIX expandable for non-default installs
sed -i "s|/opt/bioversee-pi|${PREFIX}|g" "${LAUNCHER}"
chmod 755 "${LAUNCHER}"

# Background monitoring agent only (desktop app is launched by the user).
sed "s/^User=pi$/User=${SERVICE_USER}/; s/^Group=pi$/Group=${SERVICE_USER}/" \
  "${PREFIX}/packaging/bioversee-agent.service" \
  > /etc/systemd/system/bioversee-agent.service

# Remove old headless wizard service if present — app is a desktop window now.
systemctl disable --now bioversee-wizard.service 2>/dev/null || true
rm -f /etc/systemd/system/bioversee-wizard.service

# Desktop application (menu + optional Desktop shortcut)
APP_DESKTOP="/usr/share/applications/bioversee.desktop"
cat > "${APP_DESKTOP}" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Bioversee
GenericName=Process control
Comment=Bioversee desktop app for this Raspberry Pi
Exec=${LAUNCHER}
Icon=bioversee
Terminal=false
Categories=Science;Utility;
StartupNotify=true
EOF

# Icon
mkdir -p /usr/share/icons/hicolor/48x48/apps /usr/share/pixmaps
if [[ -f "${PREFIX}/packaging/bioversee.png" ]]; then
  cp "${PREFIX}/packaging/bioversee.png" /usr/share/icons/hicolor/48x48/apps/bioversee.png
  cp "${PREFIX}/packaging/bioversee.png" /usr/share/pixmaps/bioversee.png
elif [[ -f "${ROOT}/../ios/Bioversee/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon.png" ]]; then
  cp "${ROOT}/../ios/Bioversee/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon.png" \
    /usr/share/icons/hicolor/48x48/apps/bioversee.png
  cp /usr/share/icons/hicolor/48x48/apps/bioversee.png /usr/share/pixmaps/bioversee.png
fi

# Shortcut on the user desktop
if [[ -n "${USER_HOME}" && -d "${USER_HOME}" ]]; then
  mkdir -p "${USER_HOME}/Desktop"
  cp "${APP_DESKTOP}" "${USER_HOME}/Desktop/Bioversee.desktop"
  chmod 755 "${USER_HOME}/Desktop/Bioversee.desktop"
  chown "${SERVICE_USER}:${SERVICE_USER}" "${USER_HOME}/Desktop/Bioversee.desktop" || true
  # Mark trusted so double-click runs (Pi OS)
  if command -v gio >/dev/null 2>&1; then
    sudo -u "${SERVICE_USER}" gio set "${USER_HOME}/Desktop/Bioversee.desktop" metadata::trusted true 2>/dev/null || true
  fi
fi

systemctl daemon-reload
# Agent is enabled after the user finishes in-app setup; ensure unit is installed.
systemctl enable bioversee-agent.service 2>/dev/null || true

chown -R "${SERVICE_USER}:${SERVICE_USER}" "${PREFIX}"
mkdir -p "/home/${SERVICE_USER}/.config/bioversee" 2>/dev/null || true
chown -R "${SERVICE_USER}:${SERVICE_USER}" "/home/${SERVICE_USER}/.config/bioversee" 2>/dev/null || true

echo
echo "Installed Bioversee desktop app."
echo "  Open:   Applications menu → Bioversee"
echo "      or: Desktop → Bioversee"
echo "  Env:    ${ENV_FILE}"
echo "  Agent:  starts after you finish setup in the app"
echo
