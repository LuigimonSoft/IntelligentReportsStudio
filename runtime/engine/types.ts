export type DataRow = Record<string, string | number | boolean | null>;
export type Field = {
  name: string;
  type: 'text' | 'number' | 'boolean';
  sqlType?: import('./sqlTypes.ts').SqlType;
};
export type Dataset = { id: string; name: string; data: DataRow[]; schema: { fields: Field[] } };
export type FontFamily =
  | 'sans-serif'
  | 'serif'
  | 'monospace'
  | 'verdana'
  | 'tahoma'
  | 'trebuchet'
  | 'georgia'
  | 'palatino'
  | 'garamond'
  | 'segoe'
  | 'system'
  | 'consolas';
export type TextStyle = {
  fontFamily?: FontFamily;
  fontsize: number;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  color: string;
  wrap: boolean;
  format: 'text' | 'number' | 'currency';
};
export type ShapeKind = 'circle' | 'triangle' | 'diamond' | 'rectangle';
export type TableCellStyle = {
  fontFamily?: FontFamily;
  background: string;
  backgroundExpression?: string;
  color: string;
  align: TextStyle['align'];
  borderColor: string;
  borderWidth: number;
  format?: TextStyle['format'];
  bold?: boolean;
  italic?: boolean;
  fontsize?: number;
};
export type TableSettings = {
  dataset: string;
  rows: number;
  columns: number;
  headers: boolean;
  width: number;
  rowHeight: number;
  columnWidths?: number[];
  rowHeights?: number[];
  styles: Record<string, Partial<TableCellStyle>>;
  contents: Record<string, string>;
};
export type ChartKind = 'column' | 'bar' | 'line' | 'area' | 'pie' | 'donut';
export type ChartSettings = {
  kind: ChartKind;
  dataset: string;
  category: string;
  value: string;
  aggregation: 'sum' | 'average' | 'count' | 'min' | 'max';
  sort: 'source' | 'ascending' | 'descending';
  limit: number;
  title: string;
  color: string;
  categoryColors?: Record<string, string>;
  background: string;
  showLegend: boolean;
  showLabels: boolean;
  showGrid: boolean;
};
export type ChartPoint = { label: string; value: number };
export type ReportElement = {
  id: string;
  type: 'text' | 'image' | 'line' | 'box' | 'shape' | 'chart';
  shape?: ShapeKind;
  chart?: ChartSettings;
  borderColor?: string;
  borderWidth?: number;
  /** Elements sharing this ID move together as one table. */
  groupId?: string;
  table?: TableSettings;
  cell?: { row: number; column: number };
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  src: string;
  style: TextStyle;
};
export type Band = {
  id: string;
  name: string;
  height: number;
  elements: ReportElement[];
  sections?: Band[];
  visible?: boolean;
  readOnly?: boolean;
  visibilityExpression?: string;
  background?: string;
  backgroundExpression?: string;
};
export type DetailGroup = { id: string; field: string; direction: 'asc' | 'desc'; header: Band; footer: Band };
export type DetailSection = {
  id: string;
  dataset: string;
  band: Band;
  groups?: DetailGroup[];
  groupBy?: string;
  sortDirection?: 'asc' | 'desc';
  groupHeader?: Band;
  groupFooter?: Band;
};
export type ReportFormula = { name: string; expression: string };
export type ReportDefinition = {
  formulas?: ReportFormula[];
  version: 1;
  id: string;
  title: string;
  page: {
    width: number;
    height: number;
    margins: { top: number; right: number; bottom: number; left: number };
  };
  locale: string;
  currency: string;
  header?: Band;
  footer?: Band;
  pageHeader?: Band;
  pageFooter?: Band;
  details: DetailSection[];
};
export type ExpressionContext = {
  formulas?: ReportFormula[];
  formulaStack?: string[];
  row: DataRow;
  rows: DataRow[];
  now: Date;
  sources?: Record<string, DataRow>;
  dataset?: string;
  rowNumber?: number;
  rowCount?: number;
  tableRowNumber?: number;
  columnNumber?: number;
  pageNumber?: number;
  pageCount?: number;
};
export type MeasureText = (text: string, style: TextStyle) => number;
export type LayoutElement = ReportElement & {
  lines: string[];
  bandId: string;
  chartData?: ChartPoint[];
};
export type LayoutPage = { number: number; elements: LayoutElement[] };
export type ReportLayout = { width: number; height: number; margins?: { top: number; right: number; bottom: number; left: number }; title: string; pages: LayoutPage[] };
export type TableRelation = {
  id: string;
  from: { dataset: string; field: string };
  to: { dataset: string; field: string };
  cardinality: '1:1' | '1:n' | 'n:1' | 'n:n';
};
export type PreviewParameter = {
  id: string;
  label: string;
  type: 'date' | 'select' | 'text' | 'number' | 'boolean';
  dataset: string;
  field: string;
  operator: 'gte' | 'lte' | 'eq' | 'contains';
  defaultValue?: string;
  value?: string;
  saveValue?: boolean;
  required?: boolean;
};
export type DataModelSettings = {
  rootDataset?: string;
  tables: Record<
    string,
    { x?: number; y?: number; alias?: string; color?: string; hiddenFields?: string[] }
  >;
};
export type Project = {
  version: 1;
  report: ReportDefinition;
  datasets: Dataset[];
  relations?: TableRelation[];
  dataModel?: DataModelSettings;
  dataSource?: { name: string };
  parameters?: PreviewParameter[];
};

export const defaultTextStyle: TextStyle = {
  fontsize: 10,
  bold: false,
  italic: false,
  align: 'left',
  color: '#243c34',
  wrap: true,
  format: 'text',
};
export function uid(prefix = 'id'): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}
export function makeBand(name: string, height: number): Band {
  return { id: uid('band'), name, height, elements: [] };
}
export function makeElement(
  type: ReportElement['type'],
  props: Partial<ReportElement> = {},
): ReportElement {
  return {
    id: uid('el'),
    type,
    x: 0,
    y: 0,
    width: 2,
    height: 0.3,
    text: 'Text',
    src: '',
    ...props,
    style: { ...defaultTextStyle, ...props.style },
  };
}
/** Root sections define repetition; child sections inherit the parent record and group. */
export function rootBandsOf(report: ReportDefinition): Band[] {
  return [
    report.header,
    report.pageHeader,
    ...report.details.flatMap((d) => [d.groupHeader, ...(d.groups ?? []).map(g => g.header), d.band, ...(d.groups ?? []).slice().reverse().map(g => g.footer), d.groupFooter]),
    report.pageFooter,
    report.footer,
  ].filter((band): band is Band => Boolean(band));
}
export function bandsOf(report: ReportDefinition): Band[] {
  const flatten = (band: Band): Band[] => [band, ...(band.sections ?? []).flatMap(flatten)];
  return rootBandsOf(report).flatMap(flatten);
}
export function sectionDepth(report: ReportDefinition, id: string): number {
  const search = (bands: Band[], depth: number): number | undefined => {
    for (const band of bands) {
      if (band.id === id) return depth;
      const result = search(band.sections ?? [], depth + 1);
      if (result !== undefined) return result;
    }
    return undefined;
  };
  return search(rootBandsOf(report), 0) ?? 0;
}
export function sectionDetail(report: ReportDefinition, bandId: string): DetailSection | undefined {
  const contains = (band: Band | undefined): boolean =>
    Boolean(band && (band.id === bandId || (band.sections ?? []).some(contains)));
  return report.details.find((d) => [d.band, d.groupHeader, d.groupFooter, ...(d.groups ?? []).flatMap(g => [g.header, g.footer])].some(contains));
}
