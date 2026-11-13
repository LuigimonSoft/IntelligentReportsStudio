import {test, expect} from '@playwright/test';
test('dragged fields appear at the drop point and stay inside the page', async ({page}) => {
 await page.goto('/'); await page.waitForFunction(() => (window as any).reportstudioReady);
 await page.getByRole('button',{name:'New',exact:true}).click();
 await page.evaluate(() => (window as any).reportstudio.setTables([{id:'items',name:'Items',schema:{fields:[{name:'amount',type:'number'},{name:'description',type:'text'}]},data:[{amount:10,description:'A'}]}],'API'));
 const palette=page.locator('.palette'); await palette.getByPlaceholder('Search fields…').fill('amount');
 const source=palette.locator('[data-field-text="[amount]"]'); await expect(source).toBeVisible();
 const detail=page.locator('.report-band').filter({has:page.locator('.band-label').getByText('Details',{exact:false})}).nth(1);
 const box=(await detail.boundingBox())!; const dropY=Math.min(10,box.height/2); const x=box.x+180,y=box.y+dropY;
 await source.dragTo(detail,{targetPosition:{x:180,y:dropY}});
 const element=detail.locator('.report-element').filter({hasText:'[amount]'});await expect(element).toHaveCount(1);
 const position=(await element.boundingBox())!;
 expect(Math.abs(position.x-x)).toBeLessThan(3);expect(Math.abs(position.y-y)).toBeLessThan(3);
 await palette.getByPlaceholder('Search fields…').fill('description');
 const other=palette.locator('[data-field-text="[description]"]');
 const current=(await detail.boundingBox())!;
 await other.dragTo(detail,{targetPosition:{x:current.width-5,y:Math.min(10,current.height/2)}});
 const text=detail.locator('.report-element').filter({hasText:'[description]'});await expect(text).toHaveCount(1);
 // The external CSSOM geometry can be applied after insertion on slower WebViews.
 await expect.poll(async()=>{
   const field=await text.boundingBox(), sheet=await page.locator('.report-paper').boundingBox();
   return field && sheet ? field.x+field.width-(sheet.x+sheet.width) : Infinity;
 }).toBeLessThanOrEqual(1);
 await page.screenshot({path:test.info().outputPath('irs-drag-fixed.png')});
});
