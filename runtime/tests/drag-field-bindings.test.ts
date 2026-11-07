import test from 'node:test';
import assert from 'node:assert/strict';
import { act } from '../core.ts';
import { compileReport } from '../engine/index.ts';
import { createSampleProject } from '../domain/report/sample.ts';
import { createBlankProject } from '../domain/report/blankProject.ts';

test('header fields keep their source while detail fields use the current detail row', async () => {
 let project=createSampleProject();
 let result=await act({action:'add-field',project,band:project.report.header!.id,args:{field:{dataset:'invoiceInfo',kind:'text',text:'[number]'}}});
 project=result.project;const headerId=result.selected[0];
 assert.equal(project.report.header!.elements.find(e=>e.id===headerId)!.text,'[invoiceInfo.number]');
 result=await act({action:'add-field',project,band:project.report.details[0].band.id,args:{field:{dataset:'invoice',kind:'number',text:'[quantity]'}}});
 project=result.project;const detailId=result.selected[0];
 const elements=compileReport(project.report,project.datasets).pages.flatMap(page=>page.elements);
 assert.equal(elements.find(e=>e.id===headerId)!.text,String(project.datasets.find(t=>t.id==='invoiceInfo')!.data[0].number));
 assert.deepEqual(elements.filter(e=>e.id===detailId).map(e=>e.text),project.datasets.find(t=>t.id==='invoice')!.data.map(row=>String(row.quantity)));
});
test('dataset names containing spaces can be used in a header binding', async () => {
 const project=createBlankProject();project.datasets=[{id:'Source With Space',name:'Source',schema:{fields:[{name:'name',type:'text'}]},data:[{name:'Test value'}]}];
 const result=await act({action:'add-field',project,band:project.report.header!.id,args:{field:{dataset:'Source With Space',kind:'text',text:'[name]'}}});
 const rendered=compileReport(result.project.report,result.project.datasets).pages.flatMap(page=>page.elements).find(e=>e.id===result.selected[0]);
 assert.equal(rendered?.text,'Test value');
});
