import test from 'node:test';
import assert from 'node:assert/strict';
import { createReport, rootBandsOf, ensureDefaultSections, isDefaultSection, compileReport } from '../engine/index.ts';
import { createSampleProject } from '../domain/report/sample.ts';
import { bindSourceData, templateOnly } from '../data/sources.ts';
import { sectionHeights } from '../tabs/design/report-area/sectionGeometry.ts';
const names = ["Report header", "Page header", "Details header", "Details", "Details footer", "Page footer", "Report footer"];

test('builder and initial example include seven visible default roles in the requested order', () => {
  for (const report of [createReport("New").detail(.4).data('rows').done(), createSampleProject().report]) {
    assert.deepEqual(rootBandsOf(report).map(band => band.name), names);
    assert(rootBandsOf(report).every(band => band.visible !== false && isDefaultSection(report, band.id)));
    const before = structuredClone(report);
    ensureDefaultSections(report);
    assert.deepEqual(report, before);
  }
});

test('missing legacy sections are restored hidden and their visibility and content survive saving', () => {
  const project = createSampleProject();
  delete project.report.pageHeader;
  delete project.report.details[0].groupFooter;
  const restored = bindSourceData(project);
  assert.equal(rootBandsOf(restored.report).length, 7);
  assert.equal(restored.report.pageHeader!.visible, false);
  assert.equal(restored.report.details[0].groupFooter!.visible, false);
  const header = restored.report.header!;
  const elements = structuredClone(header.elements);
  header.visible = false;
  const saved = templateOnly(restored);
  assert.equal(saved.report.header!.visible, false);
  assert.deepEqual(saved.report.header!.elements, elements);
  assert.equal(rootBandsOf(bindSourceData(saved).report).length, 7);
});

test('editor layout places the page footer before the final report footer and hidden roles do not render', () => {
  const project = createSampleProject();
  const layout = compileReport(project.report, project.datasets, {sectionHeights: Object.fromEntries(sectionHeights(project.report))});
  const elements = layout.pages.at(-1)!.elements;
  const pageBottom = Math.max(...elements.filter(el => el.bandId === project.report.pageFooter!.id).map(el => el.y + el.height));
  const reportTop = Math.min(...elements.filter(el => el.bandId === project.report.footer!.id).map(el => el.y));
  assert(pageBottom <= reportTop);
  const ids = new Set(rootBandsOf(project.report).map(band => band.id));
  rootBandsOf(project.report).forEach(band => band.visible = false);
  const hidden = compileReport(project.report, project.datasets, {sectionHeights: Object.fromEntries(sectionHeights(project.report))});
  assert.equal(hidden.pages.flatMap(page => page.elements).filter(el => ids.has(el.bandId)).length, 0);
  assert.deepEqual(rootBandsOf(project.report).map(band => band.name), names);
});
