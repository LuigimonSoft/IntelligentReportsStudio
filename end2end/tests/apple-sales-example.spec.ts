import { test, expect } from '@playwright/test';

test('Apple sales example displays editable charts and generates its preview', async ({page}) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).reportstudioReady);
  await page.getByRole('combobox', {name:'Example templates'}).selectOption('apple-sales');
  await expect(page.locator('.report-element .chart-svg svg')).toHaveCount(3);
  await expect(page.locator('.chart-svg').first()).toContainText('FY2025 net sales by category');
  await page.getByRole('button', {name:'Preview', exact:true}).click();
  await expect(page.locator('.preview-page canvas').first()).toHaveAttribute('data-rendered','true');
  await expect(page.locator('.preview-page canvas')).toHaveCount(1);
});
