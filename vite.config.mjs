import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
  base: loadEnv(mode, process.cwd(), "VITE_").VITE_BASE_PATH || "/",
  build: { outDir: "dist/client" },
  optimizeDeps: { include: ["react", "react-dom/client"] },
  server: {
    host: "127.0.0.1",
    allowedHosts: ["terminal.local"],
    proxy: { "/api": "http://127.0.0.1:4317" },
    warmup: { clientFiles: ["./src/main.jsx"] },
  },
  plugins: [react()],
}));
