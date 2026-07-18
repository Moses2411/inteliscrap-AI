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
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/v1\/prices\/?/,
            handler: "NetworkFirst",
            options: {
              cacheName: "price-cache",
              expiration: { maxEntries: 1, maxAgeSeconds: 86400 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    host: true,
    port: 5173,
  },
});
