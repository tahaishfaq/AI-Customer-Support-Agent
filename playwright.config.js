const { defineConfig, devices } = require("@playwright/test");

const port = Number(process.env.PLAYWRIGHT_PORT || 4320);

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `NODE_ENV=production PORT=${port} REALTIME_URL=http://127.0.0.1:${port} REALTIME_ALLOWED_ORIGINS=http://127.0.0.1:${port} REALTIME_CONSUMER_GROUP=aide-playwright-${port} REALTIME_CONSUMER_NAME=playwright-${port} npm run start`,
    url: `http://127.0.0.1:${port}/readyz`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
