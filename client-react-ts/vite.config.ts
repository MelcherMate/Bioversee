import react from "@vitejs/plugin-react";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv, type Plugin } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Bake production Supabase keys into a downloadable Pi setup app. */
function bioverseePiSetupPlugin(mode: string): Plugin {
  const writeSetup = () => {
    const env = loadEnv(mode, __dirname, "");
    const supabaseUrl = env.VITE_SUPABASE_URL?.trim() ?? "";
    const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
    const setupVersion = "1.1.1";

    const templatePath = resolve(
      __dirname,
      "../raspberry-pi-app/packaging/bioversee-pi-setup.template"
    );
    const outDir = resolve(__dirname, "src/public/downloads");
    const outPath = resolve(outDir, "bioversee-pi-setup");

    let body = readFileSync(templatePath, "utf8");
    body = body
      .replaceAll("@@BIOVERSEE_SUPABASE_URL@@", supabaseUrl)
      .replaceAll("@@BIOVERSEE_SUPABASE_ANON_KEY@@", supabaseKey)
      .replaceAll("@@BIOVERSEE_SETUP_VERSION@@", setupVersion);

    mkdirSync(outDir, { recursive: true });
    writeFileSync(outPath, body, { encoding: "utf8", mode: 0o755 });

    if (!supabaseUrl || !supabaseKey) {
      console.warn(
        "[bioversee-pi-setup] VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing — setup download will refuse to run until rebuilt with env."
      );
    } else {
      console.info(
        `[bioversee-pi-setup] Wrote ${outPath} (v${setupVersion}, cloud preconfigured)`
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
