import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import path from 'node:path';

const root=path.resolve(__dirname,'../..');
const fixture=JSON.parse(readFileSync(path.join(root,'app/src/data/exampleInvoice.json'),'utf8'));
const records=JSON.parse(readFileSync(path.join(root,'app/src/data/exampleData.json'),'utf8'));
fixture.datasets.forEach((table:any)=>{table.data=records.find((source:any)=>source.id===table.id)?.data ?? [];});
fixture.datasets.find((table:any)=>table.id==='invoiceInfo').data[0].issueDate='2026-10-15';
fixture.dataSource={name:'Test source'};
fixture.relations=[
 {id:'customer',from:{dataset:'invoice',field:'client'},to:{dataset:'addresses',field:'name'},cardinality:'n:1'},
 {id:'date',from:{dataset:'invoice',field:'date'},to:{dataset:'invoiceInfo',field:'issueDate'},cardinality:'n:1'},
];

test('query editor, related columns, filtering and export share model joins',async({page})=>{
 await page.addInitScript(project=>{(window as any).exports=[];(window as any).__TAURI__={core:{invoke:async(command:string,args:any)=>{
  if(command==='open_report')return JSON.stringify(project);
  if(command==='save_csv'){(window as any).exports.push(args);return true;}
  return true;
 }}};},fixture);
 await page.goto('/');await page.waitForFunction(()=>(window as any).reportstudioReady);
 await page.getByRole('button',{name:'Open',exact:true}).click();
 await page.getByRole('button',{name:'Data',exact:true}).click();await page.getByRole('button',{name:'Records',exact:true}).click();
 const grid=page.locator('.records-grid');await expect(grid.locator('tbody tr')).toHaveCount(3);
 await expect(grid.locator('thead')).toContainText('Addresses.name');await expect(grid.locator('thead')).toContainText('Invoice.number');
 await expect(grid.locator('tbody')).toContainText('F-2026-001234');
 await page.getByRole('button',{name:'Edit query',exact:true}).click();const dialog=page.getByRole('dialog');
 const sql=dialog.getByLabel('Generated SQL');await expect(sql).toHaveValue(/INNER JOIN \[Addresses\]/);await expect(sql).toHaveValue(/INNER JOIN \[Invoice\]/);
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByLabel('Search results',{exact:true}).fill('Implementation consulting');
 await expect(grid.locator('tbody tr')).toHaveCount(1);
 await page.getByRole('button',{name:'Export data',exact:true}).click();await page.getByRole('button',{name:'Download JSON',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).exports.length)).toBe(1);
 const exported=await page.evaluate(()=>JSON.parse((window as any).exports[0].text));
 expect(exported).toHaveLength(1);expect(exported[0]['addresses.name']).toBe('Example Customer Inc.');expect(exported[0]['invoiceInfo.number']).toBe('F-2026-001234');
});


test('parent selection follows joins, survives save and controls the records query',async({page})=>{
 await page.addInitScript(project=>{(window as any).saved=[];(window as any).__TAURI__={core:{invoke:async(command:string,args:any)=>{
  if(command==='open_report')return JSON.stringify(project);
  if(command==='save_report'){(window as any).saved.push(args.document);return true;} return true;
 }}};},fixture);
 await page.goto('/');await page.waitForFunction(()=>(window as any).reportstudioReady);
 await page.getByRole('button',{name:'Open',exact:true}).click();
 await page.getByRole('button',{name:'Data',exact:true}).click();
 const parent=page.getByLabel('Parent table',{exact:true});await expect(parent).toHaveValue('');
 await parent.selectOption('addresses');
 await expect(page.locator('.model-card[data-table-id="addresses"]')).toHaveAttribute('data-hierarchy','parent');
 await expect(page.locator('.model-card[data-table-id="invoice"]')).toHaveAttribute('data-hierarchy','child');
 await expect(page.locator('.model-card[data-table-id="invoiceInfo"]')).toHaveAttribute('data-hierarchy','child');
 await page.getByRole('button',{name:'Save',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).saved.length)).toBe(1);
 expect((await page.evaluate(()=>(window as any).saved[0])).dataModel.rootDataset).toBe('addresses');
 await page.locator('.model-card[data-table-id="invoiceInfo"]').click();
 await page.getByRole('button',{name:'Records',exact:true}).click();
 await page.getByRole('button',{name:'Edit query',exact:true}).click();
 await expect(page.getByRole('dialog').getByLabel('Query table',{exact:true})).toHaveValue('addresses');
});
