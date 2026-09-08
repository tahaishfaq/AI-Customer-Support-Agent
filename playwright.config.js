const { defineConfig, devices } = require("@playwright/test");

const port = Number(process.env.PLAYWRIGHT_PORT || 4320);
const runId = `${Date.now()}-${process.pid}`;
const realtimeStream = `aide:realtime:playwright:${runId}`;
const realtimeConsumerGroup = `aide-playwright-${port}-${runId}`;
const realtimeConsumerName = `playwright-${port}-${runId}`;

// Keep the browser harness isolated from stale events and consumer state left
// by earlier local runs. The app server receives the same values below.
process.env.REALTIME_STREAM_NAME ||= realtimeStream;
process.env.REALTIME_CONSUMER_GROUP ||= realtimeConsumerGroup;
process.env.REALTIME_CONSUMER_NAME ||= realtimeConsumerName;

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
    command: `NODE_ENV=production PORT=${port} REALTIME_URL=http://127.0.0.1:${port} REALTIME_ALLOWED_ORIGINS=http://127.0.0.1:${port} REALTIME_STREAM_NAME=${realtimeStream} REALTIME_CONSUMER_GROUP=${realtimeConsumerGroup} REALTIME_CONSUMER_NAME=${realtimeConsumerName} npm run start`,
    url: `http://127.0.0.1:${port}/readyz`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
