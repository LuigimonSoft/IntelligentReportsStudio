import { defineConfig, devices } from '@playwright/test';

const externalURL = process.env.REPORTSTUDIO_URL;
const port = Number(process.env.REPORTSTUDIO_PORT || 1423);
const baseURL = externalURL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests',
  testIgnore: '**/._*',
  outputDir: process.env.REPORTSTUDIO_TEST_OUTPUT || 'test-results',
  timeout: 120000,
  expect: { timeout: 30000 },
  workers: 1,
  // An explicitly provided URL is caller-managed. Otherwise own an isolated server,
  // so tests cannot accidentally run against an old or actively edited app.
  webServer: externalURL ? undefined : {
    command: 'node end2end/serve-static.mjs',
    cwd: '..',
    url: baseURL,
    timeout: 120000,
    reuseExistingServer: false,
  },
  reporter: [['list'], ['html', { open: 'never', ...(process.env.REPORTSTUDIO_HTML_OUTPUT ? { outputFolder: process.env.REPORTSTUDIO_HTML_OUTPUT } : {}) }]],
  use: { baseURL, trace: 'retain-on-failure', viewport: { width: 1600, height: 1000 } },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: { executablePath: process.env.REPORTSTUDIO_CHROMIUM } } },
    ...(process.env.REPORTSTUDIO_WEBKIT ? [{ name: 'webkit', use: { ...devices['Desktop Safari'] } }] : []),
  ],
});
