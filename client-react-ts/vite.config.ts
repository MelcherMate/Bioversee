import react from "@vitejs/plugin-react";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { defineConfig, loadEnv, type Plugin } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Bake cloud keys into a double-clickable .deb installer for Raspberry Pi OS. */
function bioverseePiSetupPlugin(mode: string): Plugin {
  const writeSetup = async () => {
    const env = loadEnv(mode, __dirname, "");
    const supabaseUrl = env.VITE_SUPABASE_URL?.trim() ?? "";
    const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
    const setupVersion = "1.1.1";

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
      .replaceAll("@@BIOVERSEE_SETUP_VERSION@@", setupVersion);

    // Keep shell fallback for advanced users / terminals
    writeFileSync(resolve(outDir, "bioversee-pi-setup.sh"), setupScript, {
      encoding: "utf8",
      mode: 0o755,
    });

    const { writePiSetupDeb } = await import(
      pathToFileURL(resolve(__dirname, "scripts/buildPiSetupDeb.mjs")).href
    );

    let iconPng: Buffer | undefined;
    try {
      iconPng = readFileSync(
        resolve(__dirname, "../ios/Bioversee/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon.png")
      );
    } catch {
      iconPng = undefined;
    }

    const debPath = resolve(outDir, "bioversee-pi-setup.deb");
    writePiSetupDeb({
      version: setupVersion,
      setupScript,
      outPath: debPath,
      iconPng,
    });

    if (!supabaseUrl || !supabaseKey) {
      console.warn(
        "[bioversee-pi-setup] VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing — installer will refuse until rebuilt with env."
      );
    } else {
      console.info(
        `[bioversee-pi-setup] Wrote ${debPath} (v${setupVersion}, double-click installer)`
      );
    }
  };

  return {
    name: "bioversee-pi-setup",
    async buildStart() {
      await writeSetup();
    },
    async configureServer() {
      await writeSetup();
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
