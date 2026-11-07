import test from 'node:test';
import assert from 'node:assert/strict';
import {act, templateOnly} from '../core.ts';
import {createBlankProject} from '../domain/report/blankProject.ts';
import {compileReport,makeElement,bandsOf,validateProject} from '../engine/index.ts';
import {sectionHeights} from '../tabs/design/report-area/sectionGeometry.ts';
function fixture(){
 const p=createBlankProject();p.report.details[0].dataset='items';
 p.datasets=[{id:'items',name:'Items',schema:{fields:[{name:'region',type:'text'},{name:'category',type:'text'},{name:'amount',type:'number'}]},data:[{region:'North',category:'B',amount:2},{region:'South',category:'A',amount:4},{region:'North',category:'A',amount:1},{region:'North',category:'A',amount:3}]}];
 p.report.details[0].band.elements.push(makeElement('text',{id:'row',text:'[region] [category] [amount]',width:4,height:.2}));return p;
}
test('multiple groups create editable ordered sections, group values and subtotal scopes',async()=>{
 const p=fixture(),detail=p.report.details[0];
 const result=await act({action:'apply-definition',project:p,args:{kind:'Grouping',value:{detailId:detail.id,legacyField:'',groups:[{field:'region',direction:'asc'},{field:'category',direction:'desc'}]}}});
 const next=result.project, groups=next.report.details[0].groups;assert.equal(groups.length,2);
 groups[1].footer.elements.push(makeElement('text',{id:'sum',text:'[SUM(amount)]',width:2,height:.2}));
 const order=bandsOf(next.report).map(b=>b.id);assert(order.indexOf(groups[0].header.id)<order.indexOf(groups[1].header.id));assert(order.indexOf(groups[1].footer.id)<order.indexOf(groups[0].footer.id));
 const layout=compileReport(next.report,next.datasets,{sectionHeights:Object.fromEntries(sectionHeights(next.report))});
 const elements=layout.pages.flatMap(p=>p.elements);
 assert.deepEqual(elements.filter(e=>e.id==='row').map(e=>e.text),['North B 2','North A 1','North A 3','South A 4']);
 assert.deepEqual(elements.filter(e=>e.id==='sum').map(e=>e.text),['2','4','4']);
 assert.equal(templateOnly(next).report.details[0].groups.length,2);
});
test('group edits preserve existing bands and reject invalid fields',async()=>{
 const p=fixture(),detail=p.report.details[0];let r=await act({action:'apply-definition',project:p,args:{kind:'Grouping',value:{detailId:detail.id,groups:[{field:'region',direction:'asc'}]}}});
 const g=r.project.report.details[0].groups[0];g.header.elements.push(makeElement('text',{text:'custom',height:.2}));
 const changed=await act({action:'apply-definition',project:r.project,args:{kind:'Grouping',value:{detailId:detail.id,groups:[{id:g.id,field:'category',direction:'desc'}]}}});
 assert.equal(changed.project.report.details[0].groups[0].header.id,g.header.id);assert(changed.project.report.details[0].groups[0].header.elements.some(e=>e.text==='custom'));
 await assert.rejects(()=>act({action:'apply-definition',project:r.project,args:{kind:'Grouping',value:{detailId:detail.id,groups:[{field:'region',direction:'asc'},{field:'region',direction:'asc'}]}}}),/different field/);
 assert.throws(()=>validateProject({...p,report:{...p.report,details:[{...detail,groups:[{...g,field:'missing'}]}]}}),/Unknown grouping field/);
});
test('nested group headings repeat on page breaks without losing rows or footer totals',async()=>{
 const p=fixture();p.report.page.height=5;p.report.page.margins={top:.25,bottom:.25,left:.25,right:.25};
 p.datasets[0].data=Array.from({length:70},(_,i)=>({region:i<40?'North':'South',category:i%2?'B':'A',amount:1}));
 const detail=p.report.details[0];
 const result=await act({action:'apply-definition',project:p,args:{kind:'Grouping',value:{detailId:detail.id,groups:[{field:'region',direction:'asc'},{field:'category',direction:'asc'}]}}});
 const groups=result.project.report.details[0].groups;groups[1].footer.elements.push(makeElement('text',{id:'sum',text:'[SUM(amount)]',width:2,height:.2}));
 const layout=compileReport(result.project.report,result.project.datasets,{sectionHeights:Object.fromEntries(sectionHeights(result.project.report))});
 assert(layout.pages.length>2);const all=layout.pages.flatMap(page=>page.elements);
 assert.equal(all.filter(e=>e.id==='row').length,70);assert.deepEqual(all.filter(e=>e.id==='sum').map(e=>Number(e.text)),[20,20,15,15]);
 for(const page of layout.pages){const rows=page.elements.filter(e=>e.id==='row');if(!rows.length)continue;assert(page.elements.some(e=>e.bandId===groups[0].header.id));assert(page.elements.some(e=>e.bandId===groups[1].header.id));}
});
test('renaming or deleting grouped columns keeps group definitions consistent',async()=>{
 const p=fixture(),detail=p.report.details[0];let result=await act({action:'apply-definition',project:p,args:{kind:'Grouping',value:{detailId:detail.id,groups:[{field:'region',direction:'asc'}]}}});
 const table=result.project.datasets[0];const draft=structuredClone(table);
 draft.schema.fields=draft.schema.fields.map((field:any)=>field.name==='region'?{...field,name:'area',_sourceName:'region'}:{...field,_sourceName:field.name});
 result=await act({action:'apply-definition',project:result.project,args:{kind:'Data table',value:draft}});
 assert.equal(result.project.report.details[0].groups[0].field,'area');
 assert.equal(result.project.report.details[0].groups[0].header.elements[0].text,'[area]');
 const invalid=structuredClone(result.project.datasets[0]);invalid.schema.fields=invalid.schema.fields.filter((field:any)=>field.name!=='area');
 await assert.rejects(()=>act({action:'apply-definition',project:result.project,args:{kind:'Data table',value:invalid}}),/Remove grouping/);
});
test('a locked detail cannot have grouping changed',async()=>{
 const p=fixture(),detail=p.report.details[0];detail.band.readOnly=true;
 await assert.rejects(()=>act({action:'apply-definition',project:p,args:{kind:'Grouping',value:{detailId:detail.id,groups:[{field:'region',direction:'asc'}]}}}),/read only/);
 assert.equal(detail.groups,undefined);
});
