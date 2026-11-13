import {test,expect} from '@playwright/test';

test('compact table dialog has SQL engine groups, validation and uninterrupted typing',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>(window as any).reportstudioReady);
 await page.getByRole('button',{name:'Data',exact:true}).click();await page.getByRole('button',{name:'Add table',exact:true}).click();
 const dialog=page.getByRole('dialog');
 const name=dialog.getByRole('textbox',{name:'Table name',exact:true});
 await expect(name).toHaveValue('');await expect(dialog.getByRole('textbox',{name:'Table ID',exact:true})).toHaveCount(0);
 await expect(dialog.locator('.advanced-definition')).toBeHidden();
 const save=dialog.getByRole('button',{name:'Add table',exact:true});await expect(save).toBeDisabled();
 await expect(dialog.getByLabel('Column 1 type',{exact:true})).toHaveValue('INT');
 await expect(dialog.getByRole('button',{name:'Remove column',exact:true})).toBeDisabled();
 await name.pressSequentially('Inventory');await expect(name).toHaveValue('Inventory');
 await dialog.getByRole('button',{name:'Add column',exact:true}).click();
 const second=dialog.getByLabel('Column 2 name',{exact:true});await second.pressSequentially('description');await expect(second).toHaveValue('description');await expect(second).toBeFocused();
 await dialog.getByLabel('Database engine',{exact:true}).selectOption('postgresql');
 await expect(dialog.getByRole('option',{name:'JSONB',exact:true})).toHaveCount(2);
 await expect(dialog.locator('optgroup[label="Numeric"]')).toHaveCount(2);
 await dialog.getByLabel('Database engine',{exact:true}).selectOption('mysql');
 await dialog.getByLabel('Column 2 type',{exact:true}).selectOption('ENUM');
 await dialog.getByLabel('Column 2 type arguments',{exact:true}).fill("'red','blue'");
 await second.fill('id');await expect(dialog.getByRole('alert')).toContainText('Use unique column names');await expect(save).toBeDisabled();
 await second.fill('description');
 await dialog.getByLabel('Column 2 type arguments',{exact:true}).fill('1;2');await expect(dialog.getByRole('alert')).toHaveText('Invalid SQL type arguments.');
 await dialog.getByLabel('Column 2 type arguments',{exact:true}).fill("'red','blue'");await expect(save).toBeEnabled();
 await page.screenshot({path:test.info().outputPath('reportstudio-table-parity-'+test.info().project.name+'.png')});
 await save.click();await expect(dialog).toHaveCount(0);
 await expect(page.locator('.model-card').filter({hasText:'Inventory'})).toContainText('ENUM');
});

test('native table edit keeps data and supports column renames',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>(window as any).reportstudioReady);
 await page.evaluate(()=>{(window as any).__TAURI_INTERNALS__={invoke:async(_:string,args:any)=>{(window as any).context=args.context;return null;}};});
 await page.getByRole('button',{name:'Add formula',exact:true}).click();await expect.poll(()=>page.evaluate(()=>!!(window as any).context)).toBe(true);
 const context=await page.evaluate(()=>(window as any).context);
 const value={id:'editable',name:'Editable',schema:{fields:[{name:'id',type:'number',sqlType:{dialect:'mssql',name:'INT'}}]},data:[{id:7}]};context.project.datasets.push(value);
 await page.addInitScript(({context,value})=>{(window as any).calls=[];(window as any).__TAURI_INTERNALS__={invoke:async(command:string,args:any)=>{(window as any).calls.push({command,args});return command==='editor_context'?{...context,kind:new URLSearchParams(location.search).has('add')?'Add table':'Data table',value:new URLSearchParams(location.search).has('add')?{id:'',name:'',schema:{fields:[{name:'id',type:'number',sqlType:{dialect:'mssql',name:'INT'}}]},data:[]}:value}:null;}};},{context,value});
 await page.goto('/index.html?editor=1&add=1');await page.setViewportSize({width:620,height:490});
 const initial=page.getByRole('dialog');
 await expect(initial.getByRole('heading',{name:'Add table',exact:true})).toBeVisible();
 await expect(initial.getByRole('button',{name:'Add table',exact:true})).toBeDisabled();
 await expect(initial.getByLabel('Column 1 type',{exact:true})).toHaveValue('INT');
 await expect(initial.locator('.model-help').last()).toBeInViewport({ratio:1});
 await page.screenshot({path:test.info().outputPath('reportstudio-add-table-native-'+test.info().project.name+'.png')});
 await page.goto('/index.html?editor=1');
 const dialog=page.getByRole('dialog');await expect(dialog.getByRole('heading',{name:'Edit table',exact:true})).toBeVisible();
 await dialog.getByRole('textbox',{name:'Table name',exact:true}).fill('Renamed');
 await dialog.getByLabel('Column 1 name',{exact:true}).fill('identifier');
 await dialog.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).calls.some((c:any)=>c.command==='finish_editor'))).toBe(true);
 const draft=await page.evaluate(()=>(window as any).calls.find((c:any)=>c.command==='finish_editor').args.result);
 expect(draft.id).toBe('editable');expect(draft.data).toEqual([{id:7}]);expect(draft.schema.fields[0].name).toBe('identifier');
});

