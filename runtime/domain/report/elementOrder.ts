import type { ReportElement } from '@reportstudio/mini-reports';

export type ElementOrderAction = 'front' | 'forward' | 'backward' | 'back';

/** A grouped table is one layer; moving past it never splits its cells. */
function layersOf(elements: ReportElement[]): ReportElement[][] {
  const layers = new Map<string, ReportElement[]>();
  for (const element of elements) {
    const key = element.groupId ? `group:${element.groupId}` : `element:${element.id}`;
    const layer = layers.get(key) ?? [];
    layer.push(element);
    layers.set(key, layer);
  }
  return [...layers.values()];
}
export function elementLayerPosition(elements: ReportElement[], elementId: string) {
  const layers = layersOf(elements);
  return {
    index: layers.findIndex((layer) => layer.some((element) => element.id === elementId)),
    count: layers.length,
  };
}
export function reorderElements(
  elements: ReportElement[],
  elementId: string,
  action: ElementOrderAction,
): ReportElement[] {
  const layers = layersOf(elements);
  const index = layers.findIndex((layer) => layer.some((element) => element.id === elementId));
  if (index < 0) return elements;
  const target =
    action === 'front'
      ? layers.length - 1
      : action === 'back'
        ? 0
        : Math.max(0, Math.min(layers.length - 1, index + (action === 'forward' ? 1 : -1)));
  if (target === index) return elements;
  const [moving] = layers.splice(index, 1);
  layers.splice(target, 0, moving);
  return layers.flat();
}
