import test from 'node:test';
import assert from 'node:assert/strict';
import {bandsOf, compileReport, makeElement, validateProject, createReport} from '../engine/index.ts';
import {createBlankProject,startupDocumentMode} from '../domain/report/blankProject.ts';
import {templateOnly} from '../data/sources.ts';
import {createSampleProject} from '../domain/report/sample.ts';

test('new blank documents have seven empty sections and no connected source, data tables or records',()=>{
 const blank=createBlankProject('Blank');
 assert.equal(blank.report.title,'Blank');assert.deepEqual(blank.datasets,[]);assert.equal(blank.dataSource,undefined);
 assert.equal(blank.report.details[0].dataset,'');assert.equal(bandsOf(blank.report).length,7);
 assert(bandsOf(blank.report).every(band=>band.elements.length===0&&band.visible!==false));
 const layout=compileReport(blank.report,blank.datasets);assert.equal(layout.pages.length,1);assert.deepEqual(layout.pages[0].elements,[]);
 assert.deepEqual(validateProject(JSON.parse(JSON.stringify(templateOnly(blank)))),blank);
 assert.notEqual(createBlankProject().report.id,blank.report.id);
});
test('unbound details render static content once without inserting a placeholder dataset',()=>{
 const blank=createBlankProject();blank.report.details[0].band.elements=[makeElement('text',{text:'STATIC REPORT'})];
 const elements=compileReport(blank.report,blank.datasets).pages.flatMap(page=>page.elements);
 assert.equal(elements.filter(element=>element.text==='STATIC REPORT').length,1);assert.deepEqual(blank.datasets,[]);
 const builder=createReport().detail(.4).text('STATIC',0,0,2,.2).done();assert.equal(compileReport(builder,[]).pages.length,1);
 blank.report.details[0].groupBy='category';assert.throws(()=>validateProject(blank),/unbound/);
 blank.report.details[0].groupBy=undefined;blank.report.details[0].dataset='missing';assert.throws(()=>validateProject(blank),/Data source/);
});
test('release defaults to a blank document and development uses the example',()=>{assert.equal(startupDocumentMode(undefined,true),'example');assert.equal(startupDocumentMode(undefined,false),'blank');});

test('development sample starts without grouping', () => {
 const project = createSampleProject();
 for (const detail of project.report.details) {
  assert.ok(!detail.groupBy);
  assert.equal(detail.groups?.length ?? 0, 0);
 }
});
