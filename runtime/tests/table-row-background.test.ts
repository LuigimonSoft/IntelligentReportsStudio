import test from 'node:test';
import assert from 'node:assert/strict';
import { compileReport, evaluateExpression, tableBackground, validateProject } from '../engine/index.ts';
import { createTable } from '../domain/report/tableElements.ts';
import { whitespaceProject } from './fixtures/footerWhitespace.ts';
import { sectionHeights } from '../tabs/design/report-area/sectionGeometry.ts';

const formula = "IF(MOD(ROW_NUMBER, 2) = 1, '#e5e7eb', '#ffffff')";
test('row background formulas alternate across pagination and survive JSON round trips', () => {
  const project=whitespaceProject(60);const detail=project.report.details[0];
  const table=createTable(project.datasets[0],3);const settings=table[0].table!;
  settings.headers=false;settings.rows=1;settings.styles={'row:0':{backgroundExpression:formula}};
  detail.band.elements=createTable(project.datasets[0],3,settings,'stripe');
  const before=JSON.parse(JSON.stringify(project));assert.doesNotThrow(()=>validateProject(before));
  const layout=compileReport(before.report,before.datasets,{sectionHeights:Object.fromEntries(sectionHeights(before.report))});
  assert(layout.pages.length>1);
  const backgrounds=layout.pages.flatMap(page=>page.elements).filter(el=>el.id==='stripe-0:0-background');
  assert.equal(backgrounds.length,60);
  backgrounds.forEach((el,index)=>assert.equal(el.style.color,index%2===0?'#e5e7eb':'#ffffff'));
  assert.equal(evaluateExpression('ROW_COUNT', {row:{},rows:[],rowCount:60,now:new Date()}),60);
  assert.equal(evaluateExpression('IF(IS_ODD_ROW, 1, 0)', {row:{},rows:[],rowNumber:2,now:new Date()}),0);
  assert.throws(()=>evaluateExpression('MOD(1, 0)', {row:{},rows:[],now:new Date()}),/zero/);
});
test('table row/column special fields and data fields share context; invalid colors fail explicitly', () => {
  const project=whitespaceProject();const cells=createTable(project.datasets[0],3);const cell=cells.find(el=>el.type==='box'&&el.cell?.row===1)!;
  cell.table!.styles={'row:1':{backgroundExpression:"IF(TABLE_ROW_NUMBER = 2 && COLUMN_NUMBER = 1 && description = 'Item 1', '#aaaaaa', '#ffffff')"}};
  const context={row:project.datasets[0].data[0],rows:project.datasets[0].data,now:new Date()};
  assert.equal(tableBackground(cell,context),'#aaaaaa');
  cell.table!.styles['row:1'].backgroundExpression="'invalid'";
  assert.throws(()=>tableBackground(cell,context),/hex color/);
});
