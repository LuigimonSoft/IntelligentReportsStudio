import test from 'node:test';
import assert from 'node:assert/strict';
import { createShape } from '../domain/report/reportTools.ts';
import { upgradeRectangles } from '../domain/report/rectangleElements.ts';
import { createBlankProject } from '../domain/report/blankProject.ts';
import { makeElement, validateProject } from '../engine/index.ts';

test('rectangles share the vector shape model, border and fill defaults',()=>{
 const rectangle=createShape('rectangle');const circle=createShape();
 assert.equal(rectangle.type,'shape');assert.equal(rectangle.shape,'rectangle');assert.equal(circle.shape,'circle');
 assert.deepEqual(rectangle.style,circle.style);assert.equal(rectangle.borderWidth,circle.borderWidth);
});
test('old standalone rectangles upgrade while table cell boxes remain unchanged',()=>{
 const project=createBlankProject('Rectangles');
 const box=makeElement('box',{id:'rectangle',x:.3,y:.1,width:2,height:.4});
 const cell=makeElement('box',{id:'table-cell',groupId:'table'});
 project.report.header!.elements=[box,cell];upgradeRectangles(project.report);
 const rectangle=project.report.header!.elements[0];assert.equal(rectangle.type,'shape');assert.equal(rectangle.shape,'rectangle');
 assert.equal(rectangle.x,box.x);assert.equal(rectangle.style.color,box.style.color);
 assert.equal(project.report.header!.elements[1],cell);
 assert.doesNotThrow(()=>validateProject(project));
});
