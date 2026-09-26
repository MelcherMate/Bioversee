/**
 * Build an Architecture: all .deb installer (double-clickable on Raspberry Pi OS).
 * Uses only Node built-ins (works on Vercel / macOS without dpkg-deb).
 */
import { createHash } from "crypto";
import { chmodSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { gzipSync } from "zlib";

function ustar(name, content, mode = 0o644) {
  const data = typeof content === "string" ? Buffer.from(content, "utf8") : content;
  const nameBuf = Buffer.alloc(100);
  nameBuf.write(name.slice(0, 99));
  const header = Buffer.alloc(512);
  nameBuf.copy(header, 0);
  header.write(mode.toString(8).padStart(7, "0") + "\0", 100);
  header.write("0".padStart(7, "0") + "\0", 108);
  header.write("0".padStart(7, "0") + "\0", 116);
  header.write(data.length.toString(8).padStart(11, "0") + "\0", 124);
  header.write(
    Math.floor(Date.now() / 1000).toString(8).padStart(11, "0") + "\0",
    136
  );
  header.write("        ", 148);
  header.write("0", 156);
  header.write("ustar\0", 257);
  header.write("00", 263);

  let sum = 0;
  for (let i = 0; i < 512; i++) sum += header[i];
  header.write(sum.toString(8).padStart(6, "0") + "\0 ", 148);

  const pad = (512 - (data.length % 512)) % 512;
  return Buffer.concat([header, data, Buffer.alloc(pad)]);
}

function tarGz(files) {
  const parts = files.map((f) => ustar(f.name, f.content, f.mode ?? 0o644));
  const tar = Buffer.concat([...parts, Buffer.alloc(1024)]);
  return gzipSync(tar);
}

function arHeader(name, size) {
  const buf = Buffer.alloc(60, 0x20);
  buf.write(name.slice(0, 16), 0);
  buf.write(Math.floor(Date.now() / 1000).toString().padEnd(12, " "), 16);
  buf.write("0".padEnd(6, " "), 28);
  buf.write("0".padEnd(6, " "), 34);
  buf.write("100644".padEnd(8, " "), 40);
  buf.write(size.toString().padEnd(10, " "), 48);
  buf.write("`\n", 58);
  return buf;
}

function buildAr(members) {
  const chunks = [Buffer.from("!<arch>\n")];
  for (const m of members) {
    chunks.push(arHeader(m.name, m.data.length));
    chunks.push(m.data);
    if (m.data.length % 2 === 1) chunks.push(Buffer.from("\n"));
  }
  return Buffer.concat(chunks);
}

function desktopFile() {
  return `[Desktop Entry]
Type=Application
Version=1.0
Name=Bioversee Setup
GenericName=Bioversee Installer
Comment=Install and set up Bioversee on this Raspberry Pi
Exec=bioversee-pi-setup-gui
Icon=bioversee-pi-setup
Terminal=false
Categories=Utility;Settings;
StartupNotify=true
`;
}

function guiWrapper() {
  return `#!/usr/bin/env bash
# Double-click / menu launcher — shows progress and runs the installer.
set -euo pipefail

TITLE="Bioversee Setup"
SCRIPT="/usr/lib/bioversee-pi-setup/bioversee-pi-setup"

notify() {
  if command -v zenity >/dev/null 2>&1; then
    zenity --info --title="$TITLE" --width=420 --text="$1" || true
  elif command -v whiptail >/dev/null 2>&1; then
    whiptail --title "$TITLE" --msgbox "$1" 12 60 || true
  else
    echo "$1"
  fi
}

ask() {
  if command -v zenity >/dev/null 2>&1; then
    zenity --question --title="$TITLE" --width=420 --text="$1"
  else
    return 0
  fi
}

if ! ask "Install Bioversee on this Raspberry Pi?\\n\\nThis connects to the Bioversee cloud and opens the setup wizard."; then
  exit 0
fi

LOG="$(mktemp /tmp/bioversee-setup.XXXXXX.log)"
cleanup() { rm -f "$LOG"; }
trap cleanup EXIT

if command -v zenity >/dev/null 2>&1; then
  (
    echo "0"
    echo "# Downloading and installing Bioversee…"
    if pkexec env DISPLAY="$DISPLAY" XAUTHORITY="\${XAUTHORITY:-}" bash "$SCRIPT" >"$LOG" 2>&1; then
      echo "100"
      echo "# Done"
    else
      echo "100"
      echo "# Failed"
      exit 1
    fi
  ) | zenity --progress --title="$TITLE" --width=420 --auto-close --no-cancel \\
      --text="Installing Bioversee…" || {
    notify "Setup failed. See /tmp or run: sudo bioversee-pi-setup"
    exit 1
  }
else
  pkexec bash "$SCRIPT" || {
    notify "Setup failed. Run in Terminal: sudo bioversee-pi-setup"
    exit 1
  }
fi

notify "Bioversee is installed.\\nOpening the setup wizard…"
xdg-open "http://127.0.0.1:8787" >/dev/null 2>&1 || true
`;
}

function cliWrapper() {
  return `#!/usr/bin/env bash
exec bash /usr/lib/bioversee-pi-setup/bioversee-pi-setup "$@"
`;
}

function fallbackIconPng() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
}

