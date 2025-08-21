// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    proxy: {
      "/api":       { target: "https://hric.onrender.com", changeOrigin: true, secure: true },
      "/socket.io": { target: "https://hric.onrender.com", ws: true, changeOrigin: true, secure: true },
    },
  },
});