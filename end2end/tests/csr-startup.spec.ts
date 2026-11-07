import {test, expect} from '@playwright/test';

test('static shell mounts CSR without server-rendered content or hydration',async({page,request})=>{
 const response=await request.get('/');expect(response.ok()).toBe(true);const html=await response.text();
 expect(html).not.toContain('class="reportstudio-app"');expect(html).not.toContain('hydrate()');expect(html).not.toContain('leptos-autoreload');
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');await page.waitForFunction(()=>(window as any).reportstudioReady===true);
 expect(await page.evaluate(()=>(window as any).reportstudioRenderMode)).toBe('csr');
 await expect(page.getByRole('button',{name:'New',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'New',exact:true}).click();await expect(page.locator('.report-element')).toHaveCount(0);
 await page.getByRole('button',{name:'Text',exact:true}).click();await expect(page.locator('.report-element')).toHaveCount(1);
 await page.reload();await page.waitForFunction(()=>(window as any).reportstudioReady===true);
 expect(errors).toEqual([]);
});
