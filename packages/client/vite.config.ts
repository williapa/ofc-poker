import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function deploymentBase(value: string | undefined): string {
  if (!value || value === "/") return "/";
  return `/${value.replace(/^\/+|\/+$/g, "")}/`;
}

export default defineConfig({
  // GitHub repository pages are served from /<repository>/. Local builds use /.
  base: deploymentBase(process.env.VITE_BASE_PATH),
  plugins: [react()],
  build: {
    // Three.js and the lazy Playroom adapter are intentionally separate large
    // boundaries. Keep a regression budget just above their current output.
    chunkSizeWarningLimit: 1100,
  },
});
