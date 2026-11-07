import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlankProject } from '../domain/report/blankProject.ts';
import { modelQueryPlan, modelRecords } from '../tabs/data/records/modelQuery.ts';

test('model query follows chained joins, exposes empty schemas and applies filters and sorting', () => {
  const project = createBlankProject();
  const table = (id: string, fields: string[], data: any[]) => ({ id, name: id, schema: { fields: fields.map(name => ({name, type: 'text' as const})) }, data });
  project.datasets = [table('Invoice',['id','title'],[{id:1,title:'A'},{id:2,title:'B'},{id:null,title:'C'}]), table('Details',['invoice','address','value'],[{invoice:1,address:10,value:'z'},{invoice:1,address:11,value:'a'},{invoice:null,address:10,value:'x'}]), table('Addresses',['id','city'],[{id:10,city:'Paris'},{id:11,city:'Madrid'}])];
  project.relations = [{id:'a',from:{dataset:'Invoice',field:'id'},to:{dataset:'Details',field:'invoice'},cardinality:'1:n'}, {id:'b',from:{dataset:'Addresses',field:'id'},to:{dataset:'Details',field:'address'},cardinality:'1:n'}];
  const before = structuredClone(project);
  const plan = modelQueryPlan(project,{table:'Invoice',limit:2});
  assert.match(plan.sql,/INNER JOIN \[Details\]/); assert.match(plan.sql,/INNER JOIN \[Addresses\]/);
  const result = modelRecords(project,{table:'Invoice',sort:{column:'Details.value',direction:'asc'},limit:1});
  assert.equal(result.rows.length,1); assert.equal(result.rows[0]['Addresses.city'],'Madrid');
  assert.deepEqual(modelRecords(project,{table:'Invoice',filters:{'Addresses.city':'Paris'}}).rows.map(row => row['Details.value']),['z']);
  assert.equal(modelRecords(project,{table:'Invoice',groups:[{id:'f',columns:['Addresses.city'],operator:'eq',word:'Paris'}]}).rows.length,1);
  project.datasets[0].data = [];
  assert.equal(modelRecords(project,{table:'Invoice'}).columns.length,7);
  assert.deepEqual(before.datasets[1].data, project.datasets[1].data);
});


test('saved parent is the default root of a model query', () => {
 const project = {datasets:[{id:'a',name:'A',schema:{fields:[]},data:[]},{id:'b',name:'B',schema:{fields:[]},data:[]}],dataModel:{tables:{},rootDataset:'b'}} as any;
 assert.equal(modelQueryPlan(project).tables[0].id,'b');
 assert.equal(modelQueryPlan(project,{table:'a'}).tables[0].id,'a');
});
