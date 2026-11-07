import {test, expect} from '@playwright/test';

test.beforeEach(async ({page}) => {
  await page.addInitScript(() => {
    (window as any).exports = [];
    (window as any).saveResult = true;
    (window as any).__TAURI__ = {core:{invoke:async (command:string,args:any) => {
      if (command === 'save_csv') { (window as any).exports.push(args); return (window as any).saveResult; }
      return true;
    }}};
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).reportstudioReady);
  await page.getByRole('button',{name:'New',exact:true}).click();
  await page.evaluate(() => (window as any).reportstudio.setTables([{id:'items',name:'Items',schema:{fields:[{name:'name',type:'text'},{name:'city',type:'text'},{name:'amount',type:'number'}]},data:[{name:'Paris',city:'Berlin',amount:30},{name:'Other',city:'Paris',amount:10},{name:'None',city:'Berlin',amount:20}]}],'API'));
  await page.getByRole('button',{name:'Data',exact:true}).click();
  await page.getByRole('button',{name:'Records',exact:true}).click();
  await expect(page.locator('.records-grid tbody tr')).toHaveCount(3);
});

test('columns menu opens beside the button and hides and restores columns', async ({page}) => {
  const trigger = page.getByRole('button',{name:'Columns',exact:true});
  await trigger.click();
  const menu = page.locator('.records-menu:not(.records-export-menu) > div');
  await expect(menu).toBeVisible();
  await expect.poll(async () => {const a=(await trigger.boundingBox())!, b=(await menu.boundingBox())!;return Math.abs(b.y-a.y-a.height);}).toBeLessThan(10);
  await expect.poll(() => menu.evaluate(el => {const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.left+20,r.top+20));})).toBe(true);
  await menu.getByRole('checkbox',{name:'city',exact:true}).uncheck();
  await expect(page.locator('.records-grid thead')).not.toContainText('city');
  await menu.getByRole('button',{name:'Show all',exact:true}).click();
  await expect(page.locator('.records-grid thead')).toContainText('city');
  await trigger.press('Escape');
  await expect(menu).toBeHidden();
});

test('CSV and JSON export filtered, sorted rows and visible columns; cancellation is reported', async ({page}) => {
  const columns = page.locator('.records-menu:not(.records-export-menu)');
  await page.getByRole('button',{name:'Columns',exact:true}).click();
  await columns.getByRole('checkbox',{name:'city',exact:true}).uncheck();
  await page.getByRole('button',{name:'Filters',exact:true}).click();
  await page.getByRole('button',{name:'Add filter group',exact:true}).click();
  await page.getByRole('checkbox',{name:'name',exact:true}).check();
  await page.getByRole('checkbox',{name:'city',exact:true}).check();
  await page.getByLabel('Filter value',{exact:true}).fill('Paris');
  await page.getByLabel('Filter value',{exact:true}).press('Tab');
  await expect(page.locator('.records-grid tbody tr')).toHaveCount(2);
  await page.getByRole('button',{name:'amount',exact:true}).click();
  const trigger=page.getByRole('button',{name:'Export data',exact:true});
  await trigger.click();
  const menu=page.locator('.records-export-menu > div');
  await expect.poll(async () => {const a=(await trigger.boundingBox())!, b=(await menu.boundingBox())!;return Math.abs(b.y-a.y-a.height);}).toBeLessThan(10);
  await expect(menu).toContainText('filtered records up to the limit and visible columns');
  await menu.getByRole('button',{name:'Download CSV',exact:true}).click();
  await expect(menu).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>(window as any).exports.length)).toBe(1);
  const csv=await page.evaluate(()=>(window as any).exports[0]);
  expect(csv.format).toBe('csv');
  expect(csv.text).toBe('\ufeffname,amount\r\nOther,10\r\nParis,30');
  await trigger.click();
  await menu.getByRole('button',{name:'Download JSON',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).exports.length)).toBe(2);
  const json=await page.evaluate(()=>(window as any).exports[1]);
  expect(json.format).toBe('json');
  expect(JSON.parse(json.text)).toEqual([{name:'Other',amount:10},{name:'Paris',amount:30}]);
  await page.evaluate(()=>(window as any).saveResult=false);
  await trigger.click();
  await menu.getByRole('button',{name:'Download CSV',exact:true}).click();
  await expect(page.locator('.status-bar')).toContainText('Export cancelled');
});

test('menus remain readable and interactive in dark mode at a narrow viewport', async ({page}) => {
  await page.setViewportSize({width:1000,height:700});
  await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();
  const button=page.getByRole('button',{name:'Export data',exact:true});
  await button.click();
  const menu=page.locator('.records-export-menu > div');
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCSS('background-color','rgb(39, 57, 80)');
  const rect=(await menu.boundingBox())!;
  expect(rect.x).toBeGreaterThanOrEqual(0);expect(rect.x+rect.width).toBeLessThanOrEqual(1000);
  await menu.getByRole('button',{name:'Download JSON',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).exports.length)).toBe(1);
});

test('export requires at least one visible column', async ({page}) => {
  const columns=page.locator('.records-menu:not(.records-export-menu)');
  await page.getByRole('button',{name:'Columns',exact:true}).click();
  for (const checkbox of await columns.getByRole('checkbox').all()) await checkbox.uncheck();
  await expect(page.locator('.records-grid thead th')).toHaveCount(1);
  await page.getByRole('button',{name:'Export data',exact:true}).click();
  await expect(page.getByRole('button',{name:'Download CSV',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Download JSON',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Columns',exact:true}).click();
  await columns.getByRole('button',{name:'Show all',exact:true}).click();
  await page.getByRole('button',{name:'Export data',exact:true}).click();
  await expect(page.getByRole('button',{name:'Download CSV',exact:true})).toBeEnabled();
});
