import {test, expect} from '@playwright/test';

test('studio controls follow the selected theme across workspaces', async ({page}) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).reportstudioReady === true);
  const color = (selector: string, property: 'backgroundColor' | 'color') =>
    page.locator(selector).first().evaluate((element, property) => getComputedStyle(element)[property], property);
  const unit = '.ruler-unit-control';
  const tabs = '.properties-sidebar .sidebar-tabs';
  await expect.poll(() => color(unit, 'backgroundColor')).toBe('rgb(255, 255, 255)');
  await page.getByRole('button', {name: 'Switch to dark mode', exact: true}).click();
  await expect.poll(() => color(unit, 'backgroundColor')).toBe('rgb(39, 57, 80)');
  await expect.poll(() => color(tabs, 'backgroundColor')).toBe('rgb(23, 37, 58)');
  await expect.poll(() => color(`${tabs} button.active`, 'backgroundColor')).toBe('rgb(51, 74, 101)');
  await page.getByRole('button', {name: 'Styles', exact: true}).click();
  await expect(page.locator(`${tabs} button.active`)).toHaveText('Styles');
  await expect.poll(() => color('.fields-sidebar.palette summary', 'color')).toBe('rgb(222, 235, 252)');
  await expect.poll(() => color('.sections-bar .section-card', 'backgroundColor')).toBe('rgb(39, 57, 80)');
  await page.getByRole('button', {name: 'Data', exact: true}).click();
  await expect.poll(() => color('.model-card.active', 'backgroundColor')).toBe('rgb(36, 53, 76)');
  await page.getByRole('button', {name: 'Records', exact: true}).click();
  await expect(page.locator('.records-toolbar')).toBeVisible();
  await page.getByRole('button', {name: 'Preview', exact: true}).click();
  await expect.poll(() => color('.preview-zoom', 'backgroundColor')).toBe('rgb(39, 57, 80)');
  await expect.poll(() => color('.preview-zoom .studio-button', 'color')).toBe('rgb(222, 235, 252)');
  await expect.poll(() => color('.preview-options-panel summary', 'color')).toBe('rgb(226, 232, 240)');
  await page.getByRole('button', {name: 'Switch to light mode', exact: true}).click();
  await page.getByRole('button', {name: 'Design', exact: true}).click();
  await expect.poll(() => color(unit, 'backgroundColor')).toBe('rgb(255, 255, 255)');
});
