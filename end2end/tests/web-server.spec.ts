import { test, expect } from '@playwright/test';
import config from '../playwright.config.ts';

test('managed static server listens on the configured Playwright port', async ({ page, baseURL }) => {
  test.skip(!!process.env.REPORTSTUDIO_URL, 'An external server is managed by the caller.');
  const server = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer;
  expect(server?.env?.REPORTSTUDIO_PORT).toBe(new URL(baseURL!).port);
  await page.goto('/');
  await expect(page).toHaveURL(baseURL + '/');
  await page.waitForFunction(() => (window as any).reportstudioReady === true);
});
