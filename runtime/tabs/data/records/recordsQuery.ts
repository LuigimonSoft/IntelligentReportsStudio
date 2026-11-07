import es from '../../../i18n/es.json' with { type: 'json' };
import {
  joinRelatedRows,
  type Dataset,
  type TableRelation,
  type PreviewParameter,
  type JoinedRow,
  type DataRow,
} from '@reportstudio/mini-reports';
export type RecordFilter = {
  id: string;
  columns: string[];
  word: string;
  operator: 'contains' | 'eq' | 'gte' | 'lte' | 'empty' | 'notEmpty';
};
export type RecordColumn = {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'boolean';
  table: Dataset;
  related: boolean;
};
export type RecordSort = { column: string; direction: 'asc' | 'desc' } | null;
const labels: Record<string, string> = {
  addressType: 'Type',
  name: 'Name',
  street1: 'Address',
  street2: 'Address 2',
  city: 'City',
  state: 'Status',
  zipcode: 'Postal code',
  country: 'Country',
  category: 'Category',
  description: 'Description',
  unitLabel: 'Unit',
  quantity: 'Quantity',
  unitPrice: 'Unit price',
  subtotal: 'Subtotal',
  date: 'Date',
  client: 'Customer',
  status: 'Status',
  issueDate: 'Issue date',
  dueDate: 'Due date',
  currency: 'Currency',
  number: 'Number',
  conditions: 'Terms',
  project: 'Project',
  seller: 'Sales representative',
  rfc: 'Tax ID',
};
export const recordLabel = (name: string) => labels[name] ?? name;
/** Retain localized column heuristics without embedding translated names in code. */
export function semanticColumnName(name: string): string {
  const normalized = normalizeSearch(name);
  for (const key of ['Date', 'Price', 'Tax', 'Amount', 'Fee']) {
    const alias = (es as Record<string, string>)[key];
    if (alias && normalized.includes(normalizeSearch(alias))) return key;
  }
  return name;
}

export const normalizeSearch = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
export const recordValue = (row: JoinedRow, column: RecordColumn) =>
  column.related ? row.related?.[column.name] : row.row[column.name];
