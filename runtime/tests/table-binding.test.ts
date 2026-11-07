import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSampleProject } from '../domain/report/sample.ts';
import { compileReport } from '../engine/index.ts';

test('concepts table resolves data fields and refreshes after editing records', () => {
  const project = createSampleProject();
  const dataset = project.datasets.find(dataset => dataset.id === 'invoice')!;
  const detail = project.report.details.find(detail => detail.dataset === dataset.id)!;
  assert(detail.band.elements.every(element => element.groupId));
  dataset.data[0].description = "Item actualizado";
  dataset.data[0].quantity = 321;
  const text = compileReport(project.report, project.datasets).pages.flatMap(page => page.elements).map(element => element.text).join('\n');
  assert(text.includes("Item actualizado"));
  assert(text.includes('321'));
  assert(!text.includes('{description}'));
  assert(!text.includes('[description]'));
});
