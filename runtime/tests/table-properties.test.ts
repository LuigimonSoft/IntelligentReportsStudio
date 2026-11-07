import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSampleProject } from '../domain/report/sample.ts';
import { createTable } from '../domain/report/tableElements.ts';
import { compileReport, validateProject } from '../engine/index.ts';

test('table settings apply scoped formatting, headers and editable cell content', () => {
 const project=createSampleProject();const detail=project.report.details.find(detail=>detail.dataset==='invoice')!;const dataset=project.datasets.find(dataset=>dataset.id==='invoice')!;
 const settings={...detail.band.elements[0].table!,rows:3,columns:4,headers:false,styles:{'column:1':{background:'#ffcc00',align:'right' as const},'cell:1:1':{borderWidth:0}},contents:{'1:1':'Edited cell'}};
 detail.band.elements=createTable(dataset,7,settings);
 const background=detail.band.elements.find(element=>element.type==='box'&&element.cell?.row===1&&element.cell.column===1)!;
 assert.equal(background.style.color,'#ffcc00');assert.equal(background.borderWidth,0);
 const text=detail.band.elements.find(element=>element.type==='text'&&element.cell?.row===1&&element.cell.column===1)!;
 assert.equal(text.style.align,'right');assert.equal(text.text,'Edited cell');
 assert.equal(detail.band.elements.filter(element=>element.type==='text').length,12);
 assert.equal(compileReport(project.report,project.datasets).pages.flatMap(page=>page.elements).filter(element=>element.text==='Edited cell').length,3);
 validateProject(JSON.parse(JSON.stringify(project)));
 settings.rows=999;assert.throws(()=>validateProject(project));
});
