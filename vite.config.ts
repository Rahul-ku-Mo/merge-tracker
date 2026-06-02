import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

/**
 * - pnpm dev        → vite build --watch (recommended; no localhost / CORS)
 * - pnpm dev:hmr    → Vite dev server + HMR (needs cors below)
 * - pnpm build      → production
 */
export default defineConfig(({ command }) => ({
  plugins: [crx({ manifest })],
  server: {
    port: 5173,
    strictPort: true,
    cors: {
      origin: /^chrome-extension:\/\/.+$/,
      methods: ["GET", "HEAD", "OPTIONS"],
      credentials: true
    },
    hmr: {
      host: "localhost",
      port: 5173
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: command === "build",
    sourcemap: true,
    watch: command === "build" ? null : undefined
  }
}));
