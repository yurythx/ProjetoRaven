import { defineConfig, devices } from "@playwright/test";

const isDocker = process.env.E2E_TARGET === "docker";
const baseURL = isDocker ? "http://127.0.0.1:3006" : "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 120_000,
  use: {
    baseURL,
    trace: "off",
    screenshot: "only-on-failure",
    video: "off",
  },

  // Only spin up the local Next.js server when not targeting docker
  ...(!isDocker && {
    webServer: {
      command: "npm run start:e2e",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  }),

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
