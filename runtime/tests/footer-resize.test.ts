import test from 'node:test';
import assert from 'node:assert/strict';
import { createSampleProject } from '../domain/report/sample.ts';
import { resizeSectionBoundary, sectionHeights, contentHeight } from '../tabs/design/report-area/sectionGeometry.ts';
const measure = (text: string) => text.length * 0.07;
function reportWithNotes() {
  const report = createSampleProject().report;
  report.footer!.elements = report.footer!.elements.filter(element => element.y > 1);
  assert(report.footer!.elements.length > 0);
  return report;
}
test('resizing a page footer does not alter the independent report footer', () => {
  const report = reportWithNotes();
  const before = structuredClone(report.footer!);
  const oldHeight = report.pageFooter!.height;
  resizeSectionBoundary(report, report.pageFooter!.id, oldHeight + 1, measure);
  assert.equal(report.pageFooter!.height, oldHeight + 1);
  assert.deepEqual(report.footer, before);
});
test('final section height can be reduced without resizing another section', () => {
  const report = reportWithNotes();
  const before = [...sectionHeights(report).values()].reduce((a, b) => a + b, 0);
  resizeSectionBoundary(report, report.footer!.id, 0.8, measure);
  assert(Math.abs(report.footer!.height - 0.8) < 1e-9);
  assert(contentHeight(report.footer!, measure) <= report.footer!.height + 1e-9);
  const after = [...sectionHeights(report).values()].reduce((a, b) => a + b, 0);
  assert(Math.abs((before - after) - (reportWithNotes().footer!.height - 0.8)) < 1e-9);
});
