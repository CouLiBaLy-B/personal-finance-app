import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isPWA = process.env.VITE_PWA !== "false"; // default: PWA on

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(isPWA
      ? [
          VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["favicon.ico"],
            manifest: {
              name: "FinTrack — Gestion Financière",
              short_name: "FinTrack",
              description: "Gérez vos finances personnelles, hors-ligne et multi-devises.",
              theme_color: "#0ea5e9",
              background_color: "#f8fafc",
              display: "standalone",
              start_url: "/",
              icons: [
                { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
                { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
                { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
              ],
            },
            workbox: {
              globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
              runtimeCaching: [
                {
                  urlPattern: /^https:\/\/open\.er-api\.com\/.*/i,
                  handler: "StaleWhileRevalidate",
                  options: {
                    cacheName: "fx-rates",
                    expiration: { maxEntries: 10, maxAgeSeconds: 6 * 60 * 60 },
                  },
                },
              ],
            },
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
