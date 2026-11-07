import test from 'node:test';
import assert from 'node:assert/strict';
import { tableDefinition } from '../tabs/data/model/tableDefinition.ts';
import { createBlankProject } from '../domain/report/blankProject.ts';
import { act } from '../core.ts';
const field=(name='id')=>({name,type:'number' as const,sqlType:{dialect:'mssql' as const,name:'INT'}});
const table=()=>({id:'',name:'New table',schema:{fields:[field()]},data:[]});
test('new table uses trimmed name as identifier and starts empty',async()=>{
 const project=createBlankProject();const draft={...table(),name:'  Orders  ',data:[{id:99}]};
 const result=await act({action:'apply-definition',project,args:{kind:'Add table',value:draft}});
 assert.equal(result.project.datasets[0].id,'Orders');assert.deepEqual(result.project.datasets[0].data,[]);
});
test('table validation rejects duplicate names, invalid columns and SQL arguments',()=>{
 const project=createBlankProject();project.datasets=[{...table(),id:'existing'}];
 assert.match(tableDefinition(project,table(),false).error,/already exists/);
 for(const names of [['id','id'],['__proto__'],['bad name']]) {
  assert.match(tableDefinition(createBlankProject(),{...table(),schema:{fields:names.map(field)}},false).error,/unique column/);
 }
 const invalid=table();invalid.schema.fields[0].sqlType={...invalid.schema.fields[0].sqlType,arguments:'1; DROP TABLE x'} as any;
 assert.equal(tableDefinition(createBlankProject(),invalid,false).error,'Invalid SQL type arguments.');
});
test('editing preserves identifiers, rows and renamed relationship endpoints',async()=>{
 const project=createBlankProject();project.datasets=[{...table(),id:'orders',data:[{id:7}]},{...table(),id:'customers',name:'Customers',data:[{id:7}]}];
 project.relations=[{id:'relation',from:{dataset:'orders',field:'id'},to:{dataset:'customers',field:'id'},cardinality:'1:1'}];
 const draft={...project.datasets[0],name:'Renamed',schema:{fields:[{...field('order_id'),_sourceName:'id'}]}};
 const result=await act({action:'apply-definition',project,args:{kind:'Data table',value:draft}});
 assert.equal(result.project.datasets[0].id,'orders');assert.deepEqual(result.project.datasets[0].data,[{order_id:7}]);
 assert.equal(result.project.relations[0].from.field,'order_id');assert.equal('_sourceName' in result.project.datasets[0].schema.fields[0],false);
 const removed={...draft,schema:{fields:[field('other')]}};
 assert.match(tableDefinition(project,removed,true).error,/relationships/);
});
test('reordered and renamed columns retain their values and relationship identities',async()=>{
 const project=createBlankProject();
 project.datasets=[{id:'orders',name:'Orders',schema:{fields:[field('id'),field('customer'),field('amount')]},data:[{id:7,customer:11,amount:50}]},{id:'customers',name:'Customers',schema:{fields:[field('id')]},data:[{id:11}]}];
 project.relations=[{id:'relation',from:{dataset:'orders',field:'customer'},to:{dataset:'customers',field:'id'},cardinality:'1:1'}];
 const draft=structuredClone(project.datasets[0]);
 draft.schema.fields=[{...field('amount'),_sourceName:'amount'},{...field('customer_ref'),_sourceName:'customer'},{...field('id'),_sourceName:'id'}];
 const result=await act({action:'apply-definition',project,args:{kind:'Data table',value:draft}});
 assert.deepEqual(result.project.datasets[0].schema.fields.map(field=>field.name),['amount','customer_ref','id']);
 assert.deepEqual(result.project.datasets[0].data,[{amount:50,customer_ref:11,id:7}]);
 assert.equal(result.project.relations[0].from.field,'customer_ref');
 assert(result.project.datasets[0].schema.fields.every(field=>!('_sourceName' in field)));
});
