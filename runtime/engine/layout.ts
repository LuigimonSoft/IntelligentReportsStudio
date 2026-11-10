import { chartPoints } from './charts.ts';
import { tableBackground } from './tableAppearance.ts';
import { sectionAppearance } from './sectionAppearance.ts';
import { makeElement, defaultTextStyle } from './types.ts';
import { renderText } from './expressions.ts';
import { validateProject } from './validation.ts';
import type {
  Band,
  DataRow,
  Dataset,
  ExpressionContext,
  LayoutElement,
  LayoutPage,
  MeasureText,
  ReportDefinition,
  ReportLayout,
  TextStyle,
} from './types.ts';

export const approximateMeasure: MeasureText = (text, style) =>
  (text.length * style.fontsize * 0.52) / 72;
export const lineHeight = (style: TextStyle): number => (style.fontsize * 1.25) / 72;

/** Wrapping is shared between DOM preview and PDF via an injected font measurer. */
export function wrapText(
  text: string,
  width: number,
  style: TextStyle,
  measure: MeasureText,
): string[] {
  if (!style.wrap) return text.split('\n');
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (!paragraph) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of paragraph.split(/\s+/)) {
      if (measure(current ? `${current} ${word}` : word, style) <= width) {
        current = current ? `${current} ${word}` : word;
        continue;
      }
      if (current) {
        lines.push(current);
        current = '';
      }
      if (measure(word, style) <= width) {
        current = word;
        continue;
      }
      for (const character of Array.from(word)) {
        if (current && measure(current + character, style) > width) {
          lines.push(current);
          current = '';
        }
        current += character;
      }
    }
    lines.push(current);
  }
  return lines;
}
type Block = {
  band: Band;
  context: ExpressionContext;
  height: number;
  ownHeight: number;
  children: Block[];
  visible: boolean;
  background?: string;
};
type Placement = { block: Block; y: number };