export function writePiSetupDeb({
  version,
  setupScript,
  outPath,
  iconPng = fallbackIconPng(),
}) {
  const control = `Package: bioversee-pi-setup
Version: ${version}
Section: utils
Priority: optional
Architecture: all
Depends: bash, curl | wget, unzip, python3, python3-venv, zenity | whiptail, policykit-1
Maintainer: Bioversee <support@bioversee.com>
Description: Bioversee Raspberry Pi setup installer
 Installs the Bioversee monitoring agent and launches the setup wizard.
 Cloud connection is preconfigured.
`;

  const md5sumsLines = [];
  const hash = (path, buf) => {
    md5sumsLines.push(`${createHash("md5").update(buf).digest("hex")}  ${path}`);
  };

  const setupBuf = Buffer.from(setupScript, "utf8");
  const guiBuf = Buffer.from(guiWrapper(), "utf8");
  const cliBuf = Buffer.from(cliWrapper(), "utf8");
  const desktopBuf = Buffer.from(desktopFile(), "utf8");

  hash("usr/lib/bioversee-pi-setup/bioversee-pi-setup", setupBuf);
  hash("usr/bin/bioversee-pi-setup-gui", guiBuf);
  hash("usr/bin/bioversee-pi-setup", cliBuf);
  hash("usr/share/applications/bioversee-pi-setup.desktop", desktopBuf);
  hash("usr/share/icons/hicolor/48x48/apps/bioversee-pi-setup.png", iconPng);

  const postinst = `#!/bin/bash
set -e
chmod 755 /usr/lib/bioversee-pi-setup/bioversee-pi-setup
chmod 755 /usr/bin/bioversee-pi-setup /usr/bin/bioversee-pi-setup-gui
if [ -n "\${DISPLAY:-}" ] && command -v bioversee-pi-setup-gui >/dev/null 2>&1; then
  nohup bioversee-pi-setup-gui >/tmp/bioversee-pi-setup-gui.log 2>&1 &
elif [ -x /usr/lib/bioversee-pi-setup/bioversee-pi-setup ]; then
  /usr/lib/bioversee-pi-setup/bioversee-pi-setup || true
fi
exit 0
`;

  const controlTar = tarGz([
    { name: "control", content: control },
    { name: "md5sums", content: md5sumsLines.join("\n") + "\n" },
    { name: "postinst", content: postinst, mode: 0o755 },
  ]);

  const dataTar = tarGz([
    {
      name: "usr/lib/bioversee-pi-setup/bioversee-pi-setup",
      content: setupBuf,
      mode: 0o755,
    },
    { name: "usr/bin/bioversee-pi-setup", content: cliBuf, mode: 0o755 },
    { name: "usr/bin/bioversee-pi-setup-gui", content: guiBuf, mode: 0o755 },
    {
      name: "usr/share/applications/bioversee-pi-setup.desktop",
      content: desktopBuf,
      mode: 0o644,
    },
    {
      name: "usr/share/icons/hicolor/48x48/apps/bioversee-pi-setup.png",
      content: iconPng,
      mode: 0o644,
    },
  ]);

  const deb = buildAr([
    { name: "debian-binary", data: Buffer.from("2.0\n") },
    { name: "control.tar.gz", data: controlTar },
    { name: "data.tar.gz", data: dataTar },
  ]);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, deb);
  chmodSync(outPath, 0o644);
}
