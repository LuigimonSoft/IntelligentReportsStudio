import {test, expect} from '@playwright/test';

test.beforeEach(async ({page}) => {
  await page.addInitScript(() => {
    (window as any).__TAURI__ = {core: {invoke: async (command: string, args: any = {}) => {
      const storage = window.localStorage;
      switch (command) {
        case 'confirm_discard_changes': return window.confirm(args.message);
        case 'load_recovery': return storage.getItem('test-recovery');
        case 'save_recovery': storage.setItem('test-recovery', JSON.stringify(args.document)); return;
        case 'clear_recovery': storage.removeItem('test-recovery'); return;
        case 'list_recent_documents': return ['/reports/invoice.json'];
        case 'open_recent_document': return storage.getItem('test-recent');
        default: return true;
      }
    }}};
  });
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/');
  await page.waitForFunction(() => (window as any).reportstudioReady === true);
});

test('recovers an edited report after an unexpected reload', async ({page}) => {
  await page.getByRole('textbox', {name:'Report title'}).fill('Recovery test');
  await page.getByRole('textbox', {name:'Report title'}).blur();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('test-recovery'))).toContain('Recovery test');
  await page.reload();
  await expect(page.getByRole('textbox', {name:'Report title'})).toHaveValue('Recovery test');
  await expect(page.getByText('Unsaved changes')).toBeVisible();
});

test('opens a recent report after confirming replacement of edits', async ({page}) => {
  await page.getByRole('textbox', {name:'Report title'}).fill('Recent test');
  await page.getByRole('textbox', {name:'Report title'}).blur();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('test-recovery'))).toContain('Recent test');
  await page.evaluate(() => { localStorage.setItem('test-recent', localStorage.getItem('test-recovery')!); });
  await page.getByRole('textbox', {name:'Report title'}).fill('Unsaved edit');
  await page.getByRole('textbox', {name:'Report title'}).blur();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('reportstudio:file-menu', {detail:{action:'open-recent', args:{path:'/reports/invoice.json'}}}))); 
  await expect(page.getByRole('textbox', {name:'Report title'})).toHaveValue('Recent test');
});

test('canceling replacement keeps edits and does not open the recent report', async ({page}) => {
  page.removeAllListeners('dialog');
  page.on('dialog', dialog => dialog.dismiss());
  const title = page.getByRole('textbox', {name:'Report title'});
  await title.fill('Keep these edits');
  await title.blur();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('reportstudio:file-menu', {detail:{action:'open-recent', args:{path:'/reports/invoice.json'}}}))); 
  await expect(title).toHaveValue('Keep these edits');
  await expect(page.getByText('Unsaved changes')).toBeVisible();
});

test('declining recovery removes the recovery copy', async ({page}) => {
  const title = page.getByRole('textbox', {name:'Report title'});
  await title.fill('Discard recovery');
  await title.blur();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('test-recovery'))).toContain('Discard recovery');
  page.removeAllListeners('dialog');
  page.on('dialog', dialog => dialog.dismiss());
  await page.reload();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('test-recovery'))).toBeNull();
  await expect(title).not.toHaveValue('Discard recovery');
});


test('native menu events switch tabs and undo edits', async ({page}) => {
  const title = page.getByRole('textbox', {name:'Report title'});
  const previous = await title.inputValue();
  await title.fill('Menu edit');
  await title.blur();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('reportstudio:file-menu', {detail:{action:'undo',args:{}}})));
  await expect(title).toHaveValue(previous);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('reportstudio:file-menu', {detail:{action:'view-data',args:{}}})));
  await expect(page.locator('.data-workspace')).toBeVisible();
});

test('reports a failed recovery read without overwriting the existing copy', async ({browser}) => {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    (window as any).recoveryWrites = 0;
    (window as any).__TAURI__ = {core:{invoke:async (command: string) => {
      if (command === 'load_recovery') throw new Error('read failed');
      if (command === 'save_recovery' || command === 'clear_recovery') (window as any).recoveryWrites++;
      return true;
    }}};
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).reportstudioReady === true);
  await expect(page.getByRole('status')).toContainText('Recovery could not be loaded');
  const title = page.getByRole('textbox', {name:'Report title'});
  await title.fill('Edited after failure');
  await title.blur();
  await expect.poll(() => page.evaluate(() => (window as any).recoveryWrites)).toBe(0);
  await page.close();
});

test('reports a failed recovery write', async ({browser}) => {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    (window as any).__TAURI__ = {core:{invoke:async (command: string) => {
      if (command === 'load_recovery') return null;
      if (command === 'save_recovery') throw new Error('write failed');
      return true;
    }}};
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).reportstudioReady === true);
  const title = page.getByRole('textbox', {name:'Report title'});
  await title.fill('Unsaved report');
  await title.blur();
  await expect(page.getByRole('status')).toContainText('Recovery could not be saved');
  await page.close();
});

test('preserves the previous recovery if the user edits while it is loading', async ({browser}) => {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    (window as any).recoveryWrites = 0;
    (window as any).__TAURI__ = {core:{invoke:async (command: string) => {
      if (command === 'load_recovery') {
        return await new Promise(resolve => { (window as any).finishRecoveryLoad = () => resolve(null); });
      }
      if (command === 'save_recovery' || command === 'clear_recovery') (window as any).recoveryWrites++;
      return true;
    }}};
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).reportstudioReady === true);
  const title = page.getByRole('textbox', {name:'Report title'});
  await title.fill('Edited while loading');
  await title.blur();
  await page.waitForFunction(() => typeof (window as any).finishRecoveryLoad === 'function');
  await page.evaluate(() => (window as any).finishRecoveryLoad());
  await expect(page.getByRole('status')).toContainText('Recovery was paused');
  await expect.poll(() => page.evaluate(() => (window as any).recoveryWrites)).toBe(0);
  await expect(title).toHaveValue('Edited while loading');
  await page.close();
});
