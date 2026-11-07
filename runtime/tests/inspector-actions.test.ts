import test from 'node:test';
import assert from 'node:assert/strict';
import {act,bindExample} from '../core.ts';
import {createSampleProject} from '../domain/report/sample.ts';
import {createTable} from '../domain/report/tableElements.ts';
import {bandsOf,validateProject} from '../engine/index.ts';
function fixture(){const project=createSampleProject();const band=project.report.details[0].band;const dataset=project.datasets.find(d=>d.id===project.report.details[0].dataset)!;band.elements=createTable(dataset,6,{...band.elements[0].table!,rows:3,columns:4,headers:true});const first=band.elements.find(e=>e.type==='text'&&e.cell?.row===1&&e.cell?.column===1)!;return {project,band:band.id,selected:[first.id]};}
function cell(project:any,id:string){return bandsOf(project.report).flatMap(b=>b.elements).find(e=>e.id===id)!;}
test('scoped table formatting preserves selection and overrides more-specific cell formatting',async()=>{
 let request=fixture();let result=await act({...request,action:'table-style',args:{scope:'cell',style:{background:'#ff0000'}}});
 const selected=cell(result.project,result.selected[0]);assert.deepEqual(selected.cell,{row:1,column:1});
 result=await act({...request,project:result.project,selected:result.selected,action:'table-style',args:{scope:'table',style:{background:'#00ff00',align:'right'}}});
 assert.deepEqual(cell(result.project,result.selected[0]).cell,{row:1,column:1});
 const background=bandsOf(result.project.report).flatMap(b=>b.elements).find(e=>e.type==='box'&&e.groupId===selected.groupId&&e.cell?.row===1&&e.cell.column===1)!;
 assert.equal(background.style.color,'#00ff00');assert.equal(cell(result.project,result.selected[0]).style.align,'right');
});
test('cell reset, field binding, dimensions and header toggling keep table data functional',async()=>{
 let request=fixture();let result=await act({...request,action:'cell-text',args:{text:'Manual'}});
 result=await act({...request,project:result.project,selected:result.selected,action:'table-content',args:{scope:'cell',operation:'reset'}});
 assert.notEqual(cell(result.project,result.selected[0]).text,'Manual');
 result=await act({...request,project:result.project,selected:result.selected,action:'table-content',args:{scope:'column',operation:'bind',field:'quantity'}});
 assert.equal(cell(result.project,result.selected[0]).text,'[quantity]');
 result=await act({...request,project:result.project,selected:result.selected,action:'table-dimension',args:{axis:'row',index:1,value:0.5}});
 assert.equal(cell(result.project,result.selected[0]).table?.rowHeights?.[1],0.5);
 result=await act({...request,project:result.project,selected:result.selected,action:'table-settings',args:{headers:false}});
 assert.equal(cell(result.project,result.selected[0]).table?.headers,false);validateProject(result.project);
});
test('duplication creates independent elements and all table parts together',async()=>{
 const request=fixture();const before=bandsOf(request.project.report).flatMap(b=>b.elements);const original=cell(request.project,request.selected[0]);const count=before.filter(e=>e.groupId===original.groupId).length;
 const result=await act({...request,action:'duplicate'});const after=bandsOf(result.project.report).flatMap(b=>b.elements);
 assert.equal(after.length,before.length+count);assert.ok(result.selected.every((id:string)=>!before.some(e=>e.id===id)));validateProject(result.project);
});
