import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const path = id.replaceAll("\\", "/");
          if (path.includes("/node_modules/zrender/")) return "vendor-renderer";
          if (path.includes("/node_modules/echarts/")) return "vendor-charts";
          if (path.includes("/node_modules/react/") || path.includes("/node_modules/react-dom/")) {
            return "vendor-react";
          }
          if (path.includes("/node_modules/lucide-react/")) return "vendor-icons";
          return undefined;
        },
      },
    },
  },
});
