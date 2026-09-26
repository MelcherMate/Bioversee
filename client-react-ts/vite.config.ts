import react from "@vitejs/plugin-react";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv, type Plugin } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Build a double-clickable "Install Bioversee" launcher (.desktop) + setup script.
 * On Raspberry Pi OS, .desktop files show as an app icon (like a Windows installer).
 */
function bioverseePiSetupPlugin(mode: string): Plugin {
  const writeSetup = () => {
    const env = loadEnv(mode, __dirname, "");
    const supabaseUrl = env.VITE_SUPABASE_URL?.trim() ?? "";
    const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
    const rawPublic = (env.VITE_PUBLIC_URL?.trim() || "https://www.bioversee.com").replace(
      /\/$/,
      ""
    );
    // Installer must self-fetch from the public site (not a Vercel preview URL).
    const publicUrl = rawPublic.includes("vercel.app")
      ? "https://www.bioversee.com"
      : rawPublic;
    const setupVersion = "1.3.0";
    const setupShUrl = `${publicUrl}/downloads/bioversee-pi-setup.sh`;

    const templatePath = resolve(
      __dirname,
      "../raspberry-pi-app/packaging/bioversee-pi-setup.template"
    );
    const outDir = resolve(__dirname, "src/public/downloads");
    mkdirSync(outDir, { recursive: true });

    let setupScript = readFileSync(templatePath, "utf8");
    setupScript = setupScript
      .replaceAll("@@BIOVERSEE_SUPABASE_URL@@", supabaseUrl)
      .replaceAll("@@BIOVERSEE_SUPABASE_ANON_KEY@@", supabaseKey)
      .replaceAll("@@BIOVERSEE_SETUP_VERSION@@", setupVersion)
      .replaceAll("@@BIOVERSEE_SETUP_SH_URL@@", setupShUrl);

    writeFileSync(resolve(outDir, "bioversee-pi-setup.sh"), setupScript, {
      encoding: "utf8",
      mode: 0o755,
    });

    // Application launcher — appears as an install icon in Files / Downloads
    const desktop = `[Desktop Entry]
Version=1.0
Type=Application
Name=Install Bioversee
GenericName=Bioversee Installer
Comment=Install Bioversee on this Raspberry Pi
Exec=bash -c "curl -fsSL '${setupShUrl}' | bash"
Icon=system-software-install
Terminal=false
Categories=Utility;Settings;
StartupNotify=true
X-GNOME-UsesNotifications=true
`;

    writeFileSync(resolve(outDir, "Install-Bioversee.desktop"), desktop, {
      encoding: "utf8",
      mode: 0o755,
    });

    if (!supabaseUrl || !supabaseKey) {
      console.warn(
        "[bioversee-pi-setup] Missing VITE_SUPABASE_* — installer needs a production build with env."
      );
    } else {
      console.info(
        `[bioversee-pi-setup] Wrote Install-Bioversee.desktop + setup.sh (v${setupVersion})`
      );
    }
  };

  return {
    name: "bioversee-pi-setup",
    buildStart() {
      writeSetup();
    },
    configureServer() {
      writeSetup();
    },
  };
}

export default defineConfig(({ mode }) => ({
  root: resolve(__dirname, "src"),
  envDir: __dirname,
  publicDir: resolve(__dirname, "src/public"),
  plugins: [react(), bioverseePiSetupPlugin(mode)],
  server: {
    port: 5173,
  },
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
}));
