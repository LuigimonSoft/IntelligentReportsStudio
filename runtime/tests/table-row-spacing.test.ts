import test from 'node:test';
import assert from 'node:assert/strict';
import { compileReport } from '../engine/index.ts';
import { createTable } from '../domain/report/tableElements.ts';
import { whitespaceProject } from './fixtures/footerWhitespace.ts';
import { sectionHeights } from '../tabs/design/report-area/sectionGeometry.ts';

test('table detail borders meet without gaps, including wrapped rows, leading template space and pagination', () => {
  const project=whitespaceProject(55);const detail=project.report.details[0];
  const settings=createTable(project.datasets[0],2)[0].table!;settings.rows=1;settings.headers=false;
  detail.band.elements=createTable(project.datasets[0],2,settings,'continuous').map(element=>({...element,y:element.y+.12}));
  project.datasets[0].data[1].description='A long description that wraps over several lines and expands the entire table row together.';
  const original=structuredClone(project);
  const layout=compileReport(project.report,project.datasets,{sectionHeights:Object.fromEntries(sectionHeights(project.report))});
  assert(layout.pages.length>1);
  assert.equal(layout.pages.flatMap(page=>page.elements).filter(el=>el.id==='continuous-0:0-background').length,55);
  for(const page of layout.pages){
    const rows=page.elements.filter(el=>el.id==='continuous-0:0-background');
    for(let i=1;i<rows.length;i++) assert(Math.abs(rows[i].y-(rows[i-1].y+rows[i-1].height))<1e-8, `Gap on page ${page.number}`);
  }
  const rows=layout.pages[0].elements.filter(el=>el.id==='continuous-0:0-background');assert(rows[1].height>rows[0].height);
  assert.deepEqual(project,original);
});
