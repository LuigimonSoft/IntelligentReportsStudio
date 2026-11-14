import {test, expect} from '@playwright/test';

test.beforeEach(async ({page}) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).reportstudioReady === true);
  await page.getByRole('combobox', {name:'Units', exact:true}).selectOption('mm');
  await page.getByRole('button', {name:'Preview', exact:true}).click();
});

test('page settings apply individual margins, orientation, and custom dimensions; cancel discards edits', async ({page}) => {
  const open = () => page.getByRole('button', {name:'Print settings', exact:true}).click();
  await open();
  let dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Paper size', {exact:true}).selectOption('Letter');
  await dialog.getByLabel('Orientation', {exact:true}).selectOption('landscape');
  await expect(dialog.getByLabel('Width', {exact:true})).toHaveValue('279.4');
  await dialog.getByLabel('Top margin', {exact:true}).fill('15');
  await dialog.getByLabel('Bottom margin', {exact:true}).fill('20');
  await dialog.getByLabel('Left margin', {exact:true}).fill('25');
  await dialog.getByLabel('Right margin', {exact:true}).fill('30');
  await dialog.getByRole('button', {name:'Apply', exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('Page size', {exact:true})).toHaveValue('Letter');
  await expect(page.locator('.preview-panel-information')).toContainText('279 × 216 mm');
  await expect.poll(() => page.evaluate(() => {
    const sheet = (document.querySelector('link[data-report-layout]') as HTMLLinkElement).sheet!;
    const rule = Array.from(sheet.cssRules).find(rule => rule.cssText.startsWith('@page')) as CSSPageRule | undefined;
    return rule?.style.getPropertyValue('size');
  })).toBe('11in 8.5in');
  await expect(page.locator('.preview-page canvas').first()).toBeVisible();
  await open();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Orientation', {exact:true})).toHaveValue('landscape');
  for (const [label, value] of [['Top','15'],['Bottom','20'],['Left','25'],['Right','30']])
    await expect(dialog.getByLabel(`${label} margin`, {exact:true})).toHaveValue(value);
  await dialog.getByLabel('Width', {exact:true}).fill('250');
  await dialog.getByRole('button', {name:'Cancel', exact:true}).click();
  await open();
  await expect(page.getByRole('dialog').getByLabel('Width', {exact:true})).toHaveValue('279.4');
  await page.getByRole('dialog').getByLabel('Width', {exact:true}).fill('250');
  await page.getByRole('dialog').getByRole('button', {name:'Apply', exact:true}).click();
  await expect(page.getByLabel('Page size', {exact:true})).toHaveValue('Custom');
  await open();
  await expect(page.getByRole('dialog').getByLabel('Width', {exact:true})).toHaveValue('250');
});

test('invalid margins cannot be applied', async ({page}) => {
  await page.getByRole('button', {name:'Print settings', exact:true}).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Left margin', {exact:true}).fill('200');
  await dialog.getByRole('button', {name:'Apply', exact:true}).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('status')).toContainText('12.7 mm');
  await dialog.getByRole('button', {name:'Cancel', exact:true}).click();
  await page.getByRole('button', {name:'Print settings', exact:true}).click();
  await expect(page.getByRole('dialog').getByLabel('Left margin', {exact:true})).not.toHaveValue('200');
});

test('native editor returns settings to the report', async ({page}) => {
  await page.evaluate(() => {
    (window as any).editorCalls = [];
    (window as any).__TAURI_INTERNALS__ = {invoke: async (command:string, args:any) => {
      (window as any).editorCalls.push({command,args});
      if (command === 'open_editor') return {...args.context.value, width: 8.5, height: 14, margins:{top:1,bottom:0.5,left:0.75,right:0.25}};
      return null;
    }};
  });
  await page.getByRole('button', {name:'Print settings', exact:true}).click();
  await expect.poll(() => page.evaluate(() => (window as any).editorCalls.length)).toBe(1);
  expect(await page.evaluate(() => (window as any).editorCalls[0].args.context.kind)).toBe('Print settings');
  await expect(page.getByLabel('Page size', {exact:true})).toHaveValue('Legal');
});


