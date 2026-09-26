#!/usr/bin/env bash
# Install Bioversee Pi wizard + agent on Raspberry Pi OS.
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
  "${ROOT}/" "${PREFIX}/"

if ! id -u "${SERVICE_USER}" >/dev/null 2>&1; then
  SERVICE_USER="$(logname 2>/dev/null || echo root)"
  echo "User 'pi' not found — using ${SERVICE_USER}"
fi

apt-get update -y
apt-get install -y python3 python3-venv python3-pip i2c-tools || true

python3 -m venv "${PREFIX}/.venv"
"${PREFIX}/.venv/bin/pip" install --upgrade pip
"${PREFIX}/.venv/bin/pip" install -e "${PREFIX}[pi]" || \
  "${PREFIX}/.venv/bin/pip" install -e "${PREFIX}"

if [[ ! -f "${ENV_FILE}" ]]; then
  cat > "${ENV_FILE}" <<EOF
BIOVERSEE_SUPABASE_URL=${BIOVERSEE_SUPABASE_URL:-}
BIOVERSEE_SUPABASE_ANON_KEY=${BIOVERSEE_SUPABASE_ANON_KEY:-}
BIOVERSEE_WIZARD_HOST=0.0.0.0
BIOVERSEE_WIZARD_PORT=8787
EOF
  chmod 600 "${ENV_FILE}"
fi

# Patch service user
sed "s/^User=pi$/User=${SERVICE_USER}/; s/^Group=pi$/Group=${SERVICE_USER}/" \
  "${PREFIX}/packaging/bioversee-agent.service" \
  > /etc/systemd/system/bioversee-agent.service
sed "s/^User=pi$/User=${SERVICE_USER}/; s/^Group=pi$/Group=${SERVICE_USER}/" \
  "${PREFIX}/packaging/bioversee-wizard.service" \
  > /etc/systemd/system/bioversee-wizard.service

# Desktop launcher (optional)
if [[ -d /usr/share/applications ]]; then
  cat > /usr/share/applications/bioversee-setup.desktop <<EOF
[Desktop Entry]
Name=Bioversee Setup
Comment=Configure Bioversee monitoring on this Raspberry Pi
Exec=xdg-open http://127.0.0.1:8787
Terminal=false
Type=Application
Categories=Utility;
EOF
fi

systemctl daemon-reload
systemctl enable bioversee-wizard.service
systemctl restart bioversee-wizard.service

chown -R "${SERVICE_USER}:${SERVICE_USER}" "${PREFIX}"
mkdir -p "/home/${SERVICE_USER}/.config/bioversee" 2>/dev/null || true
chown -R "${SERVICE_USER}:${SERVICE_USER}" "/home/${SERVICE_USER}/.config/bioversee" 2>/dev/null || true

echo
echo "Installed."
echo "  Wizard:  http://$(hostname -I 2>/dev/null | awk '{print $1}'):8787  (or http://127.0.0.1:8787)"
echo "  Env:     ${ENV_FILE}"
echo "  Agent:   enabled after you finish the wizard (systemctl enable --now bioversee-agent)"
echo
echo "Cloud prerequisites:"
echo "  1. Run supabase/device_credentials_pi.sql in the SQL editor"
echo "  2. Deploy: supabase functions deploy mint-device-key"
echo "  3. Deploy: supabase functions deploy pi-ingest --no-verify-jwt"
