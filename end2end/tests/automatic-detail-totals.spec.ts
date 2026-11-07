import {test,expect} from '@playwright/test';
test('adding a numeric field to detail creates and renders totals once',async({page})=>{
 await page.goto('/'); await page.waitForFunction(()=>(window as any).reportstudioReady);
 await page.getByRole('button',{name:'New',exact:true}).click();
 await page.evaluate(()=>(window as any).reportstudio.setTables([{id:'items',name:'Items',schema:{fields:[{name:'amount',type:'number'},{name:'description',type:'text'}]},data:[{amount:10,description:'A'},{amount:25,description:'B'}]}],'API'));
 await page.getByRole('button',{name:'Details',exact:true}).first().click();
 const palette=page.locator('.palette');
 await palette.getByPlaceholder('Search fields…').fill('amount');
 const field=palette.locator('[data-field-text="[amount]"]');
 await field.click();
 await expect(page.locator('.sections-bar')).toContainText('Details totals');
 await expect(page.locator('.report-paper')).toContainText('amount: [SUM(amount)]');
 await field.click();
 await expect(page.locator('.report-paper .report-element').filter({hasText:'amount: [SUM(amount)]'})).toHaveCount(1);
});
