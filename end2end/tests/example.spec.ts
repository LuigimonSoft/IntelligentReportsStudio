import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let clipboard='';
    const requests:any[]=[];
    (window as any).nativeRequests=requests;
    (window as any).__TAURI__={core:{invoke:async(command:string,args:any={})=>{
      requests.push({command,args});
      if(command==='write_clipboard'){clipboard=args.text;return;}
      if(command==='read_clipboard')return clipboard;
      if(command==='open_document'||command==='open_image')return null;
      return true;
    }}};
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).reportstudioReady === true);
  await page.getByLabel('Zoom',{exact:true}).selectOption('1.00');
  await expect(page.getByLabel('Zoom',{exact:true})).toHaveValue('1.00');
});

test('CSR application mounts and zoom changes by five percent',async({page})=>{
  await expect.poll(()=>page.evaluate(()=>(window as any).reportstudioNativeReady)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>(window as any).nativeRequests.some((r:any)=>r.command==='frontend_ready'))).toBe(true);
  await expect(page).toHaveTitle('Report Studio');
  await expect(page.locator('.report-band')).toHaveCount(7);
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();
  await expect(page.getByLabel('Zoom',{exact:true})).toHaveValue('1.05');
  await page.getByRole('button',{name:'Zoom out',exact:true}).click();
  await expect(page.getByLabel('Zoom',{exact:true})).toHaveValue('1.00');
});

test('guides, units, language and theme are interactive',async({page})=>{
  await page.getByLabel('Guides',{exact:true}).selectOption('none');
  await expect(page.locator('.report-paper')).toHaveCSS('background-image','none');
  await page.getByLabel('Units',{exact:true}).selectOption('in');
  await expect(page.locator('.band-label small').first()).toContainText('in');
  await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();
  await expect(page.locator('.reportstudio-app')).toHaveClass(/dark/);
  await page.getByLabel('Language',{exact:true}).selectOption('fr');
  await expect(page.getByRole('button',{name:'Enregistrer',exact:true})).toBeVisible();
});

test('new report is blank and supports text insertion, undo and redo',async({page})=>{
  await page.getByRole('button',{name:'New',exact:true}).click();
  await expect(page.locator('.report-element')).toHaveCount(0);
  await expect(page.locator('.report-band')).toHaveCount(7);
  await page.getByRole('button',{name:'Text',exact:true}).click();
  await expect(page.locator('.report-element')).toHaveCount(1);
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(page.locator('.report-element')).toHaveCount(0);
  await page.getByRole('button',{name:'Redo',exact:true}).click();
  await expect(page.locator('.report-element')).toHaveCount(1);
});

test('clipboard and save are routed through native commands and do not save records',async({page})=>{
  await page.getByRole('button',{name:'New',exact:true}).click();
  await expect(page.locator('.report-element')).toHaveCount(0);
  await page.getByRole('button',{name:'Text',exact:true}).click();
  await expect(page.locator('.report-element')).toHaveCount(1);
  await page.getByRole('button',{name:'Copy',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).nativeRequests.some((r:any)=>r.command==='write_clipboard'))).toBe(true);
  await page.getByRole('button',{name:'Paste',exact:true}).click();
  await expect(page.locator('.report-element')).toHaveCount(2);
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).nativeRequests.some((r:any)=>r.command==='save_report'))).toBe(true);
});

