#!/usr/bin/env bash
# Pull the latest Bioversee Pi app from GitHub into /opt/bioversee-pi.
# Usage: sudo ./packaging/update.sh
#    or: sudo bioversee-update apply

set -euo pipefail

PREFIX="${BIOVERSEE_PREFIX:-/opt/bioversee-pi}"
export BIOVERSEE_PREFIX="${PREFIX}"
export BIOVERSEE_UPDATE_REPO="${BIOVERSEE_UPDATE_REPO:-MelcherMate/Bioversee}"
export BIOVERSEE_UPDATE_BRANCH="${BIOVERSEE_UPDATE_BRANCH:-master}"
export BIOVERSEE_UPDATE_SUBDIR="${BIOVERSEE_UPDATE_SUBDIR:-raspberry-pi-app}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

if [[ -x "${PREFIX}/.venv/bin/bioversee-update" ]]; then
  "${PREFIX}/.venv/bin/bioversee-update" apply
elif command -v bioversee-update >/dev/null 2>&1; then
  bioversee-update apply
else
  echo "bioversee-update not found. Install first with packaging/install.sh" >&2
  exit 1
fi

# apply_update already installs the privileged helper and restarts agent units.
# Only fall back here if the helper is missing (very old installs).
if [[ -x "${PREFIX}/bin/bioversee-privileged" ]]; then
  "${PREFIX}/bin/bioversee-privileged" restart-agents || true
else
  systemctl try-restart bioversee-agent.service || true
fi
# Legacy desktop-as-service unit (never restart — app is a window now).
systemctl disable --now bioversee-wizard.service 2>/dev/null || true
rm -f /etc/systemd/system/bioversee-wizard.service
systemctl daemon-reload 2>/dev/null || true

echo "Update finished. Reopen Bioversee if it is still running."
