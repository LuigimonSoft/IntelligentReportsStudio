import test from 'node:test';
import assert from 'node:assert/strict';
import { createSampleProject } from '../domain/report/sample.ts';
import { compileReport } from '../engine/index.ts';
import { templateOnly } from '../data/sources.ts';

test('Apple example binds public figures to three editable charts and its detail rows', () => {
  const project = createSampleProject('apple-sales');
  const categories = project.datasets.find(table => table.id === 'categories')!;
  const regions = project.datasets.find(table => table.id === 'regions')!;
  assert.equal(categories.data.reduce((sum, row) => sum + Number(row.sales2025), 0), 416161);
  assert.equal(regions.data.reduce((sum, row) => sum + Number(row.sales), 0), 416161);
  const layout = compileReport(project.report, project.datasets);
  assert.equal(layout.pages.length, 1);
  const elements = layout.pages.flatMap(page => page.elements);
  assert.deepEqual(elements.filter(element => element.type === 'chart').map(element => element.chartData?.length), [5, 5, 2]);
  assert.ok(elements.some(element => element.lines?.includes('iPhone')));
  const saved = templateOnly(project);
  assert.ok(saved.datasets.every(table => table.data.length === 0));
  categories.data[0].sales2025 = 1;
  assert.equal(compileReport(project.report, project.datasets).pages[0].elements.find(element => element.type === 'chart')?.chartData?.[0].value, 1);
});
