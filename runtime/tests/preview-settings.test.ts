import test from 'node:test';
import assert from 'node:assert/strict';
import { createSampleProject } from '../domain/report/sample.ts';
import { previewProject } from '../tabs/preview/previewSettings.ts';
import { templateOnly } from '../data/sources.ts';
import { compileReport, validateProject } from '../engine/index.ts';
const options={values:{},header:true,footer:true};
test('JSON parameters filter preview records without modifying original data',()=>{
 const project=createSampleProject();
 const filtered=previewProject(project,{...options,values:{startDate:'2026-11-01'}});
 assert.equal(filtered.datasets.find(table=>table.id==='invoice')!.data.length,0);
 assert.equal(project.datasets.find(table=>table.id==='invoice')!.data.length,3);
 const text=compileReport(filtered.report,filtered.datasets).pages.flatMap(page=>page.elements).map(element=>element.text).join('|');
 assert.ok(!text.includes("Implementation consulting"));
 assert.ok(text.includes('$0.00'));
 const all=previewProject(project,options);
 assert.equal(all.datasets.find(table=>table.id==='invoice')!.data.length,3);
});
test('visibility affects the compiled document and parameter definitions survive template save',()=>{
 const project=createSampleProject();
 const hidden=previewProject(project,{...options,header:false,footer:false});
 assert.equal(hidden.report.header,undefined);assert.equal(hidden.report.footer,undefined);
 assert.ok(project.report.header);
 assert.deepEqual(templateOnly(project).parameters,project.parameters);
 const invalid=structuredClone(project);invalid.parameters![0].field='unknown';
 assert.throws(()=>validateProject(invalid),/parameter/);
});
test('dynamic parameter values persist selectively and numeric preview comparisons use numbers',()=>{
 const project=createSampleProject();project.parameters=[{id:'price',label:'Price',dataset:'invoice',field:'unitPrice',type:'number',operator:'gte',value:'1000',saveValue:true},{id:'private',label:'Private client',dataset:'invoice',field:'client',type:'text',operator:'contains',value:'secret',defaultValue:'sensitive',saveValue:false}];
 const saved=templateOnly(project);assert.equal(saved.parameters![0].value,'1000');assert.equal(saved.parameters![1].value,undefined);assert.equal(saved.parameters![1].defaultValue,undefined);assert.equal(saved.parameters![1].saveValue,false);assert.equal(project.parameters[1].value,'secret');
 const numeric=previewProject(project,{...options,values:{private:''}});assert.equal(numeric.datasets.find(table=>table.id==='invoice')!.data.length,2);
 const invalid=structuredClone(project);(invalid.parameters![0] as any).saveValue='yes';assert.throws(()=>validateProject(invalid),/parameter/);
});
