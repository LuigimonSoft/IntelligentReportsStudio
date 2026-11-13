import { test, expect } from '@playwright/test';

test('overlapping preview requests leave the newest canvas complete', async ({page}) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).reportstudioReady === true);
  const result = await page.evaluate(async () => {
    const host = document.createElement('div');
    host.id = 'pdf-pages';
    const canvas = document.createElement('canvas');
    canvas.id = 'pdf-page-1';
    host.append(canvas); document.body.append(host);
    const runtime = await import('/vendor/reportstudio-runtime.js');
    const layout = {width: 8.5, height: 11, title: 'Preview race', pages: [{number: 1, elements: []}]};
    try {
      await Promise.all([0.5, 1, 1.5].map(zoom => runtime.call(JSON.stringify({action:'render-preview', args:{layout, zoom}}))));
      return {rendered:canvas.dataset.rendered, scale:Number(canvas.dataset.renderScale), width:canvas.width};
    } finally { host.remove(); }
  });
  expect(result).toEqual({rendered:'true', scale:2, width:1224});
});