test('drag handles reorder table columns and keyboard moves keep focus',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>(window as any).reportstudioReady);
 await page.getByRole('button',{name:'Data',exact:true}).click();
 await page.getByRole('button',{name:'Edit table',exact:true}).click();
 const dialog=page.getByRole('dialog');const rows=dialog.locator('.new-table-field');
 const names=async()=>rows.locator('input:first-of-type').evaluateAll(nodes=>nodes.map(node=>(node as HTMLInputElement).value));
 const before=await names();expect(before.length).toBeGreaterThanOrEqual(3);
 const source=rows.nth(0).locator('.column-drag-handle');
 await source.dragTo(rows.nth(2));
 await expect.poll(names).toEqual([before[1],before[2],before[0],...before.slice(3)]);
 const moved=dialog.getByRole('button',{name:`Move column ${before[0]}`,exact:true});
 await moved.focus();await moved.press('ArrowUp');
 await expect.poll(names).toEqual([before[1],before[0],before[2],...before.slice(3)]);
 await expect(dialog.getByRole('button',{name:`Move column ${before[0]}`,exact:true})).toBeFocused();
 await dialog.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(dialog).toHaveCount(0);
 await page.getByRole('button',{name:'Records',exact:true}).click();
 await expect.poll(async()=> (await page.locator('.records-grid thead th button').allTextContents()).filter(name=>name.startsWith('Details.')).map(name=>name.slice('Details.'.length))).toEqual([before[1],before[0],before[2],...before.slice(3)]);
 await expect(page.locator('.records-grid tbody tr')).not.toHaveCount(0);
});

test('cancelling a column reorder leaves the table unchanged',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>(window as any).reportstudioReady);
 await page.getByRole('button',{name:'Data',exact:true}).click();await page.getByRole('button',{name:'Edit table',exact:true}).click();
 const dialog=page.getByRole('dialog');const rows=dialog.locator('.new-table-field');
 const names=async()=>rows.locator('input:first-of-type').evaluateAll(nodes=>nodes.map(node=>(node as HTMLInputElement).value));
 const before=await names();await rows.nth(0).locator('.column-drag-handle').dragTo(rows.nth(1));
 await expect.poll(names).toEqual([before[1],before[0],...before.slice(2)]);
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Edit table',exact:true}).click();
 await expect.poll(names).toEqual(before);
});

