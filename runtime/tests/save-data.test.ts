import test from 'node:test';
import assert from 'node:assert/strict';
import { act, templateOnly } from '../core.ts';
import { validateProject } from '../engine/validation.ts';
import { createBlankProject } from '../domain/report/blankProject.ts';

function fixture() {
  const project = createBlankProject();
  project.datasets = [{ id:'items', name:'Items', schema:{fields:[{name:'name',type:'text'}]}, data:[{name:'Private row'}] }];
  project.dataSource = {name:'InvoiceDB'};
  return project;
}
test('dataset rows are excluded by default and preserved only when opted in', () => {
  const project = fixture();
  const hidden = templateOnly(project);
  assert.deepEqual(hidden.datasets[0].data, []);
  assert.deepEqual(hidden.datasets[0].schema, project.datasets[0].schema);
  assert.deepEqual(project.datasets[0].data, [{name:'Private row'}]);
  project.parameters = [{id:'filter',label:'Filter',type:'text',dataset:'items',field:'name',operator:'contains',saveValue:false,value:'sensitive',defaultValue:'sensitive'}];
  project.saveData = true;
  const saved = templateOnly(project);
  assert.equal(saved.parameters?.[0].value, undefined);
  assert.equal(saved.parameters?.[0].defaultValue, undefined);
  assert.equal(saved.saveData, true);
  assert.deepEqual(saved.datasets[0].data, [{name:'Private row'}]);
  saved.datasets[0].data[0].name = 'Changed';
  assert.equal(project.datasets[0].data[0].name, 'Private row');
  project.saveData = false;
  const cleared = templateOnly(project);
  assert.equal(cleared.saveData, false);
  assert.deepEqual(cleared.datasets[0].data, []);
  assert.throws(() => validateProject({...project, saveData:'true'}), /save data/i);
});
test('saving and reopening retains only explicitly included rows', async () => {
  const project=fixture(); let saved:any;
  (globalThis as any).__TAURI__ = {core:{invoke:async (command:string,args:any)=>{
    if(command==='save_report'){ saved=args.document; return true; }
    if(command==='open_document'||command==='open_report') return JSON.stringify(saved);
    if(command==='accept_document_path') return true;
    throw new Error(`Unexpected command ${command}`);
  }}};
  try {
    project.saveData=true;
    await act({action:'save',project});
    assert.equal(saved.saveData,true);
    const reopened=await act({action:'open',project});
    assert.deepEqual(reopened.project.datasets[0].data,[{name:'Private row'}]);
    reopened.project.saveData=false;
    await act({action:'save',project:reopened.project});
    const empty=await act({action:'open',project:reopened.project});
    assert.deepEqual(empty.project.datasets[0].data,[]);
    assert.equal(empty.project.saveData,false);
  } finally { delete (globalThis as any).__TAURI__; }
});
test('save as and recent document opening retain the selected data policy', async () => {
  const project=fixture(); project.saveData=true; let saved:any; let saveAs=false;
  (globalThis as any).__TAURI__={core:{invoke:async(command:string,args:any)=>{
    if(command==='save_report'){saved=args.document; saveAs=args.saveAs; return true;}
    if(command==='open_recent_document') return JSON.stringify(saved);
    if(command==='accept_document_path') return true;
    throw new Error(`Unexpected command ${command}`);
  }}};
  try {
    await act({action:'save-as',project});
    assert.equal(saveAs,true);
    assert.equal(saved.saveData,true);
    const opened=await act({action:'open-recent',project,args:{path:'/saved.json'}});
    assert.deepEqual(opened.project.datasets[0].data,[{name:'Private row'}]);
  } finally { delete (globalThis as any).__TAURI__; }
});