test('standalone native editor validates and returns the edited page', async ({page}) => {
  await page.evaluate(() => {
    (window as any).__TAURI_INTERNALS__ = {invoke: async (_command:string, args:any) => {
      (window as any).editorContext = args.context; return null;
    }};
  });
  await page.getByRole('button', {name:'Print settings', exact:true}).click();
  await expect.poll(() => page.evaluate(() => !!(window as any).editorContext)).toBe(true);
  const context = await page.evaluate(() => (window as any).editorContext);
  await page.addInitScript(context => {
    (window as any).editorCalls = [];
    (window as any).__TAURI_INTERNALS__ = {invoke: async (command:string, args:any) => {
      (window as any).editorCalls.push({command,args});
      return command === 'editor_context' ? context : null;
    }};
  }, context);
  await page.goto('/index.html?editor=1');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Top margin', {exact:true}).fill('25.4');
  await dialog.getByRole('button', {name:'Apply', exact:true}).click();
  await expect.poll(() => page.evaluate(() => (window as any).editorCalls.some((call:any) => call.command === 'finish_editor'))).toBe(true);
  const result = await page.evaluate(() => (window as any).editorCalls.find((call:any) => call.command === 'finish_editor').args.result);
  expect(result.margins.top).toBeCloseTo(1);
});

