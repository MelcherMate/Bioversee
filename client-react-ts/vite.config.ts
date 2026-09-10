import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig, loadEnv } from "vite";

const root = resolve(__dirname, "src");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  return {
    root,
    plugins: [react()],
    build: {
      outDir: resolve(__dirname, "dist"),
      emptyOutDir: true,
    },
    define: {
      "process.env": {
        VITE_PUBLIC_URL: env.VITE_PUBLIC_URL,
        VITE_SERVER_URL: env.VITE_SERVER_URL,
        VITE_AUTH_URL: env.VITE_AUTH_URL,
      },
    },
  };
});
