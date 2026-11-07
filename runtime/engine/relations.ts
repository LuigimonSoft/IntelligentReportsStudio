import type { DataRow, Dataset, TableRelation } from './types.ts';
export type JoinedRow = {
  row: DataRow;
  index: number;
  related: DataRow | null;
  relatedIndex: number | null;
};
/** Equality join: no coercion, and NULL never matches NULL. Source rows remain untouched. */
export function joinRelatedRows(
  datasets: Dataset[],
  datasetId: string,
  relation: TableRelation,
  mode: 'inner' | 'left' = 'inner',
): { rows: JoinedRow[]; relatedDataset: Dataset } {
  const reverse = relation.to.dataset === datasetId && relation.from.dataset !== datasetId;
  const local = reverse ? relation.to : relation.from;
  const remote = reverse ? relation.from : relation.to;
  if (local.dataset !== datasetId)
    throw new Error('The relationship does not belong to this table.');
  const source = datasets.find((ds) => ds.id === datasetId);
  const target = datasets.find((ds) => ds.id === remote.dataset);
  if (!source || !target) throw new Error('Unknown related table.');
  const lookup = new Map<unknown, { row: DataRow; index: number }[]>();
  target.data.forEach((row, index) => {
    const key = row[remote.field];
    if (key === null || key === undefined) return;
    const matches = lookup.get(key) ?? [];
    matches.push({ row, index });
    lookup.set(key, matches);
  });
  const rows: JoinedRow[] = [];
  source.data.forEach((row, index) => {
    const key = row[local.field];
    const matches = key === null || key === undefined ? [] : (lookup.get(key) ?? []);
    for (const match of matches)
      rows.push({ row, index, related: match.row, relatedIndex: match.index });
    if (!matches.length && mode === 'left')
      rows.push({ row, index, related: null, relatedIndex: null });
  });
  return { rows, relatedDataset: target };
}
