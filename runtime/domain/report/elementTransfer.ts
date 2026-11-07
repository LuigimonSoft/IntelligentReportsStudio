import {
  bandsOf,
  sectionDetail,
  uid,
  validateReport,
  type Dataset,
  type ReportDefinition,
  type ReportElement,
} from '@reportstudio/mini-reports';

export const REPORT_CLIPBOARD_MIME = 'application/x-reportstudio-elements';
export type ElementBundle = {
  kind: 'reportstudio-elements';
  version: 1;
  elements: ReportElement[];
  selectedElementId: string;
  sourceDataset?: string;
  fields: string[];
  multiple?: boolean;
  position?: { x: number; y: number };
  origins?: { id: string; bandId: string }[];
};
export function elementBounds(elements: ReportElement[]) {
  const x = Math.min(...elements.map((element) => element.x));
  const y = Math.min(...elements.map((element) => element.y));
  return {
    x,
    y,
    width: Math.max(...elements.map((element) => element.x + element.width)) - x,
    height: Math.max(...elements.map((element) => element.y + element.height)) - y,
  };
}
export function captureElements(
  report: ReportDefinition,
  datasets: Dataset[],
  bandId: string,
  elementId: string,
): ElementBundle | undefined {
  const band = bandsOf(report).find((band) => band.id === bandId);
  const selected = band?.elements.find((element) => element.id === elementId);
  if (!band || !selected) return;
  const dataset = selected.table?.dataset ?? sectionDetail(report, bandId)?.dataset;
  return {
    kind: 'reportstudio-elements',
    version: 1,
    selectedElementId: elementId,
    elements: structuredClone(
      selected.groupId
        ? band.elements.filter((element) => element.groupId === selected.groupId)
        : [selected],
    ),
    sourceDataset: dataset,
    fields:
      datasets.find((table) => table.id === dataset)?.schema.fields.map((field) => field.name) ??
      [],
  };
}
export type ElementReference = { bandId: string; elementId: string };
/** Capture a selection once, expanding complete tables and preserving source bindings. */
export function captureSelectionElements(
  report: ReportDefinition,
  datasets: Dataset[],
  selection: ElementReference[],
): ElementBundle | undefined {
  if (selection.length === 1)
    return captureElements(report, datasets, selection[0].bandId, selection[0].elementId);
  if (!selection.length) return;
  const bands = bandsOf(report);
  const tops = new Map<string, number>();
  let top = 0;
  for (const band of bands) {
    tops.set(band.id, top);
    top += band.height;
  }
  const elements: ReportElement[] = [];
  const origins: { id: string; bandId: string }[] = [];
  const ids = new Set<string>();
  for (const reference of selection) {
    const bundle = captureElements(report, datasets, reference.bandId, reference.elementId);
    if (!bundle) continue;
    for (const element of bundle.elements) {
      if (ids.has(element.id)) continue;
      ids.add(element.id);
      element.y += tops.get(reference.bandId) ?? 0;
      if (bundle.sourceDataset)
        element.text = qualifyText(element.text, bundle.sourceDataset, new Set(bundle.fields));
      elements.push(element);
      origins.push({ id: element.id, bandId: reference.bandId });
    }
  }
  if (!elements.length) return;
  return {
    kind: 'reportstudio-elements',
    version: 1,
    elements,
    origins,
    multiple: true,
    position: {
      x: elementBounds(elements).x,
      y: Math.max(0, elementBounds(elements).y - (tops.get(selection[0].bandId) ?? 0)),
    },
    selectedElementId:
      elements.find((element) => element.id === selection[0].elementId)?.id ?? elements[0].id,
    fields: [],
  };
}

