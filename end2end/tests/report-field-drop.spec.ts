import {test, expect} from '@playwright/test';
test('header fields retain their source and dropping a field in a table updates the cell',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>(window as any).reportstudioReady);
 const palette=page.locator('.palette'), search=palette.getByPlaceholder('Search fields…');
 const header=page.locator('[data-band="example-header"]');
 await search.fill('number');const number=palette.locator('[data-field-text="[number]"]');
 await number.dragTo(header,{targetPosition:{x:250,y:30}});
 await expect(header.locator('.report-element').filter({hasText:'[invoiceInfo.number]'})).toHaveCount(2);
 await search.fill('street1');const address=palette.locator('[data-field-text="[street1]"]');
 await address.dragTo(header,{targetPosition:{x:260,y:60}});
 await expect(header.locator('.report-element').filter({hasText:'[addresses.street1]'})).toHaveCount(1);
 const detail=page.locator('[data-band="example-concepts"]');
 const before=await detail.locator('.report-element').count();
 await search.fill('quantity');const quantity=palette.locator('[data-field-text="[quantity]"]');
 const cell=detail.locator('.report-element').filter({hasText:'[description]'});
 await quantity.dragTo(cell);
 await expect(detail.locator('.report-element')).toHaveCount(before);
 await expect(cell).toHaveCount(0);
 await expect(detail.locator('.report-element').filter({hasText:'[quantity]'})).toHaveCount(2);
 await expect(page.locator('.sections-bar')).toContainText('Details totals');
 await page.getByRole('button',{name:'Preview',exact:true}).click();
 await expect(page.locator('#pdf-page-1')).toBeVisible();
});

test('dropping a field from another source into a cell updates the cell rather than overlaying it',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>(window as any).reportstudioReady);
 const palette=page.locator('.palette'), search=palette.getByPlaceholder('Search fields…');
 const detail=page.locator('[data-band="example-concepts"]');const before=await detail.locator('.report-element').count();
 await search.fill('number');const source=palette.locator('[data-field-text="[number]"]');
 const cell=detail.locator('.report-element').filter({hasText:'[description]'});
 await source.dragTo(cell);
 await expect(detail.locator('.report-element')).toHaveCount(before);
 await expect(detail.locator('.report-element').filter({hasText:'[invoiceInfo.number]'})).toHaveCount(1);
 await expect(page.locator('.inspector').getByLabel('Cell content',{exact:true})).toHaveValue('[invoiceInfo.number]');
 await page.getByRole('button',{name:'Preview',exact:true}).click();await expect(page.locator('#pdf-page-1')).toBeVisible();
});
