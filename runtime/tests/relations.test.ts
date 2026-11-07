import test from 'node:test';
import assert from 'node:assert/strict';
import { joinRelatedRows } from '../engine/index.ts';
import type { Dataset, TableRelation } from '../engine/index.ts';
const datasets: Dataset[] = [
 {id:'parents',name:'Customers',schema:{fields:[{name:'id',type:'number'}]},data:[{id:1},{id:2},{id:null}]},
 {id:'children',name:'Orders',schema:{fields:[{name:'parent_id',type:'number'},{name:'item',type:'text'}]},data:[{parent_id:1,item:'A'},{parent_id:1,item:'B'},{parent_id:3,item:'C'},{parent_id:null,item:'D'}]},
];
const relation: TableRelation={id:'r',from:{dataset:'parents',field:'id'},to:{dataset:'children',field:'parent_id'},cardinality:'1:n'};
test('relations perform equality joins with one-to-many matches and preserve originals',()=>{
 const before=structuredClone(datasets); const joined=joinRelatedRows(datasets,'parents',relation);
 assert.equal(joined.rows.length,2); assert.deepEqual(joined.rows.map(r=>r.related.item),['A','B']);
 assert.deepEqual(joined.rows.map(r=>r.index),[0,0]); assert.deepEqual(datasets,before);
});
test('left joins keep unmatched records, nulls do not match and joins work in reverse',()=>{
 const left=joinRelatedRows(datasets,'parents',relation,'left');assert.equal(left.rows.length,4);assert.equal(left.rows.filter(r=>!r.related).length,2);
 const reverse=joinRelatedRows(datasets,'children',relation);assert.equal(reverse.rows.length,2);assert.deepEqual(reverse.rows.map(r=>r.related.id),[1,1]);
 assert.throws(()=>joinRelatedRows(datasets,'unknown',relation),/does not belong/);
});
