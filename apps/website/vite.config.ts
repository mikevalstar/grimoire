import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [TanStackRouterVite({ quoteStyle: "double" }), react()],
  server: {
    proxy: {
      "/api": "http://localhost:4444",
    },
  },
});
