import test from 'node:test';
import assert from 'node:assert/strict';
import {compileReport} from '../engine/index.ts';
import {whitespaceProject} from './fixtures/footerWhitespace.ts';
import {sectionHeights} from '../tabs/design/report-area/sectionGeometry.ts';

test('section layout applies independent margins and moves anchored footers', () => {
  const project = whitespaceProject();
  const heights = Object.fromEntries(sectionHeights(project.report));
  const layout = () => compileReport(project.report, project.datasets, {sectionHeights: heights});
  const before = layout();
  project.report.page.margins = {top: 1, bottom: 1.2, left: 1.1, right: 1.3};
  const after = layout();
  const find = (result, id) => result.pages.flatMap(page => page.elements).find(el => el.id === id)!;
  assert.equal(find(after, 'title').y - find(before, 'title').y, 1 - before.margins!.top);
  assert.equal(find(after, 'title').x - find(before, 'title').x, 1.1 - before.margins!.left);
  assert(Math.abs((find(before, 'notes').y - find(after, 'notes').y) - (1.2 - before.margins!.bottom)) < 1e-8);
  assert.deepEqual(after.margins, {top: 1, bottom: 1.2, left: 1.1, right: 1.3});
});
