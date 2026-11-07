import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlankProject } from '../domain/report/blankProject.ts';
import { importTables } from '../tabs/data/model/importTables.ts';
const table = (name: string) => ({name,schema:{fields:[{name:'id',type:'number'},{name:'name',type:'text'}]},data:[{id:1,name:'Ana'}]});
test('imports one or several tables with data without mutating the existing project', () => {
  const project=createBlankProject();
  const first=importTables(project,JSON.stringify(table('Customers')));
  const second=importTables(first,JSON.stringify({tables:[table('Orders'),{name:'Products',schema:{fields:[{name:'id',type:'number'}]}}]}));
  assert.equal(project.datasets.length,0);
  assert.deepEqual(second.datasets.map(t=>t.id),['Customers','Orders','Products']);
  assert.equal(second.datasets[0].data[0].name,'Ana');
  assert.deepEqual(second.datasets[2].data,[]);
});
test('invalid JSON, duplicates and invalid data are rejected atomically', () => {
  const project=importTables(createBlankProject(),JSON.stringify(table('Customers')));
  const before=structuredClone(project);
  for (const input of ['{', JSON.stringify({tables:[]}), JSON.stringify([table('Orders'),table('Customers')]), JSON.stringify({name:'Invalid',schema:{fields:[{name:'id',type:'number'}]},data:[{id:'wrong'}]})]) {
    assert.throws(()=>importTables(project,input));
    assert.deepEqual(project,before);
  }
});
