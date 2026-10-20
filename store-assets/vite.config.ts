import { defineConfig, type Plugin } from "vite";
import { resolve } from "node:path";

/**
 * Builds the real popup + options pages WITHOUT the extension runtime, with a
 * chrome.* stub injected, into site/demo (used by the landing page and the
 * store screenshots). Run: pnpm demo:build
 */
const injectStub = (): Plugin => ({
  name: "inject-chrome-stub",
  transformIndexHtml: () => [
    { tag: "script", attrs: { src: "/store-assets/chrome-stub.js" }, injectTo: "head-prepend" }
  ]
});

export default defineConfig({
  root: resolve(__dirname, ".."),
  base: "./",
  plugins: [injectStub()],
  // Default publicDir (public/) copies _locales/ into the demo so the stub can read English strings.
  build: {
    outDir: "site/demo",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "../src/popup/popup.html"),
        options: resolve(__dirname, "../src/options/options.html")
      }
    }
  }
});
