import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Build optimizations for production bundles
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunk for React and core libraries
          if (
            id.includes("react") ||
            id.includes("react-dom") ||
            id.includes("react-router-dom")
          ) {
            return "vendor";
          }

          // UI library chunk for shadcn/ui and Radix components
          if (id.includes("@radix-ui") || id.includes("sonner")) {
            return "ui";
          }

          // Tauri API chunk
          if (id.includes("@tauri-apps")) {
            return "tauri";
          }

          // Utilities chunk
          if (
            id.includes("class-variance-authority") ||
            id.includes("clsx") ||
            id.includes("tailwind-merge") ||
            id.includes("lucide-react")
          ) {
            return "utils";
          }

          // Keep large node_modules separate
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
    // Increase chunk size warning limit to 750kB (more reasonable for desktop apps)
    chunkSizeWarningLimit: 750,
    // Enable minification and compression
    minify: "esbuild",
    target: "es2020",
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
