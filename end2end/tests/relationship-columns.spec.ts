import {test,expect} from '@playwright/test';

async function openEditor(page:any,editing=false){
 await page.goto('/');await page.waitForFunction(()=>(window as any).reportstudioReady);
 await page.evaluate(()=>{(window as any).__TAURI_INTERNALS__={invoke:async(_:string,args:any)=>{(window as any).context=args.context;return null;}};});
 await page.getByRole('button',{name:'Add formula',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>!!(window as any).context)).toBe(true);
 const context=await page.evaluate(()=>(window as any).context);
 context.project.datasets.push(
  {id:'source',name:'Source',schema:{fields:[{name:'id',type:'number'},{name:'label',type:'text'}]},data:[{id:1},{id:2},{id:2},{id:null}].map((row,i)=>({...row,label:String(i)}))},
  {id:'target',name:'Target',schema:{fields:[{name:'key',type:'number'},{name:'unique',type:'number'},{name:'label',type:'text'}]},data:[{key:2,unique:1},{key:2,unique:2},{key:3,unique:3},{key:null,unique:4}].map((row,i)=>({...row,label:String(i)}))}
 );
 const value={id:'test-relation',from:{dataset:'source',field:'id'},to:{dataset:'target',field:'key'},cardinality:'1:n'};
 if(editing)context.project.relations=[value];
 await page.addInitScript(({context,value})=>{
  (window as any).calls=[];
  (window as any).__TAURI_INTERNALS__={invoke:async(command:string,args:any)=>{(window as any).calls.push({command,args});return command==='editor_context'?{...context,kind:'Relationship',value}:null;}};
 },{context,value});
 await page.goto('/index.html?editor=1');
 return page.getByRole('dialog');
}
test('Relationship form groups columns, previews joins, suggests cardinality and validates selections',async({page})=>{
 const dialog=await openEditor(page);
 await page.setViewportSize({width:620,height:450});
 await expect(dialog.getByRole('heading',{name:'Add relationship',exact:true})).toBeVisible();
 const source=dialog.getByRole('combobox',{name:'Source column',exact:true}),target=dialog.getByRole('combobox',{name:'Target column',exact:true});
 await expect(source).toHaveValue('["source","id"]');await expect(target).toHaveValue('["target","key"]');
 await expect(source.locator('optgroup[label="Target"] option')).toHaveCount(3);
 await expect(dialog.locator('.relation-preview')).toContainText('4 matches · 2 unmatched source rows');
 await expect(dialog.locator('.relation-preview')).toBeInViewport({ratio:1});
 await expect(dialog.getByRole('combobox',{name:'Cardinality',exact:true})).toHaveValue('n:n');
 await expect(dialog.locator('.advanced-definition')).toBeHidden();
 await target.selectOption('["target","unique"]');
 await expect(dialog.getByRole('combobox',{name:'Cardinality',exact:true})).toHaveValue('n:1');
 await target.selectOption('["target","label"]');
 await expect(dialog.getByRole('alert')).toHaveText('Columns must have the same data type.');
 await expect(dialog.getByRole('button',{name:'Create relationship',exact:true})).toBeDisabled();
 await target.selectOption('["source","id"]');
 await expect(dialog.getByRole('alert')).toHaveText('Select columns from different tables.');
 await target.selectOption('["target","key"]');
 await dialog.getByRole('combobox',{name:'Cardinality',exact:true}).selectOption('1:n');
 await expect(dialog.getByRole('button',{name:'Create relationship',exact:true})).toBeEnabled();
 await page.screenshot({path:test.info().outputPath('reportstudio-relation-parity-'+test.info().project.name+'.png')});
 await dialog.getByRole('button',{name:'Create relationship',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).calls.some((c:any)=>c.command==='finish_editor'))).toBe(true);
 const result=await page.evaluate(()=>(window as any).calls.find((c:any)=>c.command==='finish_editor').args.result);
 expect(result.from).toEqual({dataset:'source',field:'id'});expect(result.to).toEqual({dataset:'target',field:'key'});expect(result.cardinality).toBe('1:n');
});
test('editing retains cardinality and saves the existing relationship',async({page})=>{
 const dialog=await openEditor(page,true);
 await expect(dialog.getByRole('heading',{name:'Edit relationship',exact:true})).toBeVisible();
 await expect(dialog.getByRole('combobox',{name:'Cardinality',exact:true})).toHaveValue('1:n');
 await expect(dialog.getByRole('button',{name:'Save relationship',exact:true})).toBeEnabled();
 // The edited relation itself is exempt from duplicate validation.
 await dialog.getByRole('button',{name:'Save relationship',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).calls.some((c:any)=>c.command==='finish_editor'))).toBe(true);
});
