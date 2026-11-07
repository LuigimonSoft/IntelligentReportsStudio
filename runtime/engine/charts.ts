import type { ChartSettings, ChartPoint, Dataset } from './types.ts';

export const chartKinds = ['column', 'bar', 'line', 'area', 'pie', 'donut'] as const;
export function defaultChart(dataset?: Dataset): ChartSettings {
  return {
    kind: 'column',
    dataset: dataset?.id ?? '',
    category:
      dataset?.schema.fields.find((field) => field.type === 'text')?.name ??
      dataset?.schema.fields[0]?.name ??
      '',
    value: dataset?.schema.fields.find((field) => field.type === 'number')?.name ?? '',
    aggregation: 'sum',
    sort: 'source',
    limit: 12,
    title: '',
    color: '#2563eb',
    background: '#ffffff',
    showLegend: true,
    showLabels: false,
    showGrid: true,
  };
}

/** Aggregate current source rows; saved chart definitions contain bindings, never row snapshots. */
export function chartPoints(settings: ChartSettings, datasets: Dataset[]): ChartPoint[] {
  const dataset = datasets.find((source) => source.id === settings.dataset);
  if (!dataset || !settings.category || (!settings.value && settings.aggregation !== 'count'))
    return [];
  if (
    !dataset.schema.fields.some((field) => field.name === settings.category) ||
    (settings.aggregation !== 'count' &&
      !dataset.schema.fields.some(
        (field) => field.name === settings.value && field.type === 'number',
      ))
  )
    return [];
  const groups = new Map<string, number[]>();
  for (const row of dataset.data) {
    const label = String(row[settings.category] ?? '');
    const raw = row[settings.value];
    const value =
      settings.aggregation === 'count'
        ? 1
        : raw === null || raw === '' || raw === undefined
          ? NaN
          : Number(raw);
    if (!Number.isFinite(value)) continue;
    const group = groups.get(label) ?? [];
    group.push(value);
    groups.set(label, group);
  }
  const points = [...groups]
    .map(([label, values]) => {
      const sum = values.reduce((total, value) => total + value, 0);
      const value =
        settings.aggregation === 'count'
          ? values.length
          : settings.aggregation === 'average'
            ? sum / values.length
            : settings.aggregation === 'min'
              ? values.reduce((a, b) => Math.min(a, b), Infinity)
              : settings.aggregation === 'max'
                ? values.reduce((a, b) => Math.max(a, b), -Infinity)
                : sum;
      return { label, value };
    })
    .filter((point) => Number.isFinite(point.value));
  if (settings.sort !== 'source')
    points.sort((a, b) => (settings.sort === 'ascending' ? a.value - b.value : b.value - a.value));
  return points.slice(0, Math.min(200, Math.max(1, settings.limit)));
}
