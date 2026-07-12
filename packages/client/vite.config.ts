import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative assets make the same build work at / locally and /ofcpoker/ on Pages.
  base: "./",
  plugins: [react()],
  build: {
    // Three.js and the lazy Playroom adapter are intentionally separate large
    // boundaries. Keep a regression budget just above their current output.
    chunkSizeWarningLimit: 1100,
  },
});