test('preview image and exported PDF honor all four margins', async ({page,browserName}) => {
  const canvas = page.locator('.preview-page canvas').first();
  await expect(canvas).toHaveAttribute('data-rendered', 'true');
  const bounds = async (locator: typeof canvas) => locator.evaluate((element: HTMLCanvasElement) => {
    const {width, height} = element;
    const pixels = element.getContext('2d')!.getImageData(0, 0, width, height).data;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (pixels[i + 3] && Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) < 235) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
    return {width, height, minX, minY, maxX, maxY};
  });
  const before = await bounds(canvas);
  await page.getByRole('button', {name:'Print settings', exact:true}).click();
  const dialog = page.getByRole('dialog');
  for (const side of ['Top','Bottom','Left','Right'])
    await dialog.getByLabel(`${side} margin`, {exact:true}).fill('30');
  await dialog.getByRole('button', {name:'Apply', exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(canvas).toHaveAttribute('data-rendered', 'true');
  const after = await bounds(canvas);
  expect(after.minX).toBeGreaterThan(before.minX + 3);
  expect(after.minY).toBeGreaterThan(before.minY + 3);
  expect(after.minX).toBeGreaterThanOrEqual(Math.floor(after.width * 30 / 210) - 2);
  expect(after.maxX).toBeLessThanOrEqual(after.width - Math.floor(after.width * 30 / 210) + 2);
  expect(after.minY).toBeGreaterThanOrEqual(Math.floor(after.height * 30 / 297) - 2);
  expect(after.maxY).toBeLessThanOrEqual(after.height - Math.floor(after.height * 30 / 297) + 2);
  await page.evaluate(() => {
    (window as any).__TAURI__ = {core:{invoke: async (command:string, args:any) => {
      if (command === 'save_pdf') (window as any).exportedPdf = args.bytes;
      return true;
    }}};
  });
  await page.getByRole('button', {name:'Download PDF', exact:true}).click();
  await expect.poll(() => page.evaluate(() => (window as any).exportedPdf?.length || 0)).toBeGreaterThan(1000);
  const saved = await page.evaluate(async () => {
    const manifest = await fetch('/vendor/runtime-manifest.json').then(response => response.json());
    const path = Object.entries<any>(manifest.outputs).find(([, value]) => value.entryPoint === 'node_modules/pdfjs-dist/build/pdf.mjs')![0];
    const pdfjs = await import('/vendor/' + path.split('/').pop());
    pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.min.mjs';
    const loading = pdfjs.getDocument({data:new Uint8Array((window as any).exportedPdf)});
    const pdf = await loading.promise;
    const first = await pdf.getPage(1);
    const preview = document.querySelector('.preview-page canvas') as HTMLCanvasElement;
    const viewport = first.getViewport({scale:Number(preview.dataset.renderScale)});
    const image = document.createElement('canvas'); image.width = Math.ceil(viewport.width); image.height = Math.ceil(viewport.height);
    await first.render({canvasContext:image.getContext('2d'), canvas:image, viewport}).promise;
    const a = preview.getContext('2d')!.getImageData(0, 0, preview.width, preview.height).data;
    const firstRender = image.getContext('2d')!.getImageData(0, 0, image.width, image.height).data;
    const repeated = document.createElement('canvas'); repeated.width = image.width; repeated.height = image.height;
    const repeatedContext = repeated.getContext('2d')!;
    await first.render({canvasContext:repeatedContext, canvas:repeated, viewport}).promise;
    // Compare a second render after PDF.js has completed the initial pass.
    const b = repeatedContext.getImageData(0, 0, repeated.width, repeated.height).data;
    let differences = 0, repeatDifferences = 0, differentPixels = 0, maxDelta = 0, totalDelta = 0;
    let minX=image.width, minY=image.height, maxX=-1, maxY=-1;
    for (let i = 0; i < a.length; i += 4) {
      let changed = false;
      for (let channel = 0; channel < 4; channel++) {
        const delta = Math.abs(a[i + channel] - b[i + channel]);
        if (delta) { differences++; changed = true; maxDelta = Math.max(maxDelta, delta); totalDelta += delta; }
        if (b[i + channel] !== firstRender[i + channel]) repeatDifferences++;
      }
      if (changed) { const x=(i/4)%image.width, y=Math.floor(i/4/image.width); differentPixels++; minX=Math.min(minX,x); minY=Math.min(minY,y); maxX=Math.max(maxX,x); maxY=Math.max(maxY,y); }
    }
    await loading.destroy();
    const bytes = (window as any).exportedPdf as number[]; let hash=2166136261; for (const byte of bytes) hash=Math.imul(hash^byte,16777619);
    return {width:image.width,height:image.height,differences,repeatDifferences,differentPixels,maxDelta,totalDelta,bounds:{minX,minY,maxX,maxY},scale:preview.dataset.renderScale,previewPdf:preview.dataset.pdfFingerprint,exportedPdf:`${bytes.length}:${hash>>>0}`};
  });
  expect(saved.previewPdf, JSON.stringify(saved)).toBe(saved.exportedPdf);
  expect(saved.width).toBe(after.width);
  expect(saved.height).toBe(after.height);
  if (process.platform === 'linux' && browserName === 'webkit') {
    expect(saved.totalDelta / (saved.width * saved.height * 4), JSON.stringify(saved)).toBeLessThan(4);
    expect(saved.differentPixels / (saved.width * saved.height), JSON.stringify(saved)).toBeLessThan(0.18);
  } else {
    expect(saved.differences, JSON.stringify(saved)).toBe(0);
  }
});

test('paper names follow the selected language in both selectors', async ({page}) => {
  const languages = page.locator('.language-picker select');
  const sizes = page.locator('.preview-toolbar select').last();
  await sizes.selectOption('Letter');
  for (const [language, letter, legal, custom, button] of [
    ['en', 'Letter', 'Legal', 'Custom', 'Print settings'],
    ['es', 'Carta', 'Oficio', 'Personalizado', 'Propiedades de impresión'],
    ['fr', 'Lettre', 'Légal', 'Personnalisé', 'Paramètres d’impression'],
  ]) {
    await languages.selectOption(language);
    await expect(sizes).toHaveValue('Letter');
    await expect(sizes.locator('option[value="A4"]')).toHaveText('A4 (210 × 297 mm)');
    await expect(sizes.locator('option[value="Letter"]')).toHaveText(`${letter} (216 × 279 mm)`);
    await expect(sizes.locator('option[value="Legal"]')).toHaveText(`${legal} (216 × 356 mm)`);
    await expect(sizes.locator('option[value="Custom"]')).toHaveText(custom);
    await page.getByRole('button', {name:button, exact:true}).click();
    const dialog = page.getByRole('dialog');
    const paper = dialog.locator('select').first();
    await expect(paper).toHaveValue('Letter');
    await expect(paper.locator('option[value="Letter"]')).toHaveText(`${letter} (216 × 279 mm)`);
    await expect(paper.locator('option[value="Legal"]')).toHaveText(`${legal} (216 × 356 mm)`);
    await dialog.locator('footer button').first().click();
  }
});
