import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
  await page.goto('/');await page.waitForFunction(()=>(window as any).reportstudioReady);
  await page.getByRole('button',{name:'Data',exact:true}).click();
});
const fields=(page:any,index:number)=>page.locator('.model-card').nth(index).locator('.model-field');
async function endpoints(page:any){
  const source=fields(page,0).first(),target=fields(page,1).first();
  return {source,target,from:{dataset:await source.getAttribute('data-dataset'),field:await source.getAttribute('data-field')},to:{dataset:await target.getAttribute('data-dataset'),field:await target.getAttribute('data-field')}};
}
async function verifyDialog(page:any,from:any,to:any){
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox',{name:'Source column',exact:true})).toHaveValue(JSON.stringify([from.dataset,from.field]));
  await expect(dialog.getByRole('combobox',{name:'Target column',exact:true})).toHaveValue(JSON.stringify([to.dataset,to.field]));
}
test('dragging a column previews the connection and creates an undoable relationship',async({page})=>{
  const {source,target,from,to}=await endpoints(page);
  const a=(await source.boundingBox())!,b=(await target.boundingBox())!;
  await page.mouse.move(a.x+60,a.y+a.height/2);await page.mouse.down();
  await page.mouse.move(b.x+60,b.y+b.height/2,{steps:10});
  await expect(page.locator('.connection-preview')).toBeVisible();
  await expect(page.locator('.connection-preview path')).toHaveAttribute('d',/^M /);
  await page.screenshot({path:test.info().outputPath('reportstudio-model-connection-'+test.info().project.name+'.png')});
  await page.mouse.up();await verifyDialog(page,from,to);
  await page.getByRole('button',{name:'Create relationship',exact:true}).click();
  await expect(page.locator('.model-relationship')).toHaveCount(1);
  await page.getByRole('button',{name:'Undo',exact:true}).first().click();
  await expect(page.locator('.model-relationship')).toHaveCount(0);
});
test('nodes connect by clicking, cancel with Escape and ignore same-table targets',async({page})=>{
  const {source,target,from,to}=await endpoints(page);
  await source.locator('.column-connection-node').click();
  await expect(page.locator('.model-connection-status')).toBeVisible();
  await fields(page,0).nth(1).locator('.column-connection-node').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Escape');await expect(page.locator('.model-connection-status')).toHaveCount(0);
  await source.locator('.column-connection-node').click();
  await target.locator('.column-connection-node').click();
  await verifyDialog(page,from,to);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.locator('.model-relationship')).toHaveCount(0);
});
test('connection targets remain accurate with model zoom and keyboard nodes',async({page})=>{
  await page.getByRole('combobox',{name:'Model zoom',exact:true}).selectOption('75');
  const {source,target,from,to}=await endpoints(page);
  await source.locator('.column-connection-node').focus();await page.keyboard.press('Enter');
  await target.locator('.column-connection-node').focus();await page.keyboard.press('Enter');
  await verifyDialog(page,from,to);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  const a=(await source.boundingBox())!,b=(await target.boundingBox())!;
  await page.mouse.move(a.x+50,a.y+a.height/2);await page.mouse.down();
  await page.mouse.move(b.x+50,b.y+b.height/2,{steps:8});await page.mouse.up();
  await verifyDialog(page,from,to);
});
