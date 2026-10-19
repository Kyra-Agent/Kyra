import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // The largest chunk is three.js (~540 kB, ~135 kB gzip). It is only
    // loaded on demand after first paint by the optional 3D scenes.
    chunkSizeWarningLimit: 600,
  },
});
