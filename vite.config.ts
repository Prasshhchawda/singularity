// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { VitePWA } from "vite-plugin-pwa";
import { loadEnv } from "vite";

const packageMetadata = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
) as { version?: string };

export default defineConfig({
  vite: {
    define: {
      __APP_VERSION__: JSON.stringify(packageMetadata.version ?? "1.0.0"),
      __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    },
  },
  nitro: {
    preset: "node-server",
  },
  plugins: [
    VitePWA({
      outDir: resolve(process.cwd(), ".output", "public"),
      registerType: "prompt",
      injectRegister: null,
      manifest: {
        name: "Singularity",
        short_name: "Singularity",
        description: "Your AI-powered workspace.",
        theme_color: "#09090b",
        background_color: "#09090b",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/pwa-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        navigateFallback: null,
        globPatterns: ["assets/**/*.{js,css,woff2,png,svg,webp}"],
      },
      devOptions: {
        enabled: false,
      },
    }),
    {
      name: "singularity-server-env",
      config(_config, { mode }) {
        const env = loadEnv(mode, process.cwd(), "");
        const geminiApiKey = env["GEMINI_API_KEY"]?.trim();
        if (geminiApiKey) {
          process.env["GEMINI_API_KEY"] = geminiApiKey;
        }
      },
    },
  ],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
