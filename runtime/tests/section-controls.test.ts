import test from 'node:test';
import assert from 'node:assert/strict';
import {act} from '../core.ts';
import {createBlankProject} from '../domain/report/blankProject.ts';
import {bandsOf} from '../engine/index.ts';

test('section toolbar adds detail sections and preserves the seven default sections',async()=>{
 const project=createBlankProject();project.datasets=[{id:'items',name:'Items',schema:{fields:[{name:'id',type:'number'}]},data:[]}];
 const added=await act({action:'add-detail-section',project,args:{dataset:'items'}});
 assert.equal(added.project!.report.details.length,2);
 const custom=added.project!.report.details[1].band;
 const removed=await act({action:'remove-section',project:added.project!,band:custom.id});
 assert.equal(removed.project!.report.details.length,1);assert.equal(bandsOf(removed.project!.report).length,7);
 await assert.rejects(()=>act({action:'remove-section',project,band:project.report.header!.id}),/Default sections/);
});
