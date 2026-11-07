import test from 'node:test';
import assert from 'node:assert/strict';
import {act} from '../core.ts';
import {createSampleProject} from '../domain/report/sample.ts';
import {bandsOf, evaluateExpression} from '../engine/index.ts';

test('palette insertion preserves spacing, value formats and special field expressions',async()=>{
 let project=createSampleProject();const band=project.report.header!.id;
 for(const field of [{text:'[quantity]',kind:'number'},{text:'[=quantity * unitPrice]',kind:'formula'},{text:"[=FORMAT(DATE(), 'dd/mm/yyyy')]",kind:'special'},{text:'[PAGE_NUMBER]',kind:'special'},{text:'[ROW_COUNT]',kind:'special'}]){
  const before=bandsOf(project.report).find(b=>b.id===band)!;
  const expected=Math.max(.05,...before.elements.map(e=>e.y+e.height+.08));
  const result=await act({project,band,action:'add-field',args:{field}});project=result.project;
  const element=bandsOf(project.report).find(b=>b.id===band)!.elements.at(-1)!;
  assert.equal(element.y,expected);assert.equal(element.text,field.text);assert.equal(element.style.format,field.kind==='number'?'number':field.kind==='formula'?'currency':'text');
 }
 const result=await act({project,band,action:'add-field',args:{field:{text:'[quantity]',kind:'number'},x:999,y:.2}});
 const element=bandsOf(result.project.report).find(b=>b.id===band)!.elements.at(-1)!;
 assert.equal(element.x,project.report.page.width-project.report.page.margins.left-project.report.page.margins.right-element.width);
});
test('formula and special fields evaluate with record, table and page contexts',()=>{
 const context={row:{quantity:3,unitPrice:10},rows:[{quantity:3,unitPrice:10},{quantity:2,unitPrice:5}],rowNumber:2,rowCount:2,tableRowNumber:2,columnNumber:3,pageNumber:1,pageCount:1,now:new Date('2026-10-18T12:00:00Z')};
 for(const [expression,expected] of [['quantity * unitPrice',30],['SUM(quantity * unitPrice)',40],['ROW_NUMBER',2],['ROW_COUNT',2],['TABLE_ROW_NUMBER',2],['COLUMN_NUMBER',3],['IS_ODD_ROW',false],['PAGE_NUMBER',1],['PAGE_COUNT',1],["FORMAT(DATE(), 'dd/mm/yyyy')",'18/10/2026']] as const) assert.equal(evaluateExpression(expression,context),expected);
});
