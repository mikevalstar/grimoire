import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the same build works from views:// (desktop) and / (server).
  base: "./",
  plugins: [
    // Must precede the React plugin: it generates src/routeTree.gen.ts from
    // the files in src/routes.
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 4746,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:4747",
    },
  },
});