export function parseElementBundle(text: string): ElementBundle {
  if (text.length > 10_000_000) throw new Error('The clipboard exceeds 10 MB.');
  const value = JSON.parse(text) as ElementBundle;
  if (
    !value ||
    value.kind !== 'reportstudio-elements' ||
    value.version !== 1 ||
    !Array.isArray(value.elements) ||
    !value.elements.length ||
    value.elements.length > 200 ||
    !value.elements.every(
      (element) => element && typeof element === 'object' && typeof element.id === 'string',
    ) ||
    !value.elements.some((element) => element.id === value.selectedElementId) ||
    (value.multiple !== undefined && typeof value.multiple !== 'boolean') ||
    (value.position !== undefined &&
      (!value.position ||
        !Number.isFinite(value.position.x) ||
        !Number.isFinite(value.position.y))) ||
    (value.origins !== undefined &&
      (!Array.isArray(value.origins) ||
        value.origins.length > 200 ||
        !value.origins.every(
          (origin) => origin && typeof origin.id === 'string' && typeof origin.bandId === 'string',
        ))) ||
    !Array.isArray(value.fields) ||
    value.fields.length > 100 ||
    !value.fields.every(
      (field) => typeof field === 'string' && /^[A-Za-z_][A-Za-z_0-9]*$/.test(field),
    ) ||
    (value.sourceDataset !== undefined &&
      (typeof value.sourceDataset !== 'string' || value.sourceDataset.length > 100))
  )
    throw new Error('The clipboard does not contain report elements.');
  return value;
}
/** Qualify identifiers inside formulas, leaving string literals and already qualified fields intact. */
function qualifyText(text: string, dataset: string, fields: Set<string>): string {
  return text.replace(
    /\[([^\[\]]+)\]/g,
    (_, expression: string) =>
      '[' +
      expression.replace(
        /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|[A-Za-z_][A-Za-z_0-9]*(?:\.[A-Za-z_][A-Za-z_0-9]*)?/g,
        (token: string, offset: number, expression: string) =>
          fields.has(token) &&
          !/^\s*\(/.test(expression.slice(offset + token.length)) &&
          ![
            'TRUE',
            'FALSE',
            'NULL',
            'AND',
            'OR',
            'NOT',
            'PAGE_NUMBER',
            'PAGE_COUNT',
            'ROW_NUMBER',
            'ROW_COUNT',
            'TABLE_ROW_NUMBER',
            'COLUMN_NUMBER',
            'IS_ODD_ROW',
          ].includes(token.toUpperCase())
            ? /^[A-Za-z_]\w*$/.test(dataset)
              ? `${dataset}.${token}`
              : `FIELD(${JSON.stringify(dataset)}, ${JSON.stringify(token)})`
            : token,
      ) +
      ']',
  );
}
export function placeElements(
  report: ReportDefinition,
  bundle: ElementBundle,
  targetBandId: string,
  position: { x: number; y: number },
  copy = true,
  sourceBandId?: string,
) {
  const candidate = structuredClone(report);
  const target = bandsOf(candidate).find((band) => band.id === targetBandId);
  if (!target) throw new Error('The destination section no longer exists.');
  if (!copy) {
    const origins =
      bundle.origins ??
      bundle.elements.map((element) => ({ id: element.id, bandId: sourceBandId! }));
    for (const origin of origins) {
      const source = bandsOf(candidate).find((band) => band.id === origin.bandId);
      if (!source?.elements.some((element) => element.id === origin.id))
        throw new Error('The source element no longer exists.');
    }
    const ids = new Set(origins.map((origin) => origin.id));
    for (const band of bandsOf(candidate))
      band.elements = band.elements.filter((element) => !ids.has(element.id));
  }
  const bounds = elementBounds(bundle.elements);
  const width = candidate.page.width - candidate.page.margins.left - candidate.page.margins.right;
  if (
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width > width + 0.001 ||
    bounds.height > 29.92
  )
    throw new Error('The elements do not fit in the destination section.');
  const left = Math.max(0, Math.min(position.x, width - bounds.width));
  const top = Math.max(0, Math.min(position.y, 30 - bounds.height - 0.08));
  const targetDataset = sectionDetail(candidate, targetBandId)?.dataset;
  const qualify = bundle.sourceDataset && bundle.sourceDataset !== targetDataset;
  const fields = new Set(bundle.fields);
  const groups = new Map<string, string>();
  let selectedElementId = '';
  const elements = bundle.elements.map((element) => {
    const clone = structuredClone(element);
    if (copy) {
      clone.id = uid('el');
      if (clone.groupId) {
        if (!groups.has(clone.groupId)) groups.set(clone.groupId, uid('table'));
        clone.groupId = groups.get(clone.groupId);
      }
    }
    if (element.id === bundle.selectedElementId) selectedElementId = clone.id;
    clone.x = left + element.x - bounds.x;
    clone.y = top + element.y - bounds.y;
    if (qualify) {
      clone.text = qualifyText(clone.text, bundle.sourceDataset!, fields);
      if (clone.table && clone.cell && clone.type === 'text')
        clone.table.contents[`${clone.cell.row}:${clone.cell.column}`] = clone.text;
    }
    return clone;
  });
  // Every table element stores the same configuration, including qualified cell content.
  for (const group of new Set(
    elements
      .filter((element) => element.table && element.groupId)
      .map((element) => element.groupId!),
  )) {
    const cells = elements.filter((element) => element.groupId === group);
    const contents = structuredClone(cells.find((element) => element.table)?.table?.contents ?? {});
    for (const element of cells) {
      if (element.type === 'text' && element.cell)
        contents[`${element.cell.row}:${element.cell.column}`] = element.text;
    }
    cells.forEach((element) => {
      if (element.table) element.table.contents = { ...contents };
    });
  }
  target.elements.push(...elements);
  target.height = Math.max(target.height, top + bounds.height + 0.08);
  return {
    report: validateReport(candidate),
    selection: {
      bandId: targetBandId,
      elementId: selectedElementId,
      elements: bundle.multiple
        ? elements.map((element) => ({ bandId: targetBandId, elementId: element.id }))
        : undefined,
    },
  };
}