test('standalone native editor returns reordered field identities',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>(window as any).reportstudioReady);
 await page.evaluate(()=>{(window as any).__TAURI_INTERNALS__={invoke:async(_:string,args:any)=>{(window as any).context=args.context;return null;}};});
 await page.getByRole('button',{name:'Add formula',exact:true}).click();await expect.poll(()=>page.evaluate(()=>!!(window as any).context)).toBe(true);
 const context=await page.evaluate(()=>(window as any).context);
 const value={id:'editable',name:'Editable',schema:{fields:[
  {name:'id',type:'number',sqlType:{dialect:'mssql',name:'INT'}},
  {name:'customer',type:'text',sqlType:{dialect:'mssql',name:'VARCHAR',arguments:'100'}},
  {name:'amount',type:'number',sqlType:{dialect:'mssql',name:'DECIMAL',arguments:'10,2'}}
 ]},data:[{id:7,customer:'Ana',amount:25}]};context.project.datasets.push(value);
 await page.addInitScript(({context,value})=>{(window as any).calls=[];(window as any).__TAURI_INTERNALS__={invoke:async(command:string,args:any)=>{(window as any).calls.push({command,args});return command==='editor_context'?{...context,kind:'Data table',value}:null;}};},{context,value});
 await page.goto('/index.html?editor=1');const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 await dialog.getByRole('button',{name:'Move column amount',exact:true}).dragTo(dialog.locator('.new-table-field').first());
 await expect(dialog.getByLabel('Column 1 name',{exact:true})).toHaveValue('amount');
 await expect(dialog.getByLabel('Column 1 type',{exact:true})).toHaveValue('DECIMAL');
 await expect(dialog.getByLabel('Column 1 type arguments',{exact:true})).toHaveValue('10,2');
 await dialog.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).calls.some((call:any)=>call.command==='finish_editor'))).toBe(true);
 const valueOut=await page.evaluate(()=>(window as any).calls.find((call:any)=>call.command==='finish_editor').args.result);
 expect(valueOut.schema.fields.map((field:any)=>[field.name,field._sourceName])).toEqual([['amount','amount'],['id','id'],['customer','customer']]);
 expect(valueOut.data).toEqual([{id:7,customer:'Ana',amount:25}]);
});

test('mouse drag moves the entire row while held and reorders before release',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>(window as any).reportstudioReady);
 await page.getByRole('button',{name:'Data',exact:true}).click();await page.getByRole('button',{name:'Edit table',exact:true}).click();
 const dialog=page.getByRole('dialog');const rows=dialog.locator('.new-table-field');
 const names=async()=>rows.locator('input:first-of-type').evaluateAll(nodes=>nodes.map(node=>(node as HTMLInputElement).value));
 const before=await names();const handle=rows.first().locator('.column-drag-handle');
 const start=(await handle.boundingBox())!;const dest=(await rows.nth(2).boundingBox())!;
 await page.mouse.move(start.x+start.width/2,start.y+start.height/2);await page.mouse.down();
 await page.mouse.move(start.x+start.width/2,start.y+start.height/2+12,{steps:4});
 const dragging=dialog.locator('.column-dragging');await expect(dragging).toHaveCount(1);
 await expect.poll(()=>dragging.evaluate(el=>getComputedStyle(el).transform)).not.toBe('none');
 await page.mouse.move(dest.x+12,dest.y+dest.height/2,{steps:12});
 await expect.poll(names).toEqual([before[1],before[2],before[0],...before.slice(3)]);
 await expect(dragging.locator('input').first()).toHaveValue(before[0]);
 await dialog.screenshot({path:test.info().outputPath(`reportstudio-column-drag-${test.info().project.name}.png`)});
 await page.mouse.up();await expect(dialog.locator('.column-dragging')).toHaveCount(0);
 await expect.poll(names).toEqual([before[1],before[2],before[0],...before.slice(3)]);
 await dialog.getByRole('button',{name:'Save changes',exact:true}).click();await expect(dialog).toHaveCount(0);
 await page.getByRole('button',{name:'Records',exact:true}).click();
 await expect.poll(async()=> (await page.locator('.records-grid thead th button').allTextContents()).filter(name=>name.startsWith('Details.')).map(name=>name.slice('Details.'.length))).toEqual([before[1],before[2],before[0],...before.slice(3)]);
});
