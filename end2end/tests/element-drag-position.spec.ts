import {test,expect} from '@playwright/test';
test('moving a report element preserves its offset, crosses sections and cancels outside the paper',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>(window as any).reportstudioReady);
 await page.getByRole('button',{name:'New',exact:true}).click();await page.getByRole('button',{name:'Text',exact:true}).click();
 const paper=page.locator('.report-paper'), first=page.locator('.report-band').nth(0), second=page.locator('.report-band').nth(1);
 const element=first.locator('.report-element').filter({hasText:'Text'}).first();await expect(element).toBeVisible();
 const start=(await element.boundingBox())!;let x=start.x+5,y=start.y+5;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+35,y,{steps:8});await page.mouse.up();
 await expect.poll(async()=>{const b=await element.boundingBox();return Math.abs(b!.x-start.x-35)}).toBeLessThan(3);
 let moved=(await element.boundingBox())!;const dest=(await second.boundingBox())!;
 x=moved.x+5;y=moved.y+5;const ty=dest.y+Math.min(8,dest.height/2);
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+15,ty,{steps:12});await page.mouse.up();
 const transferred=second.locator('.report-element').filter({hasText:'Text'}).first();await expect(transferred).toHaveCount(1);
 const before=(await transferred.boundingBox())!,p=(await paper.boundingBox())!;
 await page.mouse.move(before.x+5,before.y+5);await page.mouse.down();await page.mouse.move(p.x-30,before.y+5,{steps:10});await page.mouse.up();
 await expect.poll(async()=>{const b=await transferred.boundingBox();return Math.abs(b!.x-before.x)+Math.abs(b!.y-before.y)}).toBeLessThan(1);
});
