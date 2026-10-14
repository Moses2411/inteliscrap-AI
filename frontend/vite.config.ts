import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png", "*.html"],
      manifest: {
        name: "InteliScrap AI",
        short_name: "InteliScrap",
        description: "Empowering Informal Recyclers with Multimodal Edge Intelligence",
        theme_color: "#059669",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      // Custom service worker (injectManifest). Source lives in src/sw.js so it
      // is bundled + gets the precache manifest injected, instead of being
      // copied verbatim from public/.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  build: {
    rollupOptions: {
      output: {
        // Keep the ONNX Runtime WASM binary at a stable, unhashed path so the
        // runtime can load it from /assets/ and we don't also ship a duplicate
        // copy under public/. Every other asset keeps content hashing.
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name ?? "";
          return name.endsWith(".wasm")
            ? "assets/[name][extname]"
            : "assets/[name]-[hash][extname]";
        },
      },
    },
  },
  server: {
    host: true,
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});