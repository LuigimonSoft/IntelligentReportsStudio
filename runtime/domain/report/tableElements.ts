import { bandsOf, defaultTextStyle, makeElement, uid } from '@reportstudio/mini-reports';
import type {
  Dataset,
  ReportElement,
  TableSettings,
  TableCellStyle,
} from '@reportstudio/mini-reports';

export function createTable(
  dataset: Dataset,
  width: number,
  settings?: TableSettings,
  groupId = uid('table'),
): ReportElement[] {
  const table: TableSettings = settings ?? {
    dataset: dataset.id,
    rows: 2,
    columns: Math.min(6, Math.max(1, dataset.schema.fields.length)),
    headers: true,
    width,
    rowHeight: 0.34,
    styles: {},
    contents: {},
  };
  const elements: ReportElement[] = [];
  const widths =
    table.columnWidths?.length === table.columns
      ? table.columnWidths
      : Array(table.columns).fill(table.width / table.columns);
  const heights =
    table.rowHeights?.length === table.rows
      ? table.rowHeights
      : Array(table.rows).fill(table.rowHeight);
  for (let row = 0; row < table.rows; row++) {
    for (let column = 0; column < table.columns; column++) {
      const cellWidth = widths[column];
      const key = `${row}:${column}`;
      const field = dataset.schema.fields[column];
      const header = table.headers && row === 0;
      const appearance: TableCellStyle = {
        background: header ? '#e9eef5' : '#ffffff',
        color: '#243c34',
        align: 'left',
        borderColor: '#cbd5e1',
        borderWidth: 0.5,
        ...table.styles.table,
        ...table.styles[`column:${column}`],
        ...table.styles[`row:${row}`],
        ...table.styles[`cell:${key}`],
      };
      const common = {
        groupId,
        table,
        cell: { row, column },
        x: widths.slice(0, column).reduce((sum, width) => sum + width, 0),
        y: heights.slice(0, row).reduce((sum, height) => sum + height, 0),
      };
      elements.push(
        makeElement('box', {
          ...common,
          id: `${groupId}-${key}-background`,
          width: cellWidth,
          height: heights[row],
          borderColor: appearance.borderColor,
          borderWidth: appearance.borderWidth,
          style: { ...defaultTextStyle, color: appearance.background },
        }),
      );
      elements.push(
        makeElement('text', {
          ...common,
          id: `${groupId}-${key}-text`,
          x: common.x + 0.04,
          y: common.y + 0.03,
          width: Math.max(0.01, cellWidth - 0.08),
          height: Math.max(0.01, heights[row] - 0.06),
          text:
            table.contents[key] ?? (header ? (field?.name ?? '') : field ? `[${field.name}]` : ''),
          style: {
            ...defaultTextStyle,
            bold: appearance.bold ?? header,
            italic: appearance.italic ?? false,
            underline: appearance.underline ?? false,
            verticalAlign: appearance.verticalAlign ?? 'top',
            ...(appearance.fontFamily ? { fontFamily: appearance.fontFamily } : {}),
            fontsize: appearance.fontsize ?? defaultTextStyle.fontsize,
            align: appearance.align,
            color: appearance.color,
            format: appearance.format ?? (!header && field?.type === 'number' ? 'number' : 'text'),
          },
        }),
      );
    }
  }
  return elements;
}

/** Older grouped tables gain editable settings when their JSON is opened. */
export function upgradeTableGroups(project: import('@reportstudio/mini-reports').Project) {
  for (const band of bandsOf(project.report)) {
    const detail = project.report.details.find((detail) =>
      [detail.band.id, detail.groupHeader?.id, detail.groupFooter?.id].includes(band.id),
    );
    const dataset =
      project.datasets.find((dataset) => dataset.id === detail?.dataset) ?? project.datasets[0];
    if (!dataset) continue;
    const groups = new Set(
      band!.elements
        .filter((element) => element.groupId?.startsWith('table-') && !element.table)
        .map((element) => element.groupId!),
    );
    for (const group of groups) {
      const previous = band!.elements.filter((element) => element.groupId === group);
      const x = Math.min(...previous.map((element) => element.x)),
        y = Math.min(...previous.map((element) => element.y));
      const width = Math.max(...previous.map((element) => element.x + element.width)) - x;
      const defaults = createTable(dataset, width, undefined, group)[0].table!;
      const contents: Record<string, string> = {};
      for (const element of previous.filter((element) => element.type === 'text')) {
        const column = Math.max(
          0,
          Math.min(defaults.columns - 1, Math.floor((element.x - x) / (width / defaults.columns))),
        );
        const row = element.y - y >= 0.3 ? 1 : 0;
        const content = element.text.replace(/^\{([^{}]+)\}$/, '[$1]');
        const field = dataset.schema.fields[column];
        const expected = row === 0 ? (field?.name ?? '') : field ? `[${field.name}]` : '';
        if (content !== expected) contents[`${row}:${column}`] = content;
      }
      const cells = createTable(dataset, width, { ...defaults, contents }, group).map(
        (element) => ({
          ...element,
          x: element.x + x,
          y: element.y + y,
        }),
      );
      band!.elements = [...band!.elements.filter((element) => element.groupId !== group), ...cells];
      band!.height = Math.max(band!.height, y + 0.68);
    }
  }
  return project;
}
