import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{(window as any).savedReport=null;(window as any).__TAURI__={core:{invoke:async(command:string,args:any)=>{if(command==='save_report'){(window as any).savedReport=args.document;return true;}if(command==='open_document')return JSON.stringify((window as any).savedReport);return true;}}};});
 await page.goto('/');await page.waitForFunction(()=>(window as any).reportstudioReady);await page.getByRole('button',{name:'Data',exact:true}).click();
});
const card=(page:any)=>page.locator('.model-card').first();
async function position(page:any){return card(page).evaluate((element:HTMLElement)=>({x:parseFloat(getComputedStyle(element).left),y:parseFloat(getComputedStyle(element).top)}));}
async function move(page:any,dx:number,dy:number){const header=card(page).locator('h4');const box=await header.boundingBox();await page.mouse.move(box!.x+40,box!.y+12);await page.mouse.down();await page.mouse.move(box!.x+40+dx,box!.y+12+dy,{steps:8});}

test('table follows the pointer live, updates relationships and saves one undoable move',async({page})=>{
 const transfer=await page.evaluateHandle(()=>new DataTransfer());await card(page).locator('.model-field').first().dispatchEvent('dragstart',{dataTransfer:transfer});await page.locator('.model-card').nth(1).locator('.model-field').first().dispatchEvent('drop',{dataTransfer:transfer});await page.getByRole('dialog').getByRole('button',{name:'Create relationship',exact:true}).click();
 const before=await position(page);const line=page.locator('.model-relationship path').first();const pathBefore=await line.getAttribute('d');const id=await card(page).getAttribute('data-table-id');
 await move(page,140,90);await expect.poll(()=>position(page)).toEqual({x:before.x+140,y:before.y+90});await expect(line).not.toHaveAttribute('d',pathBefore!);await page.mouse.up();
 await page.getByRole('button',{name:'Save',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).savedReport?.dataModel?.tables)).not.toBeUndefined();
 expect(await page.evaluate(id=>(window as any).savedReport.dataModel.tables[id!],id)).toMatchObject({x:before.x+140,y:before.y+90});
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(()=>position(page)).toEqual(before);await page.getByRole('button',{name:'Redo',exact:true}).click();await expect.poll(()=>position(page)).toEqual({x:before.x+140,y:before.y+90});
 await page.getByRole('button',{name:'Open',exact:true}).click();await page.getByRole('button',{name:'Data',exact:true}).click();await expect.poll(()=>position(page)).toEqual({x:before.x+140,y:before.y+90});
});
test('drag respects zoom and canvas scrolling and pointer cancellation restores the position',async({page})=>{
 await page.getByLabel('Model zoom',{exact:true}).selectOption('50');const before=await position(page);await move(page,60,45);await page.mouse.up();await expect.poll(()=>position(page)).toEqual({x:before.x+120,y:before.y+90});
 await page.getByLabel('Model zoom',{exact:true}).selectOption('100');const canvas=page.locator('.model-canvas');await canvas.evaluate((element:HTMLElement)=>{element.scrollTop=80;element.scrollLeft=40;});await expect.poll(()=>canvas.evaluate((element:HTMLElement)=>element.scrollTop)).toBe(80);await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));const current=await position(page);const startScroll=await canvas.evaluate((element:HTMLElement)=>element.scrollTop);await move(page,40,35);await canvas.evaluate((element:HTMLElement)=>{element.scrollTop+=25;});const endScroll=await canvas.evaluate((element:HTMLElement)=>element.scrollTop);expect(endScroll).toBeGreaterThanOrEqual(startScroll+25);await page.mouse.up();await expect.poll(()=>position(page)).toEqual({x:current.x+40,y:current.y+35+endScroll-startScroll});
 const committed=await position(page);await move(page,30,20);await card(page).locator('h4').dispatchEvent('pointercancel');await page.mouse.up();await expect.poll(()=>position(page)).toEqual(committed);
});
