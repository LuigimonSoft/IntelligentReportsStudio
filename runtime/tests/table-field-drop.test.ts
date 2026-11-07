import test from 'node:test';
import assert from 'node:assert/strict';
import {act} from '../core.ts';
import {createSampleProject} from '../domain/report/sample.ts';
import {compileReport} from '../engine/index.ts';
test('dropping a field replaces only the chosen table cell and renders each row',async()=>{
 const project=createSampleProject(), detail=project.report.details[0], band=detail.band;
 const cell=band.elements.find(e=>e.type==='text' && e.cell?.row===0 && e.cell.column===0)!;
 const count=band.elements.length;
 const result=await act({action:'table-content',project,band:band.id,selected:[cell.id],args:{operation:'drop-field',field:{dataset:'invoice',kind:'number',text:'[quantity]'}}});
 const next=result.project.report.details[0].band;
 assert.equal(next.elements.length,count);
 assert.equal(next.elements.find((e:any)=>e.id===result.selected[0]).text,'[quantity]');
 assert.equal(next.elements.find((e:any)=>e.type==='text' && e.cell?.column===1).text,'[quantity]');
 const rendered=compileReport(result.project.report,result.project.datasets).pages.flatMap(p=>p.elements).filter(e=>e.id===result.selected[0]);
 assert.deepEqual(rendered.map(e=>e.text),result.project.datasets.find((d:any)=>d.id==='invoice').data.map((row:any)=>String(row.quantity)));
 assert.equal(result.project.report.details[0].groupFooter.sections[0].name,'Details totals');
});
test('dropping fields from another source and formulas preserves their expressions',async()=>{
 const project=createSampleProject(), band=project.report.details[0].band;
 const cell=band.elements.find(e=>e.type==='text' && e.cell?.column===0)!;
 let result=await act({action:'table-content',project,band:band.id,selected:[cell.id],args:{operation:'drop-field',field:{dataset:'invoiceInfo',kind:'text',text:'[number]'}}});
 assert.equal(result.project.report.details[0].band.elements.find((e:any)=>e.id===result.selected[0]).text,'[invoiceInfo.number]');
 const rendered=compileReport(result.project.report,result.project.datasets).pages.flatMap(p=>p.elements).find(e=>e.id===result.selected[0]);
 assert.equal(rendered!.text,String(result.project.datasets.find((d:any)=>d.id==='invoiceInfo').data[0].number));
 result=await act({action:'table-content',project:result.project,band:band.id,selected:result.selected,args:{operation:'drop-field',field:{kind:'formula',text:'[=quantity * unitPrice]'}}});
 assert.equal(result.project.report.details[0].band.elements.find((e:any)=>e.id===result.selected[0]).text,'[=quantity * unitPrice]');
});
