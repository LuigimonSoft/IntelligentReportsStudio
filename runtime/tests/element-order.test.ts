import test from 'node:test';
import assert from 'node:assert/strict';
import { reorderElements, elementLayerPosition } from '../domain/report/elementOrder.ts';
import { makeElement, compileReport } from '../engine/index.ts';
import { createBlankProject } from '../domain/report/blankProject.ts';

test('layer actions preserve geometry, move one layer or to an end, and never split tables', () => {
  const items = [makeElement('text', { id: 'text' }), makeElement('shape', { id: 'shape' }),
    makeElement('text', { id: 'cell-a', groupId: 'table' }), makeElement('text', { id: 'cell-b', groupId: 'table' })];
  const before = structuredClone(items);
  assert.deepEqual(reorderElements(items, 'shape', 'forward').map(el => el.id), ['text', 'cell-a', 'cell-b', 'shape']);
  assert.deepEqual(reorderElements(items, 'shape', 'backward').map(el => el.id), ['shape', 'text', 'cell-a', 'cell-b']);
  assert.deepEqual(reorderElements(items, 'shape', 'back').map(el => el.id), ['shape', 'text', 'cell-a', 'cell-b']);
  assert.deepEqual(reorderElements(items, 'shape', 'front').map(el => el.id), ['text', 'cell-a', 'cell-b', 'shape']);
  assert.deepEqual(elementLayerPosition(items, 'shape'), { index: 1, count: 3 });
  assert.equal(reorderElements(items, 'missing', 'front'), items);
  assert.deepEqual(items, before);
});

test('saved array order is the drawing order used by preview and PDF layout', () => {
  const project = createBlankProject('Layer test');
  const band = project.report.header!;
  band.elements = [makeElement('text', { id: 'text', text: 'Above the shape', x: 0, y: 0, width: 2, height: .3 }),
    makeElement('shape', { id: 'shape', shape: 'rectangle', borderColor: '#000000', borderWidth: 0, x: 0, y: 0, width: 2, height: .3 })];
  band.elements = reorderElements(band.elements, 'shape', 'back');
  const stored = JSON.parse(JSON.stringify(project));
  const layout = compileReport(stored.report, stored.datasets);
  assert.deepEqual(layout.pages[0].elements.filter(el => el.bandId === band.id).map(el => el.id), ['shape', 'text']);
});
