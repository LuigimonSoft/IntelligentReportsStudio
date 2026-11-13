import type { ReportElement, TableSettings } from '@reportstudio/mini-reports';
export type TableScope = 'table' | 'row' | 'column' | 'cell';

/** Reindex content and formatting together when inserting or deleting a row/column. */
export function editTableStructure(
  table: TableSettings,
  elements: ReportElement[],
  axis: 'row' | 'column',
  index: number,
  action: 'insert' | 'delete',
): TableSettings {
  const count = axis === 'row' ? table.rows : table.columns;
  if (action === 'delete' && count === 1) return table;
  const next = structuredClone(table);
  const map = (value: number) =>
    action === 'insert'
      ? value >= index
        ? value + 1
        : value
      : value === index
        ? -1
        : value > index
          ? value - 1
          : value;
  next[axis === 'row' ? 'rows' : 'columns'] += action === 'insert' ? 1 : -1;
  next.contents = {};
  for (const element of elements.filter((element) => element.type === 'text' && element.cell)) {
    const { row, column } = element.cell!;
    const r = axis === 'row' ? map(row) : row,
      c = axis === 'column' ? map(column) : column;
    if (r >= 0 && c >= 0)
      next.contents[`${r}:${c}`] = table.contents[`${row}:${column}`] ?? element.text;
  }
  if (action === 'insert')
    for (let r = 0; r < next.rows; r++)
      for (let c = 0; c < next.columns; c++)
        if ((axis === 'row' ? r : c) === index) next.contents[`${r}:${c}`] = '';
  next.styles = {};
  for (const [key, style] of Object.entries(table.styles)) {
    const parts = key.split(':');
    if (parts[0] === axis) parts[1] = String(map(Number(parts[1])));
    if (parts[0] === 'cell') {
      const position = axis === 'row' ? 1 : 2;
      parts[position] = String(map(Number(parts[position])));
    }
    if (!parts.includes('-1')) next.styles[parts.join(':')] = style;
  }
  if (axis === 'column') {
    const widths = table.columnWidths ?? Array(table.columns).fill(table.width / table.columns);
    next.columnWidths = [...widths];
    if (action === 'insert') next.columnWidths.splice(index, 0, table.width / next.columns);
    else next.columnWidths.splice(index, 1);
    const sum = next.columnWidths.reduce((a, b) => a + b, 0);
    next.columnWidths = next.columnWidths.map((value) => (value / sum) * table.width);
  }
  if (axis === 'row' && table.rowHeights) {
    next.rowHeights = [...table.rowHeights];
    if (action === 'insert') next.rowHeights.splice(index, 0, table.rowHeight);
    else next.rowHeights.splice(index, 1);
  }
  return next;
}

/** Adding/removing the header must never replace the first row's data or edits. */
export function setTableHeaders(
  table: TableSettings,
  elements: ReportElement[],
  fields: string[],
  enabled: boolean,
): TableSettings {
  if (enabled === table.headers) return table;
  if (enabled) {
    const result = editTableStructure(table, elements, 'row', 0, 'insert');
    result.headers = true;
    for (let column = 0; column < result.columns; column++) {
      // Prefer the field already bound to the first body cell over schema order.
      const body = result.contents[`1:${column}`] ?? '';
      const binding = /^\[([A-Za-z_][A-Za-z_0-9]*(?:\.[A-Za-z_][A-Za-z_0-9]*)?)\]$/.exec(body);
      result.contents[`0:${column}`] = binding ? binding[1].split('.').at(-1)! : (fields[column] ?? '');
    }
    return result;
  }
  if (table.rows > 1) {
    const result = editTableStructure(table, elements, 'row', 0, 'delete');
    result.headers = false;
    return result;
  }
  const result = structuredClone(table);
  result.headers = false;
  for (let column = 0; column < result.columns; column++)
    result.contents[`0:${column}`] = fields[column] ? `[${fields[column]}]` : '';
  return result;
}

export function clearTableContents(
  table: TableSettings,
  scope: TableScope,
  row: number,
  column: number,
): TableSettings {
  const contents = { ...table.contents };
  for (let r = 0; r < table.rows; r++)
    for (let c = 0; c < table.columns; c++)
      if (
        scope === 'table' ||
        (scope === 'row' && r === row) ||
        (scope === 'column' && c === column) ||
        (scope === 'cell' && r === row && c === column)
      )
        contents[`${r}:${c}`] = '';
  return { ...table, contents };
}
