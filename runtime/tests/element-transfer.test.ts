import test from 'node:test';
import assert from 'node:assert/strict';
import {makeElement,makeBand,compileReport} from '../engine/index.ts';
import {createSampleProject} from '../domain/report/sample.ts';
import {captureElements,placeElements,parseElementBundle,elementBounds} from '../domain/report/elementTransfer.ts';

test('copy/paste regenerates table and cell IDs, preserves geometry/styles and binds source fields in another section',()=>{
 const p=createSampleProject(),source=p.report.details[0].band;
 const selected=source.elements.find(element=>element.type==='text'&&element.table)!;
 const bundle=captureElements(p.report,p.datasets,source.id,selected.id)!;
 const before=structuredClone(p.report);
 const pasted=placeElements(p.report,parseElementBundle(JSON.stringify(bundle)),p.report.header!.id,{x:0,y:1.5});
 assert.deepEqual(p.report,before);
 const copies=pasted.report.header!.elements.filter(element=>element.groupId&&element.groupId!==selected.groupId);
 assert.equal(copies.length,bundle.elements.length);
 assert.notEqual(copies[0].groupId,selected.groupId);
 const originalIDs=new Set(bundle.elements.map(element=>element.id));assert(copies.every(element=>!originalIDs.has(element.id)));
 assert.equal(elementBounds(copies).width,elementBounds(bundle.elements).width);
 copies.forEach((element,index)=>assert.deepEqual(element.style,bundle.elements[index].style));
 assert(copies.some(element=>element.text==='[invoice.description]'));
 for(const element of copies)assert.deepEqual(element.table!.contents,copies[0].table!.contents);
 assert.equal(copies[0].table!.contents['0:0'],'[invoice.description]');
 const rendered=compileReport(pasted.report,p.datasets).pages.flatMap(page=>page.elements);
 assert(rendered.some(element=>element.id===pasted.selection.elementId&&element.text===p.datasets.find(table=>table.id==='invoice')!.data[0].description));
});

test('moving a table transfers its entire group with stable IDs and fits the target without changing the original report',()=>{
 const p=createSampleProject(),source=p.report.details[0].band,selected=source.elements.find(element=>element.type==='text'&&element.table)!;
 const bundle=captureElements(p.report,p.datasets,source.id,selected.id)!;
 const moved=placeElements(p.report,bundle,p.report.pageHeader!.id,{x:999,y:1.6},false,source.id);
 assert(moved.report.details[0].band.elements.every(element=>element.groupId!==selected.groupId));
 assert.equal(p.report.details[0].band.elements.filter(element=>element.groupId===selected.groupId).length,bundle.elements.length);
 const copies=moved.report.pageHeader!.elements.filter(element=>element.groupId===selected.groupId);
 assert.deepEqual(copies.map(element=>element.id),bundle.elements.map(element=>element.id));
 assert.equal(moved.selection.elementId,selected.id);
 assert(Math.abs(elementBounds(copies).x+elementBounds(copies).width-(p.report.page.width-p.report.page.margins.left-p.report.page.margins.right))<.001);
});

test('formula qualification respects string literals and same-dataset/nested-section context',()=>{
 const p=createSampleProject(),source=p.report.details[0].band;
 const element=makeElement('text',{text:"[IF(description = 'quantity', quantity, 0)]"});source.elements.push(element);
 const bundle=captureElements(p.report,p.datasets,source.id,element.id)!;
 const header=placeElements(p.report,bundle,p.report.header!.id,{x:0,y:2});
 assert.equal(header.report.header!.elements.find(e=>e.id===header.selection.elementId)!.text,"[IF(invoice.description = 'quantity', invoice.quantity, 0)]");
 const child=makeBand('Child',.5);source.sections=[child];
 const same=placeElements(p.report,bundle,child.id,{x:0,y:0},false,source.id);
 assert.equal(same.report.details[0].band.sections![0].elements[0].text,element.text);
 assert.equal(captureElements(same.report,p.datasets,child.id,element.id)!.sourceDataset,'invoice');
});

test('invalid or oversized clipboard content fails atomically and snapshots remain independent',()=>{
 const p=createSampleProject(),source=p.report.header!,element=source.elements.find(element=>element.type==='text')!;
 const bundle=captureElements(p.report,p.datasets,source.id,element.id)!;
 const original=bundle.elements[0].text;element.text='Changed later';assert.equal(bundle.elements[0].text,original);
 assert.throws(()=>parseElementBundle('{"kind":"other"}'));
 const remote=structuredClone(bundle);remote.elements[0].type='image';remote.elements[0].src='https://invalid.example/image.png';
 const before=structuredClone(p.report);assert.throws(()=>placeElements(p.report,remote,p.report.pageHeader!.id,{x:0,y:0}),/PNG|JPEG/);assert.deepEqual(p.report,before);
 const wide=structuredClone(bundle);wide.elements[0].width=30;
 assert.throws(()=>placeElements(p.report,wide,p.report.pageHeader!.id,{x:0,y:0}),/do not fit/);
 assert.throws(()=>placeElements(p.report,bundle,'missing',{x:0,y:0}),/no longer exists/);
 assert.deepEqual(p.report,before);
});
