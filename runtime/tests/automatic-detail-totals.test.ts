import test from 'node:test';
import assert from 'node:assert/strict';
import { act } from '../core.ts';
import { createBlankProject } from '../domain/report/blankProject.ts';
import { compileReport } from '../engine/index.ts';
function fixture() {
 const project=createBlankProject();
 project.datasets=[{id:'items',name:'Items',schema:{fields:[{name:'name',type:'text'},{name:'amount',type:'number'},{name:'qty',type:'number'}]},data:[{name:'A',amount:10,qty:2},{name:'B',amount:25,qty:3}]}];
 project.report.details[0].dataset='items';
 return project;
}
const token=(name:string,kind:string)=>({dataset:'items',kind,text:`[${name}]`,label:name});
const totals=(p:any)=>p.report.details[0].groupFooter.sections?.find((s:any)=>s.name==='Details totals');
test('numeric fields create one visible totals section, render a sum and do not duplicate it', async()=>{
 let p=fixture(); const band=p.report.details[0].band.id;
 p=(await act({action:'add-field',project:p,band,args:{field:token('name','text')}})).project;
 assert.equal(totals(p),undefined);
 p=(await act({action:'add-field',project:p,band,args:{field:token('amount','number')}})).project;
 assert.equal(totals(p).elements[0].text,'amount: [SUM(amount)]');
 assert.ok(compileReport(p.report,p.datasets).pages.flatMap(page=>page.elements).some(e=>e.bandId===totals(p).id && e.text==='amount: 35'));
 p=(await act({action:'add-field',project:p,band,args:{field:token('amount','number')}})).project;
 assert.equal(totals(p).elements.length,1);
 p=(await act({action:'add-field',project:p,band,args:{field:token('qty','number')}})).project;
 assert.equal(totals(p).elements.length,2);
});
test('numeric table fields generate totals and text fields do not',async()=>{
 let p=fixture();let band=p.report.details[0].band.id;
 let r=await act({action:'add-table',project:p,band,args:{}});p=r.project;
 assert.deepEqual(totals(p).elements.map((e:any)=>e.text),['amount: [SUM(amount)]','qty: [SUM(qty)]']);
 const cell=p.report.details[0].band.elements.find(e=>e.type==='text'&&e.cell?.row===1&&e.cell.column===0)!;
 r=await act({action:'table-content',project:p,band,selected:[cell.id],args:{operation:'bind',field:'amount',scope:'column'}});
 assert.equal(totals(r.project).elements.length,2);
});
test('totals never get attached to another source or a locked footer',async()=>{
 let p=fixture();const band=p.report.details[0].band.id;
 p.datasets.push({id:'other',name:'Other',schema:{fields:[{name:'price',type:'number'}]},data:[{price:100}]});
 const wrong=await act({action:'add-field',project:p,band,args:{field:{dataset:'other',kind:'number',text:'[price]'}}});
 assert.equal(totals(wrong.project),undefined);
 p.report.details[0].groupFooter!.readOnly=true;
 await assert.rejects(()=>act({action:'add-field',project:p,band,args:{field:token('amount','number')}}),/read only/);
 assert.equal(p.report.details[0].band.elements.length,0);
});
