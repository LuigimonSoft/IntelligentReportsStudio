import {test,expect} from '@playwright/test';
async function clean(page:any){await expect(page.locator('[style]')).toHaveCount(0);}
test('rendered editor and dialogs use external CSS without inline styles',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>(window as any).reportstudioReady);
 await clean(page);
 await expect(page.locator('link[data-report-layout]')).toHaveAttribute('href','/report-layout.css');
 const before=await page.locator('.report-element').first().boundingBox();expect(before!.width).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Text',exact:true}).click();await clean(page);
 await page.getByRole('button',{name:'Chart',exact:true}).click();
 await page.getByRole('button',{name:'Edit chart details',exact:true}).click();await clean(page);
 const dialog=page.getByRole('dialog');await expect(dialog.locator('.chart-preview-surface svg')).toBeVisible();
 const metric=async(locator:any)=>locator.evaluate((el:Element)=>{const s=getComputedStyle(el);return {height:s.height,border:s.borderTopColor,radius:s.borderRadius,fontSize:s.fontSize};});
 const chartInput=await metric(dialog.getByLabel('Chart title',{exact:true}));
 const chartSelect=await metric(dialog.getByLabel('Chart type',{exact:true}));
 expect(chartSelect).toEqual(chartInput);
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Data',exact:true}).click();await clean(page);
 await page.getByRole('button',{name:'Add table',exact:true}).click();await clean(page);
 expect(await metric(page.getByLabel('Table name',{exact:true}))).toEqual(chartInput);
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Records',exact:true}).click();await clean(page);
 await page.getByRole('button',{name:'Preview',exact:true}).click();
 await expect(page.locator('canvas[data-rendered="true"]').first()).toBeVisible();await clean(page);
});
test('dynamic layout rules are reclaimed when their views close',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>(window as any).reportstudioReady);
 const count=()=>page.evaluate(()=>Array.from((document.querySelector('link[data-report-layout]') as HTMLLinkElement).sheet!.cssRules).filter(rule=>rule.cssText.startsWith('[data-layout=')).length);
 await page.getByRole('button',{name:'Data',exact:true}).click();
 await expect.poll(count).toBeGreaterThan(0);const baseline=await count();
 for(let i=0;i<3;i++){
   await page.getByRole('button',{name:'Design',exact:true}).click();await expect(page.locator('.report-element').first()).toBeVisible();await clean(page);
   await page.getByRole('button',{name:'Data',exact:true}).click();await expect.poll(count).toBe(baseline);
 }
});