export function recordColumns(table: Dataset, related?: Dataset): RecordColumn[] {
  return [
    ...table.schema.fields.map((f) => ({
      id: f.name,
      name: f.name,
      label: recordLabel(f.name),
      type: f.type,
      table,
      related: false,
    })),
    ...(related?.schema.fields.map((f) => ({
      id: `related:${f.name}`,
      name: f.name,
      label: `${related.name} · ${recordLabel(f.name)}`,
      type: f.type,
      table: related,
      related: true,
    })) ?? []),
  ];
}
export function queryRecords(options: {
  datasets: Dataset[];
  table: Dataset;
  relation?: TableRelation;
  joinMode: 'inner' | 'left';
  parameters: PreviewParameter[];
  values: Record<string, string>;
  filters: RecordFilter[];
  combination: 'and' | 'or';
  search: string;
  sort: RecordSort;
  limit: number;
  locale: string;
}) {
  const {
    datasets,
    table,
    relation,
    joinMode,
    parameters,
    values,
    filters,
    combination,
    search,
    sort,
    limit,
    locale,
  } = options;
  const joined = relation ? joinRelatedRows(datasets, table.id, relation, joinMode) : undefined;
  const columns = recordColumns(table, joined?.relatedDataset);
  const source: JoinedRow[] =
    joined?.rows ??
    table.data.map((row, index) => ({ row, index, related: null, relatedIndex: null }));
  const activeFilters = filters.filter(
    (f) => f.word.trim() || f.operator === 'empty' || f.operator === 'notEmpty',
  );
  const compare = (
    value: unknown,
    word: string,
    operator: RecordFilter['operator'],
    numeric = false,
  ) => {
    if (operator === 'empty') return value === null || value === undefined || value === '';
    if (operator === 'notEmpty') return value !== null && value !== undefined && value !== '';
    if (operator === 'contains')
      return normalizeSearch(value).includes(normalizeSearch(word.trim()));
    if (value === null || value === undefined) return false;
    if (operator === 'eq') return normalizeSearch(value) === normalizeSearch(word.trim());
    const a = numeric ? Number(value) : String(value),
      b = numeric ? Number(word) : word;
    return operator === 'gte' ? a >= b : a <= b;
  };
  const matches = source.filter((row) => {
    for (const parameter of parameters) {
      const value = values[parameter.id] ?? '';
      if (!value) continue;
      const data =
        parameter.dataset === table.id
          ? row.row
          : parameter.dataset === joined?.relatedDataset.id
            ? row.related
            : undefined;
      if (data === undefined) continue;
      const type = datasets
        .find((ds) => ds.id === parameter.dataset)
        ?.schema.fields.find((f) => f.name === parameter.field)?.type;
      if (!compare(data?.[parameter.field], value, parameter.operator, type === 'number'))
        return false;
    }
    const test = (filter: RecordFilter) =>
      filter.columns.some((id) => {
        const column = columns.find((c) => c.id === id);
        return (
          column &&
          compare(recordValue(row, column), filter.word, filter.operator, column.type === 'number')
        );
      });
    if (
      activeFilters.length &&
      !(combination === 'and' ? activeFilters.every(test) : activeFilters.some(test))
    )
      return false;
    return (
      !search.trim() ||
      columns.some((c) =>
        normalizeSearch(recordValue(row, c)).includes(normalizeSearch(search.trim())),
      )
    );
  });
  if (sort) {
    const column = columns.find((c) => c.id === sort.column);
    if (column) {
      const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
      matches.sort((a, b) => {
        const av = recordValue(a, column),
          bv = recordValue(b, column);
        if (av === null || av === undefined) return bv === null || bv === undefined ? 0 : 1;
        if (bv === null || bv === undefined) return -1;
        const delta =
          column.type === 'number'
            ? Number(av) - Number(bv)
            : collator.compare(String(av), String(bv));
        return sort.direction === 'asc' ? delta : -delta;
      });
    }
  }
  return {
    rows: matches.slice(0, limit),
    total: matches.length,
    sourceCount: source.length,
    columns,
    related: joined?.relatedDataset,
  };
}
export function formatRecord(
  value: unknown,
  column: RecordColumn,
  locale: string,
  decimals: number,
  nullAsEmpty: boolean,
) {
  if (value === null || value === undefined) return nullAsEmpty ? '' : 'NULL';
  if (typeof value === 'number') {
    if (/(^id|_id$)/i.test(column.name)) return String(value);
    const monetary = /(price|total|tax|amount|fee)/i.test(semanticColumnName(column.name));
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: monetary ? decimals : 0,
      maximumFractionDigits: decimals,
    }).format(value);
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00`);
    if (Number.isFinite(date.getTime()))
      return new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(date);
  }
  return String(value);
}
export function projectRecordRows(rows: JoinedRow[], columns: RecordColumn[]): DataRow[] {
  return rows.map((row) =>
    Object.fromEntries(
      columns.map((c) => [
        c.related ? `${c.table.id}.${c.name}` : c.name,
        recordValue(row, c) ?? null,
      ]),
    ),
  );
}
export function recordsCSV(rows: DataRow[], names: string[]) {
  const cell = (value: unknown) => {
    let text = String(value ?? '');
    if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return (
    '\ufeff' +
    [
      names.map(cell).join(','),
      ...rows.map((row) => names.map((name) => cell(row[name])).join(',')),
    ].join('\r\n')
  );
}
export function recordsSQL(
  table: Dataset,
  relation: TableRelation | undefined,
  joinMode: 'inner' | 'left',
  columns: RecordColumn[],
  limit: number,
) {
  const quote = (name: string) => `[${name.replaceAll(']', ']]')}]`;
  const sql = `SELECT TOP ${limit}\n  ${columns.map((c) => `${c.related ? 'b' : 'a'}.${quote(c.name)}`).join(',\n  ')}\nFROM ${quote(table.id)} AS a`;
  if (!relation) return sql + ';';
  const reverse = relation.to.dataset === table.id;
  const local = reverse ? relation.to : relation.from,
    remote = reverse ? relation.from : relation.to;
  return `${sql}\n${joinMode.toUpperCase()} JOIN ${quote(remote.dataset)} AS b ON a.${quote(local.field)} = b.${quote(remote.field)};`;
}
