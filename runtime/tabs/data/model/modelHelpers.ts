import { sqlTypeLabel } from '@reportstudio/mini-reports';
import type { Dataset, Field, TableRelation, DataModelSettings } from '@reportstudio/mini-reports';
export type Endpoint = TableRelation['from'];
export const TABLE_WIDTH = 220;
export const HEADER_HEIGHT = 40;
export const FIELD_HEIGHT = 30;
export const MODEL_COLORS = ['#5795ff', '#34c759', '#ffad24', '#8255ff', '#ff8094', '#36b9c8'];
export const endpointValue = (ref: Endpoint) => JSON.stringify([ref.dataset, ref.field]);
export const parseEndpoint = (value: string): Endpoint => {
  const [dataset, field] = JSON.parse(value) as [string, string];
  return { dataset, field };
};
export const sameEndpoint = (a: Endpoint, b: Endpoint) =>
  a.dataset === b.dataset && a.field === b.field;
export function visibleFields(
  table: Dataset,
  settings: DataModelSettings,
  relations: TableRelation[],
) {
  const hidden = settings.tables[table.id]?.hiddenFields ?? [];
  return table.schema.fields.filter(
    (field) =>
      !hidden.includes(field.name) ||
      relations.some((r) =>
        [r.from, r.to].some((ref) => ref.dataset === table.id && ref.field === field.name),
      ),
  );
}
export function fieldType(table: Dataset, field: Field): string {
  if (field.sqlType) return sqlTypeLabel(field);
  if (field.type === 'boolean') return 'BOOLEAN';
  if (field.type === 'number')
    return table.data.some(
      (row) => typeof row[field.name] === 'number' && !Number.isInteger(row[field.name]),
    )
      ? 'DECIMAL'
      : 'INT';
  const values = table.data
    .map((row) => row[field.name])
    .filter((value) => value !== null && value !== undefined && value !== '');
  if (values.length && values.every((value) => typeof value === 'boolean')) return 'BOOLEAN';
  if (
    values.length &&
    values.every((value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T|$)/.test(value))
  )
    return 'DATE';
  return 'VARCHAR';
}
export function fieldIcon(table: Dataset, field: Field, relations: TableRelation[]): string {
  if (
    /^(id|id[A-Z_]|.*_id$)/.test(field.name) &&
    !relations.some((r) => sameEndpoint(r.to, { dataset: table.id, field: field.name }))
  )
    return 'key';
  if (
    relations.some((r) =>
      [r.from, r.to].some((ref) => ref.dataset === table.id && ref.field === field.name),
    )
  )
    return 'link';
  const type = fieldType(table, field);
  return /^(DATE|TIME|DATETIME|SMALLDATETIME)/.test(type)
    ? 'calendar'
    : field.type === 'boolean'
      ? 'check'
      : field.type === 'text'
        ? 'letters'
        : 'hash';
}
export function relationshipError(
  datasets: Dataset[],
  relations: TableRelation[],
  from: Endpoint,
  to: Endpoint,
  editingId?: string,
) {
  if (!editingId && relations.length >= 200) return 'Maximum 200 relationships per model.';
  const a = datasets
    .find((ds) => ds.id === from.dataset)
    ?.schema.fields.find((f) => f.name === from.field);
  const b = datasets
    .find((ds) => ds.id === to.dataset)
    ?.schema.fields.find((f) => f.name === to.field);
  if (!a || !b) return 'Select both columns.';
  if (from.dataset === to.dataset) return 'Select columns from different tables.';
  if (a.type !== b.type) return 'Columns must have the same data type.';
  if (
    relations.some(
      (r) =>
        r.id !== editingId &&
        ((sameEndpoint(r.from, from) && sameEndpoint(r.to, to)) ||
          (sameEndpoint(r.from, to) && sameEndpoint(r.to, from))),
    )
  )
    return 'This relationship already exists.';
  return '';
}
export function suggestCardinality(
  datasets: Dataset[],
  from: Endpoint,
  to: Endpoint,
): TableRelation['cardinality'] {
  const unique = (ref: Endpoint) => {
    const rows = datasets.find((ds) => ds.id === ref.dataset)?.data ?? [];
    const values = rows
      .map((row) => row[ref.field])
      .filter((value) => value !== null && value !== undefined);
    return !values.length ? /^(id|.*_id)$/.test(ref.field) : new Set(values).size === values.length;
  };
  return `${unique(from) ? '1' : 'n'}:${unique(to) ? '1' : 'n'}` as TableRelation['cardinality'];
}
/** Place parent tables before their children; cycles still receive a stable position. */
export function arrangeTables(datasets: Dataset[], relations: TableRelation[]) {
  const levels = new Map<string, number>();
  const parent = (relation: TableRelation) =>
    relation.cardinality === 'n:1'
      ? [relation.to.dataset, relation.from.dataset]
      : [relation.from.dataset, relation.to.dataset];
  const edges = relations.map(parent).filter(([a, b]) => a !== b);
  const roots = datasets.filter(
    (ds) =>
      edges.some(([a, b]) => a === ds.id || b === ds.id) && !edges.some(([, b]) => b === ds.id),
  );
  const queue = roots.map((ds) => ds.id);
  queue.forEach((id) => levels.set(id, 0));
  while (queue.length) {
    const id = queue.shift()!;
    for (const [a, b] of edges)
      if (a === id && !levels.has(b)) {
        levels.set(b, levels.get(id)! + 1);
        queue.push(b);
      }
  }
  const slots = new Map<number, number>();
  const positions: Record<string, { x: number; y: number }> = {};
  const ordered = [...datasets].sort(
    (a, b) => (levels.get(a.id) ?? 100) - (levels.get(b.id) ?? 100),
  );
  for (const ds of ordered) {
    const level =
      levels.get(ds.id) ?? [0, 1, 2].sort((a, b) => (slots.get(a) ?? 50) - (slots.get(b) ?? 50))[0];
    const y = slots.get(level) ?? 50;
    slots.set(level, y + HEADER_HEIGHT + ds.schema.fields.length * FIELD_HEIGHT + 65);
    positions[ds.id] = { x: 180 + level * 300, y };
  }
  return positions;
}
export function modelSQL(datasets: Dataset[], relations: TableRelation[]) {
  const quote = (name: string, tableId?: string) => {
    const dialect = datasets
      .find((table) => table.id === tableId)
      ?.schema.fields.find((field) => field.sqlType)?.sqlType?.dialect;
    return dialect === 'mysql'
      ? `\`${name.replaceAll('`', '``')}\``
      : dialect === 'postgresql'
        ? `"${name.replaceAll('"', '""')}"`
        : `[${name.replaceAll(']', ']]')}]`;
  };
  return (
    datasets
      .map(
        (ds) =>
          `CREATE TABLE ${quote(ds.id, ds.id)} (\n${ds.schema.fields.map((field) => `  ${quote(field.name, ds.id)} ${sqlTypeLabel(field)}`).join(',\n')}\n);`,
      )
      .join('\n\n') +
    '\n\n' +
    relations
      .map(
        (r) =>
          `-- ${r.cardinality}\nSELECT * FROM ${quote(r.from.dataset, r.from.dataset)} AS a\nINNER JOIN ${quote(r.to.dataset, r.to.dataset)} AS b ON a.${quote(r.from.field, r.from.dataset)} = b.${quote(r.to.field, r.to.dataset)};`,
      )
      .join('\n\n')
  );
}
