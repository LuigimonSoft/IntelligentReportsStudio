import type { Band, ReportElement } from '../../engine/types.ts';

type Group = { elements: ReportElement[]; x: number; y: number; width: number; height: number };

/** Arrange selected objects inside one section; table cells remain a single object. */
export function alignElements(band: Band, selected: ReportElement[], operation: string): void {
  const groups = new Map<string, ReportElement[]>();
  for (const element of selected) {
    const key = element.groupId ? `group:${element.groupId}` : `element:${element.id}`;
    groups.set(key, [...(groups.get(key) ?? []), element]);
  }
  const objects: Group[] = [...groups.values()].map(elements => {
    const x = Math.min(...elements.map(element => element.x));
    const y = Math.min(...elements.map(element => element.y));
    return { elements, x, y, width: Math.max(...elements.map(element => element.x + element.width)) - x,
      height: Math.max(...elements.map(element => element.y + element.height)) - y };
  });
  if (objects.length < 2) throw new Error('Select at least two objects in the same section.');
  if (selected.some(element => !band.elements.includes(element))) throw new Error('Select objects in the same section.');
  const left = Math.min(...objects.map(o => o.x)), right = Math.max(...objects.map(o => o.x + o.width));
  const top = Math.min(...objects.map(o => o.y)), bottom = Math.max(...objects.map(o => o.y + o.height));
  const move = (object: Group, x: number, y: number) => object.elements.forEach(element => { element.x += x - object.x; element.y += y - object.y; });
  if (operation === 'distribute-horizontal' || operation === 'distribute-vertical') {
    if (objects.length < 3) throw new Error('Select at least three objects to distribute.');
    const horizontal = operation === 'distribute-horizontal';
    const sorted = [...objects].sort((a, b) => horizontal ? a.x - b.x : a.y - b.y);
    const start = horizontal ? left : top, end = horizontal ? right : bottom;
    const gap = (end - start - sorted.reduce((sum, o) => sum + (horizontal ? o.width : o.height), 0)) / (sorted.length - 1);
    let position = start;
    for (const object of sorted) { move(object, horizontal ? position : object.x, horizontal ? object.y : position); position += (horizontal ? object.width : object.height) + gap; }
    return;
  }
  for (const object of objects) {
    const x = operation === 'left' ? left : operation === 'center' ? (left + right - object.width) / 2 : operation === 'right' ? right - object.width : object.x;
    const y = operation === 'top' ? top : operation === 'middle' ? (top + bottom - object.height) / 2 : operation === 'bottom' ? bottom - object.height : object.y;
    move(object, x, y);
  }
}