test('data model, records, column filters and parameters use the current sources',async({page})=>{
  await page.getByRole('button',{name:'Data',exact:true}).click();
  await expect(page.locator('.model-card')).toHaveCount(3);
  await page.getByRole('button',{name:'Records',exact:true}).click();
  await expect(page.locator('.records-grid tbody tr')).not.toHaveCount(0);
  await page.getByRole('button',{name:'Add parameter',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('textbox').filter({visible:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
});

test('formula editor includes fields, operators, functions and a result',async({page})=>{
  await page.getByRole('button',{name:'Add formula',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Operators',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Functions',exact:true})).toBeVisible();
  await page.getByRole('textbox',{name:'Formula expression',exact:true}).fill('1 + 1');
  await expect(page.locator('output')).toHaveText('2');
});

test('PDF preview renders the same layout without designer guides',async({page})=>{
  await page.getByRole('button',{name:'Preview',exact:true}).click();
  await expect(page.locator('.preview-page canvas').first()).toBeVisible();
  await expect.poll(()=>page.locator('.preview-page canvas').first().getAttribute('width')).not.toBeNull();
  await expect(page.locator('.report-paper')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Print',exact:true})).toBeVisible();
  await expect(page.locator('.preview-workspace')).toHaveCSS('flex-direction','row');
  await expect(page.locator('.preview-panel-information dd').last()).toHaveText('3');
  await expect(page.locator('.status-bar')).not.toContainText('JsValue');
  await expect.poll(()=>page.locator('.preview-page canvas').first().evaluate((canvas:HTMLCanvasElement)=>{
    const ctx=canvas.getContext('2d')!;return ctx.getImageData(0,0,1,1).data[3];
  })).toBe(255);
});

test('API data updates records while saves retain only schema and source name',async({page})=>{
  await page.getByRole('button',{name:'New',exact:true}).click();
  await expect(page.locator('.report-element')).toHaveCount(0);
  await page.evaluate(()=> (window as any).reportstudio.setTables([
    {id:'api_items',name:'API Items',schema:{fields:[{name:'description',type:'text'},{name:'amount',type:'number'}]},data:[{description:'Live API record',amount:25}]}
  ],'External API'));
  await page.getByRole('button',{name:'Data',exact:true}).click();
  await expect(page.locator('.model-card')).toHaveCount(1);
  await page.getByRole('button',{name:'Records',exact:true}).click();
  await expect(page.locator('.records-grid tbody tr')).toHaveCount(1);
  await expect(page.locator('.records-grid tbody')).toContainText('Live API record');
  await page.getByLabel('Search results',{exact:true}).fill('missing');
  await expect(page.locator('.records-grid tbody tr')).toHaveCount(0);
  await page.getByLabel('Search results',{exact:true}).fill('');
  await expect(page.locator('.records-grid tbody tr')).toHaveCount(1);
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=> (window as any).nativeRequests.filter((r:any)=>r.command==='save_report').length)).toBe(1);
  const project=await page.evaluate(()=>(window as any).nativeRequests.find((r:any)=>r.command==='save_report').args.document);
  expect(project.dataSource).toEqual({name:'External API'});
  expect(project.datasets[0].data).toEqual([]);
});

test('inline table cell editing survives header removal and restoration',async({page})=>{
  await page.locator('.report-element').filter({hasText:'[description]'}).first().dblclick();
  const editor=page.locator('.inline-text-editor');
  await expect(editor).toBeVisible();
  await editor.fill('Edited cell');
  await editor.press('Enter');
  await expect(page.locator('.report-element').filter({hasText:'Edited cell'})).toHaveCount(1);
  await page.getByRole('checkbox',{name:'Show headers',exact:true}).uncheck();
  await expect(page.locator('.report-element').filter({hasText:'Edited cell'})).toHaveCount(1);
  await page.getByRole('checkbox',{name:'Show headers',exact:true}).check();
  await expect(page.locator('.report-element').filter({hasText:'Edited cell'})).toHaveCount(1);
});

test('dragging a selected element across section boundaries transfers it',async({page})=>{
  await page.getByRole('button',{name:'New',exact:true}).click();
  await expect(page.locator('.report-element')).toHaveCount(0);
  await page.getByRole('button',{name:'Text',exact:true}).click();
  await expect(page.locator('.report-element')).toHaveCount(1);
  const element=page.locator('.report-element').first();
  const from=await element.boundingBox();
  const to=await page.locator('.report-band').nth(3).boundingBox();
  await page.mouse.move(from!.x+10,from!.y+10);
  await page.mouse.down();
  await page.mouse.move(to!.x+70,to!.y+30,{steps:12});
  await page.mouse.up();
  await expect(page.locator('.report-band').nth(0).locator('.report-element')).toHaveCount(0);
  await expect(page.locator('.report-band').nth(3).locator('.report-element')).toHaveCount(1);
});

test('data table editor offers native SQL Server, PostgreSQL and MySQL types',async({page})=>{
  await page.getByRole('button',{name:'Data',exact:true}).click();
  await page.getByRole('button',{name:'Add table',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('textbox',{name:'Table name',exact:true}).fill('Custom table');
  await expect(page.getByRole('option',{name:'NVARCHAR',exact:true})).toHaveCount(1);
  await page.getByLabel('Database engine',{exact:true}).selectOption('postgresql');
  await expect(page.getByRole('option',{name:'JSONB',exact:true})).toHaveCount(1);
  await page.getByLabel('Database engine',{exact:true}).selectOption('mysql');
  await expect(page.getByRole('option',{name:'MEDIUMINT',exact:true})).toHaveCount(1);
  await page.getByLabel('Column 1 type',{exact:true}).selectOption('INT');
  await page.getByRole('dialog').getByRole('button',{name:'Add table',exact:true}).click();
  await expect(page.locator('.model-card')).toHaveCount(4);
  await expect(page.locator('.model-card').filter({hasText:'Custom table'})).toContainText('INT');
});

test('record form changes a row in place rather than appending a duplicate',async({page})=>{
  await page.getByRole('button',{name:'Data',exact:true}).click();
  await page.getByRole('button',{name:'Records',exact:true}).click();
  const rows=page.locator('.records-grid tbody tr');
  await expect(rows).not.toHaveCount(0);
  const count=await rows.count();
  await rows.first().dblclick();
  const input=page.getByRole('dialog').getByRole('textbox',{name:'number',exact:true});
  await input.fill('Changed in form');
  await input.press('Tab');
  await page.getByRole('dialog').getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(rows).toHaveCount(count);
  await expect(rows.first()).toContainText('Changed in form');
});

test('chart editor renders a D3 preview and exposes data sources and category colors',async({page})=>{
  await page.getByRole('button',{name:'Chart',exact:true}).click();
  await page.getByRole('button',{name:'Edit chart details',exact:true}).click();
  await expect(page.locator('.chart-editor-preview svg')).toBeVisible();
  await expect(page.locator('.chart-data-sidebar details')).toHaveCount(3);
  await expect(page.getByRole('dialog').getByRole('heading',{name:'Colors by category',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
});

test('exported PDF pixels match the PDF shown in preview',async({page})=>{
  await page.getByRole('button',{name:'Preview',exact:true}).click();
  await expect(page.locator('.preview-page canvas').first()).toHaveAttribute('data-rendered','true');
  await page.getByRole('button',{name:'Export PDF',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).nativeRequests.some((r:any)=>r.command==='save_pdf'))).toBe(true);
  const difference=await page.evaluate(async()=>{
    const manifest=await (await fetch('/vendor/runtime-manifest.json')).json();
    const moduleName=Object.entries(manifest.outputs).find(([,value]:any)=>value.entryPoint?.endsWith('pdfjs-dist/build/pdf.mjs'))![0].split('/').pop();
    const {getDocument,GlobalWorkerOptions}=await import(`/vendor/${moduleName}`);
    GlobalWorkerOptions.workerSrc='/vendor/pdf.worker.min.mjs';
    const bytes=(window as any).nativeRequests.find((r:any)=>r.command==='save_pdf').args.bytes;
    const task=getDocument({data:Uint8Array.from(bytes)});
    try{
      const doc=await task.promise;const pdfPage=await doc.getPage(1);
      const actual=document.querySelector('.preview-page canvas') as HTMLCanvasElement;
      const exported=document.createElement('canvas');exported.width=actual.width;exported.height=actual.height;
      const context=exported.getContext('2d')!;
      await pdfPage.render({canvas:exported,canvasContext:context,viewport:pdfPage.getViewport({scale:Number(actual.dataset.renderScale)})}).promise;
      const expected=actual.getContext('2d')!.getImageData(0,0,actual.width,actual.height).data;
      const firstRender=context.getImageData(0,0,exported.width,exported.height).data;
      // PDF.js may finish the first Linux WebKit render before its fonts settle.
      // Compare a second render of the same exported page pixel for pixel.
      const repeated=document.createElement('canvas'); repeated.width=actual.width; repeated.height=actual.height;
      const repeatedContext=repeated.getContext('2d')!;
      await pdfPage.render({canvas:repeated,canvasContext:repeatedContext,viewport:pdfPage.getViewport({scale:Number(actual.dataset.renderScale)})}).promise;
      const result=repeatedContext.getImageData(0,0,repeated.width,repeated.height).data;
      let differentPixels=0, maxDelta=0, totalDelta=0, repeatDifferences=0;
      let minX=actual.width,minY=actual.height,maxX=-1,maxY=-1;
      for(let i=0;i<result.length;i+=4){
        let changed=false;
        for(let c=0;c<4;c++){
          const delta=Math.abs(result[i+c]-expected[i+c]);
          if(delta){changed=true;totalDelta+=delta;maxDelta=Math.max(maxDelta,delta);}
          if(result[i+c]!==firstRender[i+c]) repeatDifferences++;
        }
        if(changed){const x=(i/4)%actual.width,y=Math.floor(i/4/actual.width);differentPixels++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
      }
      return {differentChannels:result.reduce((count:number,value:number,index:number)=>count+(value!==expected[index]?1:0),0),differentPixels,maxDelta,totalDelta,repeatDifferences,width:actual.width,height:actual.height,bounds:{minX,minY,maxX,maxY},scale:actual.dataset.renderScale};
    }finally{await task.destroy();}
  });
  expect(difference.differentChannels, JSON.stringify(difference)).toBe(0);
});

test('column groups, numeric sorting and CSV export use the same filtered records',async({page})=>{
  await page.getByRole('button',{name:'New',exact:true}).click();
  await expect(page.locator('.report-element')).toHaveCount(0);
  await page.evaluate(()=>(window as any).reportstudio.setTables([{id:'items',name:'Items',schema:{fields:[{name:'name',type:'text'},{name:'city',type:'text'},{name:'amount',type:'number'}]},data:[{name:'Paris',city:'Berlin',amount:30},{name:'Other',city:'Paris',amount:10},{name:'None',city:'Berlin',amount:20}]}],'API'));
  await page.getByRole('button',{name:'Data',exact:true}).click();
  await page.getByRole('button',{name:'Records',exact:true}).click();
  await expect(page.locator('.records-grid tbody tr')).toHaveCount(3);
  await page.getByRole('button',{name:'Filters',exact:true}).click();
  await page.getByRole('button',{name:'Add filter group',exact:true}).click();
  await page.getByRole('checkbox',{name:'name',exact:true}).check();
  await page.getByRole('checkbox',{name:'city',exact:true}).check();
  await page.getByLabel('Filter value',{exact:true}).fill('Paris');
  await page.getByLabel('Filter value',{exact:true}).press('Tab');
  await expect(page.locator('.records-grid tbody tr')).toHaveCount(2);
  await page.getByRole('button',{name:'amount',exact:true}).click();
  await expect(page.locator('.records-grid tbody tr').first()).toContainText('Other');
  await page.getByRole('button',{name:'Export data',exact:true}).click();
  await page.getByRole('button',{name:'Download CSV',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).nativeRequests.some((r:any)=>r.command==='save_csv'))).toBe(true);
  const csv=await page.evaluate(()=>(window as any).nativeRequests.find((r:any)=>r.command==='save_csv').args.text);
  expect(csv).toContain('Other,Paris,10');expect(csv).not.toContain('None');
});
