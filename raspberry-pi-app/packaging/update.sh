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

systemctl try-restart bioversee-agent.service bioversee-wizard.service || true
echo "Services restarted (if installed)."
