import {test, expect} from '@playwright/test';

// IPC contract tests complement the real Tauri window checks. A browser never
// pretends to implement native ownership or OS input blocking.
test('desktop opening returns a definition to the unchanged main workspace', async ({page}) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).reportstudioReady);
  await page.evaluate(() => {
    (window as any).editorCalls = [];
    (window as any).__TAURI_INTERNALS__ = {invoke: async (command: string, args: any) => {
      (window as any).editorCalls.push({command, args});
      return {name:'NativeFormula',expression:'42'};
    }};
  });
  await page.getByRole('button',{name:'Add formula',exact:true}).click();
  await expect.poll(() => page.evaluate(() => (window as any).editorCalls.length)).toBe(1);
  const request = await page.evaluate(() => (window as any).editorCalls[0]);
  expect(request.command).toBe('open_editor');
  expect(request.args.context.kind).toBe('Formula');
  expect(request.args.context.project.report).toBeTruthy();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('.palette').getByPlaceholder('Search fields…').fill('NativeFormula');
  await expect(page.locator('.field-name').filter({hasText:'NativeFormula'})).toBeVisible();
});

test('cancelled native editor leaves the main report intact and can reopen', async ({page}) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).reportstudioReady);
  await page.evaluate(() => {
    (window as any).editorCalls = [];
    (window as any).__TAURI_INTERNALS__ = {invoke: async (command:string,args:any) => {
      (window as any).editorCalls.push({command,args}); return null;
    }};
  });
  for (let i=0;i<2;i++) {
    await page.getByRole('button',{name:'Add formula',exact:true}).click();
    await expect.poll(() => page.evaluate(() => (window as any).editorCalls.length)).toBe(i+1);
  }
  const contexts = await page.evaluate(() => (window as any).editorCalls.map((c:any)=>c.args.context.project));
  expect(contexts[0]).toEqual(contexts[1]);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('standalone native formula preserves validation and returns its edited draft', async ({page}) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).reportstudioReady);
  // Capture the regular sample through the same open-editor IPC request.
  await page.evaluate(() => {
    (window as any).__TAURI_INTERNALS__ = {invoke: async (_:string,args:any) => { (window as any).editorContext=args.context; return null; }};
  });
  await page.getByRole('button',{name:'Add formula',exact:true}).click();
  await expect.poll(() => page.evaluate(() => !!(window as any).editorContext)).toBe(true);
  const context = await page.evaluate(() => (window as any).editorContext);
  await page.addInitScript(context => {
    (window as any).editorCalls=[];
    (window as any).__TAURI_INTERNALS__={invoke:async(command:string,args:any)=>{
      (window as any).editorCalls.push({command,args});
      return command==='editor_context' ? context : null;
    }};
  }, context);
  await page.goto('/index.html?editor=1');
  const dialog=page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('.studio-main')).toHaveCount(0);
  const save=dialog.getByRole('button',{name:'Save formula',exact:true});
  await expect(save).toBeDisabled();
  await dialog.getByRole('textbox',{name:'Formula name',exact:true}).fill('ChildFormula');
  await dialog.getByRole('textbox',{name:'Formula expression',exact:true}).fill('6 * 7');
  await expect(dialog.getByLabel('Formula result',{exact:true})).toHaveText('42');
  await save.click();
  await expect.poll(() => page.evaluate(() => (window as any).editorCalls.some((c:any)=>c.command==='finish_editor'))).toBe(true);
  const result=await page.evaluate(() => (window as any).editorCalls.find((c:any)=>c.command==='finish_editor').args.result);
  expect(result).toEqual({name:'ChildFormula',expression:'6 * 7'});
});

test('all editor kinds use the standalone host and cancel without changes', async ({page}) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).reportstudioReady);
  await page.evaluate(() => {
    (window as any).__TAURI_INTERNALS__={invoke:async (_:string,args:any)=>{(window as any).editorContext=args.context;return null;}};
  });
  await page.getByRole('button',{name:'Add formula',exact:true}).click();
  await expect.poll(()=>page.evaluate(() => !!(window as any).editorContext)).toBe(true);
  const context=await page.evaluate(() => (window as any).editorContext);
  const first=context.project.datasets[0];
  const definitions:Record<string,any>={
    Formula:{name:'Example',expression:'42'},
    Chart:{type:'bar',dataset:first.id,category:first.schema.fields[0].name,value:first.schema.fields[1]?.name},
    Relationship:{id:'relation',left:first.id,right:context.project.datasets[1].id,leftKey:first.schema.fields[0].name,rightKey:context.project.datasets[1].schema.fields[0].name,type:'left'},
    Parameter:{id:'parameter',name:'Parameter',type:'text',value:'example'},
    'Add table':{id:'test',name:'Test',schema:{fields:[{name:'id',type:'number'}]},data:[]},
    'Data table':first, Record:first.data[0] || {}, Query:{table:first.id,limit:200},
  };
  await page.addInitScript(({context,definitions}) => {
    const kind=new URLSearchParams(location.search).get('kind') || 'Query';
    (window as any).editorCalls=[];
    (window as any).__TAURI_INTERNALS__={invoke:async(command:string,args:any)=>{
      (window as any).editorCalls.push({command,args});
      return command==='editor_context'?{...context,kind,table:context.project.datasets[0].id,value:definitions[kind]}:null;
    }};
  },{context,definitions});
  for(const kind of Object.keys(definitions)) {
    await page.goto(`/index.html?editor=1&kind=${encodeURIComponent(kind)}`);
    const dialog=page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('.studio-main')).toHaveCount(0);
    for (const height of [440,620,900]) {
      await page.setViewportSize({width:1180,height});
      const body=dialog.locator('.editor-dialog-body');
      await expect(dialog.locator(':scope > footer')).toBeInViewport();
      expect(await dialog.evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(()=>document.documentElement.scrollHeight-innerHeight)).toBeLessThanOrEqual(1);
      await body.evaluate(el=>el.scrollTop=el.scrollHeight);
      // Any scroll range must end at actual content, never an empty fixed-height spacer.
      const blank=await body.evaluate(el=>{
        const visible=[...el.children].filter(c=>c.getBoundingClientRect().height>0);
        const bottom=Math.max(...visible.map(c=>c.getBoundingClientRect().bottom));
        return el.getBoundingClientRect().bottom-bottom;
      });
      if(await body.evaluate(el=>el.scrollHeight>el.clientHeight+1)) expect(blank).toBeLessThanOrEqual(32);
      for(const panel of await dialog.locator('.chart-editor-settings,.chart-data-sidebar,.chart-editor-preview').all()) {
        if(await panel.evaluate(el=>el.scrollHeight<=el.clientHeight+1)) continue;
        await panel.evaluate(el=>el.scrollTop=el.scrollHeight);
        expect(await panel.evaluate(el=>{
          const last=el.lastElementChild!;
          return el.getBoundingClientRect().bottom-last.getBoundingClientRect().bottom;
        })).toBeLessThanOrEqual(20);
      }
    }
    await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
    await expect.poll(()=>page.evaluate(() => (window as any).editorCalls.some((c:any)=>c.command==='finish_editor' && c.args.result===null))).toBe(true);
  }
});
