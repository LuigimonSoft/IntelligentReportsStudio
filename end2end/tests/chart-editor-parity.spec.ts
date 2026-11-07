import {test,expect} from '@playwright/test';
test('chart editor displays panels, preview, data and explicit bindings',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('/');await page.waitForFunction(()=>(window as any).reportstudioReady);
 await page.getByRole('button',{name:'Chart',exact:true}).click();
 await page.getByRole('button',{name:'Edit chart details',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await expect(dialog.getByRole('heading',{name:'Chart editor',exact:true})).toBeVisible();
 await expect(dialog.getByRole('heading',{name:'Chart settings',exact:true})).toBeVisible();
 await expect(dialog.getByRole('heading',{name:'Chart preview',exact:true})).toBeVisible();
 await expect(dialog.getByRole('heading',{name:'Available tables',exact:true})).toBeVisible();
 await expect(dialog.locator('.chart-data-preview tbody tr')).toHaveCount(3);
 await expect(dialog.locator('.chart-data-preview')).toContainText('Implementation consulting');
 await expect(dialog.locator('.chart-data-preview')).toContainText('40');
 for(const select of await dialog.locator('.chart-editor-settings select').all()) {
   expect((await select.boundingBox())!.height).toBeCloseTo(36,0);
 }
 const settings=await dialog.locator('.chart-editor-settings').boundingBox();
 const preview=await dialog.locator('.chart-editor-preview').boundingBox();
 const sidebar=await dialog.locator('.chart-data-sidebar').boundingBox();
 expect(settings!.width).toBeCloseTo(240,0);expect(sidebar!.width).toBeCloseTo(270,0);
 expect(Math.abs(settings!.y-preview!.y)).toBeLessThan(2);
 const surface=await dialog.locator('.chart-preview-surface').boundingBox();
 const svg=dialog.locator('.chart-preview-surface svg');await expect(svg).toBeVisible();
 const svgBox=await svg.boundingBox();expect(svgBox!.height).toBeLessThanOrEqual(surface!.height);expect(svgBox!.height).toBeGreaterThan(surface!.height-4);
 const field=dialog.locator('.chart-source-fields > div').filter({hasText:'# unitPrice'});
 await field.getByRole('button',{name:'Value',exact:true}).click();
 await expect(dialog.getByLabel('Value field',{exact:true})).toHaveValue('unitPrice');
 await expect(dialog.locator('.chart-data-preview')).toContainText('1500');
 const numeric=dialog.locator('.chart-source-fields > div').filter({hasText:'# quantity'});
 await numeric.getByRole('button',{name:'Category',exact:true}).click();
 await expect(dialog.getByLabel('Category field',{exact:true})).toHaveValue('quantity');
 await dialog.getByLabel('Category field',{exact:true}).selectOption('description');
 await dialog.getByLabel('Value field',{exact:true}).selectOption('quantity');
 await page.screenshot({path:test.info().outputPath('reportstudio-chart-editor-'+test.info().project.name+'.png')});
 await dialog.getByRole('button',{name:'Apply chart',exact:true}).click();await expect(dialog).toBeHidden();
 await expect(page.locator('.inspector').getByLabel('Value field',{exact:true})).toHaveValue('quantity');
});

test('native chart host uses the Spanish layout without workspace chrome',async({page})=>{
 await page.setViewportSize({width:1400,height:860});
 await page.goto('/');await page.waitForFunction(()=>(window as any).reportstudioReady);
 await page.getByRole('button',{name:'Chart',exact:true}).click();
 await page.evaluate(()=>{(window as any).__TAURI_INTERNALS__={invoke:async(_:string,args:any)=>{(window as any).chartContext=args.context;return null;}};});
 await page.getByRole('button',{name:'Edit chart details',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>!!(window as any).chartContext)).toBe(true);
 const context=await page.evaluate(()=>(window as any).chartContext);
 await page.addInitScript(context=>{(window as any).__TAURI_INTERNALS__={invoke:async(command:string)=>command==='editor_context'?{...context,language:'es'}:null};},context);
 await page.goto('/index.html?editor=1');
 const dialog=page.getByRole('dialog');
 await expect(dialog.getByRole('heading',{name:'Editor de gráficos',exact:true})).toBeVisible();
 await expect(dialog.locator('.chart-preview-surface svg')).toBeVisible();
 await expect(dialog.locator('.chart-data-preview tbody tr')).toHaveCount(3);
 await expect(page.locator('.studio-main')).toHaveCount(0);
 await expect(dialog.locator('.advanced-definition')).toBeHidden();
 for(const select of await dialog.locator('.chart-editor-settings select').all()) expect((await select.boundingBox())!.height).toBeCloseTo(36,0);
 const a=await dialog.locator('.chart-editor-settings').boundingBox(),b=await dialog.locator('.chart-editor-preview').boundingBox();
 expect(Math.abs(a!.y-b!.y)).toBeLessThan(2);
 await page.screenshot({path:test.info().outputPath('reportstudio-native-chart-es-'+test.info().project.name+'.png')});
});

test('side panels fill the modal and scroll independently at different window heights',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>(window as any).reportstudioReady);
 await page.getByRole('button',{name:'Chart',exact:true}).click();
 await page.getByRole('button',{name:'Edit chart details',exact:true}).click();
 const dialog=page.getByRole('dialog');
 for(const height of [860,600]) {
   await page.setViewportSize({width:1440,height});
   // Expand every table so the source panel also has overflowing content.
   await dialog.locator('.chart-data-sidebar details').evaluateAll(nodes=>nodes.forEach(node=>(node as HTMLDetailsElement).open=true));
   const layout=await dialog.locator('.chart-editor-layout').boundingBox();
   const left=dialog.locator('.chart-editor-settings'),right=dialog.locator('.chart-data-sidebar');
   for(const panel of [left,right]) {
     const bounds=await panel.boundingBox();
     expect(Math.abs(bounds!.y-(layout!.y+20))).toBeLessThan(2);
     expect(Math.abs(bounds!.height-(layout!.height-40))).toBeLessThan(2);
     expect(await panel.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
   }
   const headerBefore=await dialog.locator(':scope > header').boundingBox();
   const footerBefore=await dialog.locator(':scope > footer').boundingBox();
   await left.evaluate(el=>el.scrollTop=el.scrollHeight);
   expect(await left.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
   expect(await right.evaluate(el=>el.scrollTop)).toBe(0);
   const leftScroll=await left.evaluate(el=>el.scrollTop);
   await right.evaluate(el=>el.scrollTop=el.scrollHeight);
   expect(await right.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
   expect(await left.evaluate(el=>el.scrollTop)).toBe(leftScroll);
   expect((await dialog.locator(':scope > header').boundingBox())!.y).toBe(headerBefore!.y);
   expect((await dialog.locator(':scope > footer').boundingBox())!.y).toBe(footerBefore!.y);
   expect(await dialog.evaluate(el=>el.scrollTop)).toBe(0);
   await expect(dialog.getByRole('button',{name:'Apply chart',exact:true})).toBeInViewport();
   await left.evaluate(el=>el.scrollTop=0);await right.evaluate(el=>el.scrollTop=0);
 }
});
