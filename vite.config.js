import { VitePWA } from "vite-plugin-pwa";

// Built as an app that installs to the home screen and then runs with no
// connection: every file is saved on the device the first time it opens.
export default {
  base: "./", // works from any address, including a sub-folder
  build: { chunkSizeWarningLimit: 4000 },
  plugins: [
    VitePWA({
      registerType: "autoUpdate", // a newer version replaces the saved one next time it opens online
      includeAssets: ["icons/*.png"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,json}"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      manifest: {
        name: "Map",
        short_name: "Map",
        description: "A calm map: touch a place to hear its name.",
        display: "fullscreen",
        orientation: "landscape",
        background_color: "#ecebe6",
        theme_color: "#ecebe6",
        start_url: ".",
        scope: ".",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
};
