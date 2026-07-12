import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative assets make the same build work at / locally and /ofcpoker/ on Pages.
  base: "./",
  plugins: [react()],
});
