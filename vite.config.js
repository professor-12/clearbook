import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: "client",
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy: { "/api": "http://localhost:5174" } },
  build: { outDir: "../public", emptyOutDir: true, chunkSizeWarningLimit: 1200 },
});
