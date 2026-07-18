import { defineConfig, devices } from "@playwright/test";

const deploymentPath = process.env.VITE_BASE_PATH
  ? `/${process.env.VITE_BASE_PATH.replace(/^\/+|\/+$/g, "")}/`
  : "/";

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore:
    process.env.SKIP_MULTIPLAYER_JOURNEY_E2E === "true"
      ? "**/multiplayer-journey.spec.ts"
      : [],
  fullyParallel: false,
  // Full-hand WebGL journeys are resource-intensive and share the preview
  // server's in-memory E2E transport. Serial workers keep CI deterministic.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:4173${deploymentPath}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command:
      "VITE_E2E=true npm run build && VITE_E2E=true npm run preview --workspace @ofcpoker/client -- --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