export function compileReport(
  reportInput: ReportDefinition,
  datasetsInput: Dataset[],
  options: { now?: Date; measureText?: MeasureText; sectionHeights?: Record<string, number>; parameters?: ExpressionContext['parameters'] } = {},
): ReportLayout {
  const { report, datasets } = validateProject({
    version: 1,
    report: reportInput,
    datasets: datasetsInput,
  });
  const now = options.now ?? new Date();
  const measure = options.measureText ?? approximateMeasure;
  const aggregateRows = datasets.find((ds) => ds.id === report.details.at(-1)?.dataset)?.data ?? [];
  const context = (
    row: DataRow = {},
    rows = aggregateRows,
    dataset?: string,
    rowNumber = 1,
  ): ExpressionContext => ({
    row,
    rows,
    formulas: report.formulas,
    parameters: options.parameters,
    rowNumber,
    rowCount: datasets.find((source) => source.id === dataset)?.data.length ?? rows.length,
    sources: Object.fromEntries(
      datasets.map((table) => [table.id, table.id === dataset ? row : (table.data[0] ?? {})]),
    ),
    dataset: dataset ?? report.details.at(-1)?.dataset,
    now,
  });
  const sectionLayout = options.sectionHeights !== undefined;
  const detailIds = new Set(report.details.map(detail => detail.band.id));
  // Messages are literal user text, not field or formula expressions.
  const literalTextIds = new Set<string>();
  const elementText = (element: import('./types.ts').ReportElement, ctx: ExpressionContext) =>
    literalTextIds.has(element.id) ? element.text : renderText(element.text, ctx, report, element.style);
  function block(band: Band, ctx = context()): Block {
    band = { ...band, elements: band.elements.filter(element => element.visible !== false) };
    // Page-dependent rules reserve their area during pagination and resolve on each page.
    const pageRule = (source?: string, visited = new Set<string>()): boolean => {
      if (/\bPAGE_(NUMBER|COUNT)\b/.test(source ?? '')) return true;
      return (report.formulas ?? []).some((formula) => {
        if (visited.has(formula.name) || !new RegExp(`\\b${formula.name}\\b`).test(source ?? ''))
          return false;
        return pageRule(formula.expression, new Set([...visited, formula.name]));
      });
    };
    const appearance = sectionAppearance(
      {
        ...band,
        visibilityExpression: pageRule(band.visibilityExpression)
          ? undefined
          : band.visibilityExpression,
        backgroundExpression: pageRule(band.backgroundExpression)
          ? undefined
          : band.backgroundExpression,
      },
      ctx,
    );
    if (!appearance.visible)
      return { band, context: ctx, height: 0, ownHeight: 0, children: [], visible: false };
    // Expand every cell in a row together when its data needs more lines.
    const tables = new Map<string, { top: number; heights: number[] }>();
    for (const element of band.elements) {
      if (!element.groupId || !element.table || !element.cell) continue;
      if (!tables.has(element.groupId)) {
        const members = band.elements.filter((member) => member.groupId === element.groupId);
        tables.set(element.groupId, {
          top: Math.min(...members.map((member) => member.y)),
          heights: element.table.rowHeights
            ? [...element.table.rowHeights]
            : Array(element.table.rows).fill(element.table.rowHeight),
        });
      }
      if (element.type === 'text') {
        const row = tables.get(element.groupId)!;
        const needed =
          wrapText(
            renderText(element.text, ctx, report, element.style),
            element.width,
            element.style,
            measure,
          ).length *
            lineHeight(element.style) +
          0.06;
        row.heights[element.cell.row] = Math.max(row.heights[element.cell.row], needed);
      }
    }
    if (tables.size)
      band = {
        ...band,
        elements: band.elements.map((element) => {
          const table = element.groupId ? tables.get(element.groupId) : undefined;
          if (!table || !element.cell) return element;
          const text = element.type === 'text';
          return {
            ...element,
            y:
              table.top +
              table.heights.slice(0, element.cell.row).reduce((sum, height) => sum + height, 0) +
              (text ? 0.03 : 0),
            height: table.heights[element.cell.row] - (text ? 0.06 : 0),
          };
        }),
      };

    // A table detail repeats its actual cell area, without synthetic row spacing.
    const tableOnly =
      band.elements.length > 0 && band.elements.every((element) => element.table && element.cell);
    const tableDetail = tableOnly && report.details.some((detail) => detail.band.id === band.id);
    const compactRow = sectionLayout && detailIds.has(band.id);
    if (compactRow && tableDetail && (ctx.rowNumber ?? 1) > 1) {
      const leadingSpace = Math.min(...band.elements.map((element) => element.y));
      if (leadingSpace > 0)
        band = {
          ...band,
          elements: band.elements.map((element) => ({
            ...element,
            y: element.y - leadingSpace,
          })),
        };
    }
    let height = compactRow ? 0.15 : (options.sectionHeights?.[band.id] ?? band.height);
    for (const el of band.elements) {
      let elementHeight = el.height;
      if (el.type === 'text') {
        const text = elementText(el, ctx);
        const lines = wrapText(text, el.width, el.style, measure);
        elementHeight = Math.max(el.height, lines.length * lineHeight(el.style));
      }
      height = Math.max(height, el.y + elementHeight + (compactRow && !tables.size ? 0.05 : 0));
    }
    const children = (band.sections ?? []).map((child) => block(child, ctx));
    return {
      band,
      context: ctx,
      ownHeight: height,
      height: height + children.reduce((sum, child) => sum + child.height, 0),
      children,
      ...appearance,
    };
  }
  const margin = report.page.margins;
  const pageHeader = report.pageHeader ? block(report.pageHeader) : undefined;
  function compactPageFooter(item: Block): Block {
    if (!sectionLayout || !item.visible || item.band.background || item.band.backgroundExpression)
      return item;
    // Empty space above a bottom-anchored footer is available to growing detail rows.
    // Shift its local coordinates by the same amount as its origin, keeping every
    // printed footer element at its designed absolute position on the page.
    const leadingSpace = item.band.elements.length
      ? Math.min(item.ownHeight, ...item.band.elements.map((element) => element.y))
      : item.ownHeight;
    if (leadingSpace <= 0) return item;
    return {
      ...item,
      ownHeight: item.ownHeight - leadingSpace,
      height: item.height - leadingSpace,
      band: {
        ...item.band,
        elements: item.band.elements.map((element) => ({
          ...element,
          y: element.y - leadingSpace,
        })),
      },
    };
  }
  const pageFooter = report.pageFooter ? compactPageFooter(block(report.pageFooter)) : undefined;
  const topMargin = margin.top;
  const bottomMargin = margin.bottom;
  const reportFooter = report.footer ? block(report.footer) : undefined;
  const startY = topMargin + (pageHeader?.height ?? 0);
  const footerY =
    report.page.height -
    bottomMargin -
    (pageFooter?.height ?? 0);
  const endY = footerY;
  const capacity = endY - startY;
  if (capacity < 0.25) throw new Error('Headers and footers leave no room for data.');
  const placements: Placement[][] = [[]];
  let y = startY;
  const current = () => placements[placements.length - 1];
  function newPage() {
    if (placements.length >= 500) throw new Error('The report exceeds 500 pages.');
    placements.push([]);
    y = startY;
  }
  function append(item: Block, repeat?: Block | Block[]) {
    const repeated = repeat ? (Array.isArray(repeat) ? repeat : [repeat]) : [];
    const repeatHeight = repeated.reduce((sum, header) => sum + header.height, 0);
    if (item.height > capacity + 1e-8 || item.height + repeatHeight > capacity + 1e-8)
      throw new Error(
        `Section ${item.band.name} is too tall for a page. Reduce its height or text.`,
      );
    // Carry freshly placed group headers with their first row instead of leaving
    // an orphaned header on the previous page when a manual break is requested.
    let forceBreak = false;
    if (item.visible && item.height > 1e-8 && item.band.pageBreakBefore) {
      let carry = 0;
      while (carry < repeated.length && carry < current().length &&
        current()[current().length - 1 - carry].block === repeated[repeated.length - 1 - carry]) carry++;
      const beforeHeaders = current().slice(0, current().length - carry);
      forceBreak = beforeHeaders.some(placement => placement.block.visible && placement.block.height > 1e-8);
      if (forceBreak && carry) current().splice(current().length - carry, carry);
    }
    if (forceBreak || y + item.height > endY + 1e-8) {
      newPage();
      for (const header of repeated) {
        current().push({ block: header, y });
        y += header.height;
      }
    }
    current().push({ block: item, y });
    y += item.height;
  }
  if (report.header) {
    const header = block(report.header);
    if (sectionLayout) {
      if (header.height > capacity) throw new Error('The report header is too tall for a page.');
      current().push({ block: header, y: topMargin });
      y += header.height;
    } else append(header);
  }
  for (const detail of report.details) {
    // Unbound sections render their static design once, with no placeholder dataset.
    const rows = detail.dataset ? datasets.find((ds) => ds.id === detail.dataset)!.data : [{}];
    if (detail.dataset && rows.length === 0 && detail.emptyMessage?.trim()) {
      const ctx = context({}, rows, detail.dataset);
      const header = detail.groupHeader ? block(detail.groupHeader, ctx) : undefined;
      if (header) append(header);
      const text = makeElement('text', {
        text: detail.emptyMessage,
        x: 0, y: 0, width: report.page.width - margin.left - margin.right, height: 0.2,
        style: { ...defaultTextStyle, wrap: true },
      });
      literalTextIds.add(text.id);
      const emptyBand = { ...detail.band, elements: [text], sections: [] };
      append(block(emptyBand, ctx), header);
      if (detail.groupFooter) append(block(detail.groupFooter, ctx));
      continue;
    }
    if (detail.groups?.length) {
      const ctx = context(rows[0] ?? {}, rows, detail.dataset);
      const legacy = detail.groupBy ? [{ field: detail.groupBy, direction: detail.sortDirection ?? 'asc', header: detail.groupHeader, footer: detail.groupFooter }] : [];
      const groups = [...legacy, ...detail.groups];
      const globalHeader = !detail.groupBy && detail.groupHeader ? block(detail.groupHeader, ctx) : undefined;
      if (globalHeader) append(globalHeader);
      let rowNumber = 0;
      const groupRows = (grouped: typeof rows, level: number, ancestors: Block[]) => {
        if (level === groups.length) {
          for (const row of grouped) append(block(detail.band, context(row, grouped, detail.dataset, ++rowNumber)), ancestors);
          return;
        }
        const definition = groups[level];
        const buckets = new Map<string, typeof rows>();
        for (const row of grouped) { const key = JSON.stringify(row[definition.field] ?? null); const bucket = buckets.get(key) ?? []; bucket.push(row); buckets.set(key, bucket); }
        const entries = [...buckets.values()].sort((a,b) => {
          const left = a[0][definition.field], right = b[0][definition.field];
          const order = typeof left === 'number' && typeof right === 'number' ? left-right : String(left ?? '').localeCompare(String(right ?? ''), report.locale);
          return order * (definition.direction === 'desc' ? -1 : 1);
        });
        for (const values of entries) {
          const groupContext = context(values[0], values, detail.dataset);
          const header = definition.header ? block(definition.header, groupContext) : undefined;
          if (header) {
            const first = block(detail.band, context(values[0], values, detail.dataset));
            const needed = ancestors.reduce((sum, item) => sum + item.height, 0) + header.height + first.height;
            if (needed > capacity + 1e-8) throw new Error('The group header and its first row do not fit on a page.');
            if (y + header.height + first.height > endY + 1e-8) {
              newPage();
              for (const ancestor of ancestors) { current().push({ block:ancestor, y }); y += ancestor.height; }
            }
            append(header, ancestors);
          }
          const headers = header ? [...ancestors, header] : ancestors;
          groupRows(values, level + 1, headers);
          if (definition.footer) append(block(definition.footer, groupContext), headers);
        }
      };
      groupRows(rows, 0, globalHeader ? [globalHeader] : []);
      if (!detail.groupBy && detail.groupFooter) append(block(detail.groupFooter, ctx));
      continue;
    }
    if (!detail.groupBy) {
      const ctx = context(rows[0] ?? {}, rows, detail.dataset);
      const header = detail.groupHeader ? block(detail.groupHeader, ctx) : undefined;
      if (header) append(header);
      for (const [index, row] of rows.entries())
        append(block(detail.band, context(row, rows, detail.dataset, index + 1)), header);
      if (detail.groupFooter) append(block(detail.groupFooter, ctx));
      continue;
    }
    const groups = new Map<string, DataRow[]>();
    for (const row of rows) {
      const key = JSON.stringify(row[detail.groupBy] ?? '');
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }
    const entries = [...groups.entries()].sort((a, b) => {
      const av = a[1][0][detail.groupBy!];
      const bv = b[1][0][detail.groupBy!];
      const result =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av ?? '').localeCompare(String(bv ?? ''), report.locale);
      return result * (detail.sortDirection === 'desc' ? -1 : 1);
    });
    let rowNumber = 0;
    for (const [, groupRows] of entries) {
      const firstContext = context(groupRows[0], groupRows, detail.dataset);
      const header = detail.groupHeader ? block(detail.groupHeader, firstContext) : undefined;
      if (header) {
        const first = block(detail.band, firstContext);
        if (header.height + first.height > capacity + 1e-8)
          throw new Error('The group header and its first row do not fit on a page.');
        if (y + header.height + first.height > endY + 1e-8) newPage();
        append(header);
      }
      for (const row of groupRows)
        append(block(detail.band, context(row, groupRows, detail.dataset, ++rowNumber)), header);
      if (detail.groupFooter) append(block(detail.groupFooter, firstContext));
    }
  }
  if (reportFooter) {
    if (sectionLayout && reportFooter.visible && reportFooter.height > 1e-8 &&
      reportFooter.band.pageBreakBefore && current().some(placement => placement.block.visible && placement.block.height > 1e-8)) newPage();
    if (sectionLayout && reportFooter.height > capacity + 1e-8)
      throw new Error('The report footer is too tall for a page.');
    if (sectionLayout && y + reportFooter.height > endY + 1e-8) newPage();
    if (sectionLayout)
      current().push({
        block: reportFooter,
        y: report.page.height - bottomMargin - reportFooter.height,
      });
    else append(reportFooter);
  }
  const pageCount = placements.length;
  function renderPlacement(placement: Placement, pageNumber: number): LayoutElement[] {
    const { block, y } = placement;
    if (!block.visible) return [];
    const ctx = { ...block.context, pageNumber, pageCount };
    const appearance = sectionAppearance(block.band, ctx);
    if (!appearance.visible) return [];
    const elements = block.band.elements.map((el) => {
      const text = el.type === 'text' ? elementText(el, ctx) : '';
      const lines = el.type === 'text' ? wrapText(text, el.width, el.style, measure) : [];
      // Page counters are resolved after pagination; reject reflow instead of clipping content.
      if (
        el.type === 'text' &&
        el.y + Math.max(el.height, lines.length * lineHeight(el.style)) > block.ownHeight + 1e-8
      )
        throw new Error('The page counter needs more space. Increase its section height.');
      return {
        ...el,
        style:
          el.type === 'box' && el.table
            ? { ...el.style, color: tableBackground(el, ctx) }
            : el.style,
        x: margin.left + el.x,
        y: y + el.y,
        text,
        height: Math.max(el.height, lines.length * lineHeight(el.style)),
        lines,
        bandId: block.band.id,
        chartData: el.type === 'chart' && el.chart ? chartPoints(el.chart, datasets) : undefined,
      };
    });
    const background: LayoutElement[] = appearance.background
      ? [
          {
            ...makeElement('box', {
              id: `${block.band.id}-background`,
              x: 0,
              y,
              width: report.page.width,
              height: block.height,
              style: { ...defaultTextStyle, color: appearance.background },
            }),
            bandId: block.band.id,
            lines: [],
          },
        ]
      : [];
    let childY = y + block.ownHeight;
    const children = block.children.flatMap((child) => {
      const result = renderPlacement({ block: child, y: childY }, pageNumber);
      childY += child.height;
      return result;
    });
    return [...background, ...elements, ...children];
  }
  const pages: LayoutPage[] = placements.map((items, index) => {
    const pageNumber = index + 1;
    const fixed = [
      ...(pageHeader
        ? [
            {
              block: pageHeader,
              y:
                topMargin +
                (sectionLayout && index === 0 && report.header ? block(report.header).height : 0),
            },
          ]
        : []),
      ...(pageFooter
        ? [
            {
              block: pageFooter,
              y:
                report.page.height -
                bottomMargin -
                pageFooter.height -
                (sectionLayout && index === placements.length - 1
                  ? (reportFooter?.height ?? 0)
                  : 0),
            },
          ]
        : []),
    ];
    return {
      number: pageNumber,
      elements: [...items, ...fixed].flatMap((item) => renderPlacement(item, pageNumber)),
    };
  });
  return { width: report.page.width, height: report.page.height, background: report.page.background, margins: { ...margin }, title: report.title, pages };
}
