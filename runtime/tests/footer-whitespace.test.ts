import test from 'node:test';
import assert from 'node:assert/strict';
import { compileReport } from '../engine/index.ts';
import { whitespaceProject } from './fixtures/footerWhitespace.ts';
import { sectionHeights } from '../tabs/design/report-area/sectionGeometry.ts';

test('growing rows consume blank footer space without shifting bottom content or editing the JSON', () => {
  const project = whitespaceProject(); const before = structuredClone(project);
  const heights = Object.fromEntries(sectionHeights(project.report));
  const layout = compileReport(project.report, project.datasets, { sectionHeights: heights });
  assert.equal(layout.pages.length, 1);
  const items = layout.pages[0].elements;
  assert.equal(items.filter(element => element.id === 'row').length, 3);
  assert(items.find(element => element.id === 'total')!.y > Math.max(...items.filter(element => element.id === 'row').map(element => element.y + element.height)));
  const footerTop = project.report.page.height - project.report.page.margins.bottom - heights[project.report.footer!.id] - heights[project.report.pageFooter!.id];
  for (const element of project.report.pageFooter!.elements)
    assert(Math.abs(items.find(item => item.id === element.id)!.y - (footerTop + element.y)) < 1e-8);
  assert.deepEqual(project, before);
  const moreRows = whitespaceProject(100);
  const overflow = compileReport(moreRows.report, moreRows.datasets, { sectionHeights: Object.fromEntries(sectionHeights(moreRows.report)) });
  assert(overflow.pages.length > 1);
  assert.equal(overflow.pages.flatMap(page => page.elements).filter(element => element.id === 'row').length, 100);
  assert.equal(overflow.pages.flatMap(page => page.elements).filter(element => element.id === 'total').length, 1);
  for (const page of overflow.pages) {
    const line = page.elements.find(element => element.id === 'footer-line')!;
    for (const row of page.elements.filter(element => element.id === 'row')) assert(row.y + row.height <= line.y + 1e-8);
  }
});
