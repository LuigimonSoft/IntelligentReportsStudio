import { schemeTableau10 } from './d3.ts';
import type { ChartSettings } from '@reportstudio/mini-reports';

/** Overrides belong to category labels, so changing sort order never reassigns them. */
export function chartCategoryColor(settings: ChartSettings, label: string, index: number): string {
  if (settings.categoryColors && Object.hasOwn(settings.categoryColors, label)) {
    return settings.categoryColors[label];
  }
  if (settings.kind !== 'pie' && settings.kind !== 'donut') return settings.color;
  const palette = [settings.color, ...schemeTableau10.filter((color) => color !== settings.color)];
  return palette[index % palette.length];
}
