import {test,expect} from '@playwright/test';
test('design shows section heights without padding them to a full page',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>(window as any).reportstudioReady);
 await page.getByRole('button',{name:'New',exact:true}).click();
 await expect(page.getByLabel('Report title')).toHaveValue('New report');
 await expect(page.locator('.report-band .report-element')).toHaveCount(0);
 const paper=page.locator('.report-paper'), bands=page.locator('.report-band');await expect(bands).toHaveCount(7);
 const p=(await paper.boundingBox())!, first=(await bands.first().boundingBox())!, last=(await bands.last().boundingBox())!;
 expect(Math.abs(p.height-(last.y+last.height-first.y))).toBeLessThan(2);
 const detail=page.locator('.report-band').filter({has:page.locator('.band-label').getByText('Details',{exact:false})}).nth(1);
 const height=(await detail.boundingBox())!.height;expect(height).toBeLessThan(70);
 await page.screenshot({path:test.info().outputPath('irs-compact-design.png')});
 await page.getByRole('button',{name:'Preview',exact:true}).click();await expect(page.locator('#pdf-page-1')).toHaveAttribute('data-rendered','true');
 await page.screenshot({path:test.info().outputPath('irs-compact-preview.png')});
});
