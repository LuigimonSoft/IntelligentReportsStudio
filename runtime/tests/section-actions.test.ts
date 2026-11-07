import test from 'node:test';
import assert from 'node:assert/strict';
import {act} from '../core.ts';
import {createBlankProject} from '../domain/report/blankProject.ts';
import {bandsOf} from '../engine/index.ts';
test('subsection creation targets the requested parent and returns a visible selection',async()=>{
 const project=createBlankProject();const parent=project.report.pageFooter!;
 const result=await act({action:'add-subsection',project,band:project.report.header!.id,args:{band:parent.id}});
 assert.equal(result.project.report.pageFooter.sections.length,1);
 assert.equal(result.project.report.pageFooter.sections[0].id,result.activeBand);
 assert.equal(result.project.report.header.sections?.length ?? 0,0);
 assert.equal(bandsOf(result.project.report).length,8);
});
test('a blank report can add an unbound detail section and keeps its seven default roles',async()=>{
 const project=createBlankProject();const result=await act({action:'add-detail-section',project,args:{dataset:''}});
 assert.equal(result.project.report.details.length,2);
 assert.equal(bandsOf(result.project.report).length,10);
 assert.equal(result.project.report.details[1].band.id,result.activeBand);
 assert.equal(result.project.report.details[1].dataset,'');
});
test('read-only parents reject subsection creation',async()=>{
 const project=createBlankProject();project.report.header!.readOnly=true;
 await assert.rejects(()=>act({action:'add-subsection',project,args:{band:project.report.header!.id}}),/read.only/i);
});
test('detail sections include their complete role and table name',async()=>{
 const project=createBlankProject();
 project.datasets.push({id:'invoice',name:'Invoice',schema:{fields:[]},data:[]} as any);
 const result=await act({action:'add-detail-section',project,args:{dataset:'invoice'}});
 const detail=result.project.report.details.at(-1);
 assert.equal(detail.band.name,'Details Invoice');
 assert.equal(detail.groupHeader.name,'Details header Invoice');
 assert.equal(detail.groupFooter.name,'Details footer Invoice');
 detail.band.name='Custom detail';
 assert.equal(detail.groupHeader.name,'Details header Invoice');
 assert.equal(detail.groupFooter.name,'Details footer Invoice');
});
test('subsections use their parent name and the next available sibling number',async()=>{
 let project=createBlankProject(); const parent=project.report.header!;parent.name='Custom';
 for(let n=1;n<=3;n++){
  const result=await act({action:'add-subsection',project,args:{band:parent.id}});
  project=result.project;
  assert.equal(project.report.header.sections[n-1].name,`Custom-${n}`);
 }
 const child=project.report.header.sections[0];
 const result=await act({action:'add-subsection',project,args:{band:child.id}});
 assert.equal(result.project.report.header.sections[0].sections[0].name,'Custom-1-1');
});
