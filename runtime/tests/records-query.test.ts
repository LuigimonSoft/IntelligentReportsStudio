import test from 'node:test';import assert from 'node:assert/strict';
import {queryRecords,recordColumns,projectRecordRows,recordsCSV,recordsSQL,formatRecord} from '../tabs/data/records/recordsQuery.ts';
import type {Dataset,TableRelation} from '../engine/index.ts';
const table:Dataset={id:'orders',name:'Orders',schema:{fields:[{name:'id',type:'number'},{name:'city',type:'text'},{name:'total',type:'number'},{name:'date',type:'text'}]},data:[{id:1,city:"Mexico",total:30,date:'2026-10-01'},{id:2,city:'Puebla',total:100,date:'2026-10-04'},{id:3,city:"Mexico",total:20,date:'2026-10-09'},{id:4,city:null,total:null,date:'2026-10-20'}]};
const defaults={datasets:[table],table,joinMode:'inner' as const,parameters:[],values:{},filters:[],combination:'and' as const,search:'',sort:null,limit:1000,locale:'es-MX'};
test('records search, parameters, numeric filters and sorting retain original indices',()=>{
 const query=queryRecords({...defaults,search:'mexico',sort:{column:'total',direction:'asc'}});assert.deepEqual(query.rows.map(r=>r.index),[2,0]);assert.deepEqual(table.data.map(r=>r.id),[1,2,3,4]);
 assert.deepEqual(queryRecords({...defaults,filters:[{id:'f',columns:['total'],word:'25',operator:'gte'}]}).rows.map(r=>r.index),[0,1]);
 const parameter={id:'start',label:'Start',type:'date' as const,dataset:'orders',field:'date',operator:'gte' as const};assert.deepEqual(queryRecords({...defaults,parameters:[parameter],values:{start:'2026-10-08'}}).rows.map(r=>r.index),[2,3]);
 assert.equal(queryRecords({...defaults,parameters:[{...parameter,dataset:'other'}],values:{start:'2099-01-01'}}).total,4);
 assert.equal(queryRecords({...defaults,filters:[{id:'f',columns:['city'],word:'',operator:'empty'}]}).rows[0].index,3);
});
test('columns within a group use OR and groups combine with AND or OR; limit follows sorting',()=>{
 const filters=[{id:'1',columns:['city','date'],word:'mexico',operator:'contains' as const},{id:'2',columns:['total'],word:'25',operator:'gte' as const}];assert.equal(queryRecords({...defaults,filters}).total,1);assert.equal(queryRecords({...defaults,filters,combination:'or'}).total,3);
 const result=queryRecords({...defaults,sort:{column:'total',direction:'desc'},limit:2});assert.equal(result.total,4);assert.deepEqual(result.rows.map(r=>r.index),[1,0]);
});
test('relationship joins affect records and exports without mutating source data',()=>{
 const related:Dataset={id:'clients',name:'Clients',schema:{fields:[{name:'order',type:'number'},{name:'name',type:'text'}]},data:[{order:1,name:'Ada'},{order:1,name:'Sam'}]};const relation:TableRelation={id:'rel',from:{dataset:'orders',field:'id'},to:{dataset:'clients',field:'order'},cardinality:'1:n'};
 const result=queryRecords({...defaults,datasets:[table,related],relation});assert.equal(result.total,2);assert.deepEqual(result.rows.map(r=>r.relatedIndex),[0,1]);assert.equal(queryRecords({...defaults,datasets:[table,related],relation,joinMode:'left'}).total,5);
 assert.equal(queryRecords({...defaults,datasets:[table,related],relation,search:'sam'}).total,1);
 const columns=result.columns.filter(c=>['id','related:name'].includes(c.id));assert.deepEqual(projectRecordRows(result.rows,columns),[{id:1,'clients.name':'Ada'},{id:1,'clients.name':'Sam'}]);assert.match(recordsSQL(table,relation,'left',columns,200),/LEFT JOIN \[clients\]/);
});
test('CSV escapes delimiters, quotes, newlines and spreadsheet formula strings; numbers stay numeric',()=>{
 const csv=recordsCSV([{text:'"quoted",\nline',formula:'=SUM(A1)',number:-15}],['text','formula','number']);assert.match(csv,/""quoted""/);assert.match(csv,/'=SUM/);assert.match(csv,/,-15$/);assert(csv.startsWith('\ufeff'));
 const column=recordColumns(table)[2];assert.equal(formatRecord(1500,column,'en-US',2,true),'1,500.00');assert.equal(formatRecord(null,column,'en-US',2,false),'NULL');
});
