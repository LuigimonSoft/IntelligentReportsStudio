import test from 'node:test';
import assert from 'node:assert/strict';
import { createSampleProject } from '../domain/report/sample.ts';
import { editTableStructure, setTableHeaders, clearTableContents } from '../tabs/design/report-area/table/tableEditing.ts';
import { createTable } from '../domain/report/tableElements.ts';
import { compileReport } from '../engine/index.ts';
test('inserting/deleting preserves cell contents, field bindings and scoped formatting',()=>{
 const project=createSampleProject(),detail=project.report.details.at(-1)!,elements=detail.band.elements;
 const settings=structuredClone(elements[0].table!);settings.contents['0:1']='CUSTOM';settings.styles['cell:0:1']={background:'#ffcc00'};
 const inserted=editTableStructure(settings,elements,'column',0,'insert');
 assert.equal(inserted.columns,5);assert.equal(inserted.contents['0:2'],'CUSTOM');assert.equal(inserted.contents['0:1'],'[description]');assert.equal(inserted.contents['0:0'],'');assert.equal(inserted.styles['cell:0:2'].background,'#ffcc00');
 const removed=editTableStructure(inserted,createTable(project.datasets[1],inserted.width,inserted),'column',0,'delete');
 assert.equal(removed.contents['0:1'],'CUSTOM');assert.equal(removed.columns,4);
});
test('individual row heights survive layout and row insertion/deletion',()=>{
 const project=createSampleProject(),detail=project.report.details.at(-1)!,dataset=project.datasets.find(table=>table.id===detail.dataset)!;
 const settings={...detail.band.elements[0].table!,rows:2,rowHeights:[0.7,0.3]};
 const elements=createTable(dataset,settings.width,settings,'table-test');assert.equal(elements[0].height,0.7);assert.equal(elements.find(element=>element.cell?.row===1)!.y,0.7);
 const next=editTableStructure(settings,elements,'row',1,'insert');assert.deepEqual(next.rowHeights,[0.7,settings.rowHeight,0.3]);
 detail.band.elements=elements;const result=compileReport(project.report,project.datasets);assert.ok(result.pages.flatMap(page=>page.elements).some(element=>element.type==='box'&&element.groupId==='table-test'&&element.cell?.row===0&&element.height>=0.7));
});

test('header toggle preserves editable body contents and bindings',()=>{
 const project=createSampleProject(),elements=project.report.details.at(-1)!.band.elements,table=elements[0].table!,dataset=project.datasets.find(dataset=>dataset.id===table.dataset)!;
 const fields=dataset.schema.fields.map(field=>field.name);
 const header=setTableHeaders(table,elements,fields,true);assert.equal(header.rows,2);assert.equal(header.contents['0:0'],'description');assert.equal(header.contents['1:0'],'[description]');
 const body=setTableHeaders(header,createTable(dataset,header.width,header),fields,false);assert.equal(body.rows,1);assert.equal(body.contents['0:0'],'[description]');
});

test('clearing a selected column preserves other cell contents and table structure',()=>{
 const project=createSampleProject(),table=project.report.details.at(-1)!.band.elements[0].table!;
 const settings={...table,rows:2,contents:{'0:0':'Keep','1:0':'Keep too','0:1':'Delete'}};
 const cleared=clearTableContents(settings,'column',0,1);assert.equal(cleared.contents['0:0'],'Keep');assert.equal(cleared.contents['1:0'],'Keep too');assert.equal(cleared.contents['0:1'],'');assert.equal(cleared.contents['1:1'],'');assert.equal(cleared.rows,2);
});
