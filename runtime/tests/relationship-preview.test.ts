import test from 'node:test';
import assert from 'node:assert/strict';
import { relationshipPreview } from '../tabs/data/model/relationshipPreview.ts';
import { createBlankProject } from '../domain/report/blankProject.ts';
import { act } from '../core.ts';
function fixture() {
 const project=createBlankProject();
 project.datasets=[
  {id:'a',name:'A',schema:{fields:[{name:'id',type:'number'}]},data:[{id:1},{id:2},{id:2},{id:null}]},
  {id:'b',name:'B',schema:{fields:[{name:'id',type:'number'},{name:'text',type:'text'}]},data:[{id:2},{id:2},{id:null}]}
 ];
 const relation={id:'new',from:{dataset:'a',field:'id'},to:{dataset:'b',field:'id'},cardinality:'n:n' as const};
 return {project,relation};
}
test('preview counts joined pairs and unmatched sources, excluding nulls',()=>{
 const {project,relation}=fixture();
 assert.deepEqual(relationshipPreview(project,relation),{error:'',matches:4,unmatched:2,cardinality:'n:n'});
});
test('validation rejects duplicates in either direction but permits the edited relation',async()=>{
 const {project,relation}=fixture();project.relations=[{...relation,id:'existing'}];
 assert.equal(relationshipPreview(project,relation).error,'This relationship already exists.');
 assert.equal(relationshipPreview(project,{...relation,from:relation.to,to:relation.from}).error,'This relationship already exists.');
 assert.equal(relationshipPreview(project,{...relation,id:'existing'}).error,'');
 await assert.rejects(()=>act({action:'apply-definition',project,args:{kind:'Relationship',value:relation}}),/already exists/);
});
test('invalid types and same-table endpoints cannot be saved',async()=>{
 const {project,relation}=fixture();
 for(const to of [{dataset:'b',field:'text'},{dataset:'a',field:'id'},{dataset:'b',field:'missing'}]) {
  assert.notEqual(relationshipPreview(project,{...relation,to}).error,'');
  await assert.rejects(()=>act({action:'apply-definition',project,args:{kind:'Relationship',value:{...relation,to}}}));
 }
});
