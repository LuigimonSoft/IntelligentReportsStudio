import { importTables } from "./tabs/data/model/importTables.ts";
import { tableDefinition } from "./tabs/data/model/tableDefinition.ts";
import { relationshipPreview } from "./tabs/data/model/relationshipPreview.ts";
import { queryRecords } from "./tabs/data/records/recordsQuery.ts";
import {
  bandsOf,
  makeElement,
  makeBand,
  uid,
  approximateMeasure,
  validateProject,
  ensureDefaultSections,
  sectionDetail,
  isDefaultSection,
  compileReport,
  joinRelatedRows,
  chartPoints,
} from "./engine/index.ts";
import type {
  Project,
  ReportElement,
  Band,
  TableSettings,
} from "./engine/types.ts";
import {
  createTable,
  createShape,
  createChart,
  createSubreport,
} from "./domain/report/reportTools.ts";
import { createBlankProject } from "./domain/report/blankProject.ts";
import { reorderElements } from "./domain/report/elementOrder.ts";
import {
  isSectionReadOnly,
  canEditProject,
} from "./domain/report/readOnlySections.ts";
import {
  sectionHeights,
  resizeSectionBoundary,
} from "./tabs/design/report-area/sectionGeometry.ts";
import { previewProject } from "./tabs/preview/previewSettings.ts";
import { serializableParameters } from "./shared/parameters/reportParameters.ts";
import {
  editTableStructure,
  setTableHeaders,
  clearTableContents,
} from "./tabs/design/report-area/table/tableEditing.ts";
import {
  captureSelectionElements,
  placeElements,
  elementBounds,
  parseElementBundle,
} from "./domain/report/elementTransfer.ts";
import data from "../app/src/data/exampleData.json" with { type: "json" };
export type Request = {
  action: string;
  project: Project;
  selected?: string[];
  band?: string;
  args?: any;
};
export const native = async (
  command: string,
  args: Record<string, unknown> = {},
) => {
  const api = (globalThis as any).__TAURI__?.core;
  if (!api)
    throw new Error("This operation requires the Tauri desktop application.");
  return api.invoke(command, args);
};
export function templateOnly(project: Project): Project {
  return validateProject({
    version: 1,
    report: structuredClone(project.report),
    datasets: project.datasets.map(({ id, name, schema }) => ({
      id,
      name,
      schema: structuredClone(schema),
      data: [],
    })),
    ...(project.dataSource
      ? { dataSource: { name: project.dataSource.name } }
      : {}),
    ...(project.relations ? { relations: project.relations } : {}),
    ...(project.dataModel ? { dataModel: project.dataModel } : {}),
    ...(project.parameters
      ? { parameters: serializableParameters(project.parameters) }
      : {}),
  });
}
export function bindExample(project: Project): Project {
  if (project.dataSource?.name === "InvoiceDB")
    for (const table of project.datasets)
      table.data = structuredClone(
        data.find((t) => t.id === table.id)?.data ?? [],
      ) as any;
  ensureDefaultSections(project.report, false);
  return validateProject(project);
}
export function query(project: Project, args: any = {}) {
  const filtered = previewProject(project, {
    values: args.values ?? {},
    header: true,
    footer: true,
  });
  const table = filtered.datasets.find(
    (t) => t.id === (args.table ?? filtered.datasets[0]?.id),
  );
  if (!table) return [];
  let rows = table.data;
  for (const relation of filtered.relations ?? []) {
    if (
      relation.from.dataset === table.id ||
      relation.to.dataset === table.id
    ) {
      const joined = joinRelatedRows(
        filtered.datasets.map((t) =>
          t.id === table.id ? { ...t, data: rows } : t,
        ),
        table.id,
        relation,
        "inner",
      );
      rows = joined.rows.map(({ row, related }) => ({
        ...row,
        ...Object.fromEntries(
          Object.entries(related ?? {}).map(([k, v]) => [
            `${joined.relatedDataset.id}.${k}`,
            v,
          ]),
        ),
      }));
    }
  }
  const normalize = (v: unknown) =>
    String(v ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  rows = rows.filter((row) =>
    Object.entries(args.filters ?? {}).every(([key, value]) =>
      normalize(row[key]).includes(normalize(value)),
    ),
  );
  const fields = [...table.schema.fields];
  for (const key of new Set(rows.flatMap((row) => Object.keys(row))))
    if (!fields.some((field) => field.name === key)) {
      const value = rows.find((row) => row[key] !== null)?.[key];
      fields.push({
        name: key,
        type:
          typeof value === "number"
            ? "number"
            : typeof value === "boolean"
              ? "boolean"
              : "text",
      });
    }
  return queryRecords({
    datasets: filtered.datasets,
    table: { ...table, data: rows, schema: { fields } },
    joinMode: "inner",
    parameters: [],
    values: {},
    filters: args.groups ?? [],
    combination: args.combination === "or" ? "or" : "and",
    search: args.search ?? "",
    sort: args.sort ?? null,
    limit: args.limit ?? 200,
    locale: args.locale ?? "en",
  }).rows.map((record) => record.row);
}
export function displayedProject(project: Project, args: any = {}) {
  const p = previewProject(project, {
    values: args.values ?? {},
    header: args.header !== false,
    footer: args.footer !== false,
  });
  if (p.relations?.length)
    for (const table of p.datasets)
      table.data = query(project, {
        table: table.id,
        values: args.values,
        limit: 100000,
      });
  return p;
}
export function layoutOf(project: Project, measureText: any, args: any = {}) {
  for (const parameter of project.parameters ?? []) {
    const value = String(args.values?.[parameter.id] ?? parameter.value ?? parameter.defaultValue ?? '').trim();
    if (parameter.required && !value) throw new Error(`Required parameter: ${parameter.label}`);
    if (value && parameter.type === 'boolean' && !['true', 'false'].includes(value)) throw new Error(`Invalid boolean parameter: ${parameter.label}`);
    if (value && parameter.type === 'number' && !Number.isFinite(Number(value))) throw new Error(`Invalid numeric parameter: ${parameter.label}`);
  }
  const p = displayedProject(project, args);
  const layout=compileReport(p.report, p.datasets, {
    measureText,
    sectionHeights: Object.fromEntries(sectionHeights(p.report)),
    ...(args.now ? { now: new Date(args.now) } : {}),
  });
  const sources=new Set(p.report.details.map(detail=>detail.dataset).filter(Boolean));
  const recordCount=p.datasets.filter(table=>sources.has(table.id)).reduce((count,table)=>count+table.data.length,0);
  return {...layout,recordCount};
}
function activeElements(p: Project, ids: string[]) {
  const all = bandsOf(p.report).flatMap((b) => b.elements);
  const groups = new Set(
    all.filter((e) => ids.includes(e.id) && e.groupId).map((e) => e.groupId),
  );
  return all.filter(
    (e) => ids.includes(e.id) || (e.groupId && groups.has(e.groupId)),
  );
}
function checkEditable(p: Project, els: ReportElement[], target?: Band) {
  for (const band of bandsOf(p.report))
    if (
      (band === target || band.elements.some((e) => els.includes(e))) &&
      isSectionReadOnly(p.report, band.id)
    )
      throw new Error("This section is read only.");
}
/** Add one editable aggregate per numeric field to the detail footer. */
function addDetailTotal(p: Project, band: Band, datasetId: string, fieldName: string) {
  const detail = sectionDetail(p.report, band.id);
  const contains = (section: Band): boolean => section.id === band.id || (section.sections ?? []).some(contains);
  if (!detail || !contains(detail.band)) return;
  const dataset = p.datasets.find(table => table.id === datasetId);
  if (!dataset?.schema.fields.some(field => field.name === fieldName && field.type === "number")) return;
  // A detail's aggregates must operate on the rows of its own data source.
  if (detail.dataset && detail.dataset !== datasetId) return;
  if (!detail.dataset) detail.dataset = datasetId;
  if (!detail.groupFooter) detail.groupFooter = makeBand("Details footer", 0.35);
  const footer = detail.groupFooter;
  checkEditable(p, [], footer);
  let totals = (footer.sections ?? []).find(section => section.name === "Details totals");
  if (totals) checkEditable(p, [], totals);
  else {
    totals = makeBand("Details totals", 0.4);
    (footer.sections ??= []).push(totals);
  }
  footer.visible = true;
  totals.visible = true;
  const expression = `${fieldName}: [SUM(${fieldName})]`;
  if (totals.elements.some(element => element.text === expression)) return;
  const y = Math.max(0.05, ...totals.elements.map(element => element.y + element.height + 0.08));
  const width = Math.min(3, p.report.page.width - p.report.page.margins.left - p.report.page.margins.right);
  const total = makeElement("text", { text: expression, x: 0.1, y, width, height: 0.3 });
  total.style.format = "number";
  totals.elements.push(total);
  totals.height = Math.max(totals.height, y + total.height + 0.05);
}
/** Resolve a palette field using the current detail row or its named source. */
function paletteFieldText(p: Project, band: Band, field: any): string {
  if (!field || typeof field.text !== "string" || !["text", "number", "boolean", "formula", "special"].includes(field.kind)) throw new Error("Invalid field token.");
  const match = /^\[([A-Za-z_][A-Za-z_0-9]*)\]$/.exec(field.text);
  if (!match || typeof field.dataset !== "string") return field.text;
  const source = p.datasets.find(dataset => dataset.id === field.dataset);
  if (!source?.schema.fields.some(column => column.name === match[1])) throw new Error("Unknown data field.");
  const detail = sectionDetail(p.report, band.id);
  if (detail && !detail.dataset) detail.dataset = source.id;
  if (detail?.dataset === source.id) return field.text;
  return /^[A-Za-z_][A-Za-z_0-9]*$/.test(source.id)
    ? `[${source.id}.${match[1]}]`
    : `[FIELD(${JSON.stringify(source.id)}, ${JSON.stringify(match[1])})]`;
}
function rebuild(
  p: Project,
  band: Band,
  original: ReportElement,
  settings: TableSettings,
) {
  const cells = band.elements.filter((e) => e.groupId === original.groupId);
  const x = Math.min(...cells.map((e) => e.x));
  const y = Math.min(...cells.map((e) => e.y));
  const dataset = p.datasets.find((d) => d.id === settings.dataset) ?? {
    id: "",
    name: "",
    schema: { fields: [] },
    data: [],
  };
  const next = createTable(dataset, settings.width, settings, original.groupId);
  next.forEach((e) => {
    e.x += x;
    e.y += y;
  });
  band.elements = band.elements
    .filter((e) => e.groupId !== original.groupId)
    .concat(next);
  return next;
}
function selectedCell(next: ReportElement[], original: ReportElement) {
  const rows = next[0]?.table?.rows ?? 1, columns = next[0]?.table?.columns ?? 1;
  const row = Math.min(original.cell?.row ?? 0, rows - 1), column = Math.min(original.cell?.column ?? 0, columns - 1);
  return next.find(e => e.type === 'text' && e.cell?.row === row && e.cell?.column === column)?.id ?? next[0]?.id;
}
/** All document mutations finish with project validation. */
export async function act(request: Request): Promise<any> {
  const p = structuredClone(request.project),
    args = request.args ?? {},
    ids = request.selected ?? [];
  const allBands = bandsOf(p.report);
  const band = allBands.find((b) => b.id === (args.band ?? request.band)) ?? allBands[0];
  const chosen = activeElements(p, ids);
  const first = allBands
    .flatMap((b) => b.elements)
    .find((e) => ids.includes(e.id));
  const result = (extra: any = {}) => {
    if (!canEditProject(request.project, p))
      throw new Error("This section is read only.");
    return { project: validateProject(p), ...extra };
  };
  switch (request.action) {
    case "resize-section":
      checkEditable(p, [], band);
      resizeSectionBoundary(
        p.report,
        args.band ?? band.id,
        args.height,
        approximateMeasure,
      );
      return result();
    case "model-root": {
      const id = args.table;
      if (!p.datasets.some((table) => table.id === id)) throw new Error("Unknown data table.");
      p.dataModel ??= { tables: {} };
      p.dataModel.rootDataset = id;
      return result({ activeTable: id });
    }
    case "model-settings": {
      const id = args.table;
      if (!p.datasets.some((t) => t.id === id))
        throw new Error("Unknown data table.");
      p.dataModel ??= { tables: {} };
      p.dataModel.tables[id] = { ...p.dataModel.tables[id], ...args.settings };
      return result();
    }
    case "import-tables":
      return { project: importTables(p, args.json), message: "Tables imported" };
    case "replace-tables":
      p.datasets = args.tables;
      if (p.dataModel?.rootDataset && !p.datasets.some((table) => table.id === p.dataModel?.rootDataset)) delete p.dataModel.rootDataset;
      p.dataSource = { name: args.name ?? "API" };
      return result();
    case "new":
      if ((globalThis as any).__TAURI__?.core) await native("reset_document_path");
      return { project: createBlankProject(), selected: [] };
    case "duplicate-report": {
      if ((globalThis as any).__TAURI__?.core) await native("reset_document_path");
      const copy = structuredClone(p);
      copy.report.id = uid("report");
      copy.report.title = `${copy.report.title} (copy)`;
      return { project: copy, selected: [] };
    }
    case "open":
    case "open-recent": {
      const text = request.action === "open-recent" ? await native("open_recent_document", {path: args.path}) : await native("open_document");
      if (text === null) return { message: "Open cancelled" };
      const project = bindExample(validateProject(JSON.parse(text)));
      await native("accept_document_path");
      return {
        project,
        activeTable: project.dataModel?.rootDataset,
        selected: [],
        message: "Report opened",
      };
    }
    case "save":
    case "save-as": {
      const saved = await native("save_report", { document: templateOnly(p), saveAs: request.action === "save-as" });
      return {
        saved: !!saved,
        message: saved ? "Report saved" : "Save cancelled",
      };
    }
    case "query":
      return { rows: query(p, args) };
    case "add-detail-section": {
      const dataset = p.datasets.find((table) => table.id === args.dataset);
      if (!dataset && args.dataset !== "") throw new Error("Select an existing table.");
      const suffix = dataset ? ` ${dataset.name || dataset.id}` : "";
      const detail = {
        id: uid("detail"), dataset: dataset?.id ?? "",
        band: makeBand(`${args.labels?.detail || "Details"}${suffix}`, 0.5),
        groupHeader: makeBand(`${args.labels?.header || "Details header"}${suffix}`, 0.3),
        groupFooter: makeBand(`${args.labels?.footer || "Details footer"}${suffix}`, 0.3),
      };
      p.report.details.push(detail);
      return result({activeBand:detail.band.id,selected:[]});
    }
    case "remove-section": {
      if (isDefaultSection(p.report, band.id)) throw new Error("Default sections cannot be removed. Hide the section instead.");
      checkEditable(p, [], band);
      for (const parent of bandsOf(p.report)) parent.sections = parent.sections?.filter((child) => child.id !== band.id);
      p.report.details = p.report.details.filter((detail) => detail.band.id !== band.id);
      return result();
    }
    case "add-subsection": {
      checkEditable(p, [], band);
      const parentName = args.parentName || band.name;
      const names = new Set((band.sections ?? []).map((section) => section.name));
      let number = 1;
      while (names.has(`${parentName}-${number}`)) number++;
      const child=makeBand(`${parentName}-${number}`, 0.5);
      (band.sections ??= []).push(child);
      return result({activeBand:child.id,selected:[]});
    }
    case "delete-relation":
      p.relations = p.relations?.filter((r) => r.id !== args.id);
      return result();
    case "remove-parameter":
      p.parameters = p.parameters?.filter((r) => r.id !== args.id);
      return result();
    case "organize":
      p.dataModel = {
        ...p.dataModel,
        tables: Object.fromEntries(
          p.datasets.map((t, i) => [
            t.id,
            {
              ...p.dataModel?.tables[t.id],
              x: 180 + (i % 3) * 300,
              y: 50 + Math.floor(i / 3) * 340,
            },
          ]),
        ),
      };
      return result();
    case "add-subreport": {
      checkEditable(p, [], band);
      const text = await native("open_report");
      if (text === null) return { message: "Open cancelled" };
      const source = bindExample(validateProject(JSON.parse(text)));
      const groupId = uid("subreport");
      const items = createSubreport(
        compileReport(source.report, source.datasets),
        p.report.page.width - 0.8,
      ).map((element) => ({
        ...element,
        groupId,
        x: element.x + (args.x ?? 0.2),
        y: element.y + (args.y ?? 0.2),
      }));
      band.elements.push(...items);
      band.height = Math.max(band.height, ...items.map((e) => e.y + e.height));
      return result({ selected: items.map((e) => e.id) });
    }
    case "restore-example": {
      const { createSampleProject } = await import("./domain/report/sample.ts");
      return { project: createSampleProject(), selected: [] };
    }
    case "add-field": {
      checkEditable(p, [], band);
      const field = args.field;
      if (!field || typeof field.text !== "string" || !["text", "number", "boolean", "formula", "special"].includes(field.kind))
        throw new Error("Invalid field token.");
      const contentWidth = p.report.page.width - p.report.page.margins.left - p.report.page.margins.right;
      const width = Math.min(field.kind === "formula" ? 2.5 : 2, contentWidth);
      const fieldText = paletteFieldText(p, band, field);
      const element = makeElement("text", {
        text: fieldText,
        x: Math.max(0, Math.min(args.x ?? 0.1, Math.max(0, contentWidth - width))),
        y: Math.max(0, args.y ?? Math.max(0.05, ...band.elements.map(element => element.y + element.height + 0.08))),
        width, height: 0.3,
      });
      element.style.format = field.kind === "number" ? "number" : field.kind === "formula" ? "currency" : "text";
      band.elements.push(element);
      band.height = Math.max(band.height, element.y + element.height + 0.08);
      const match = /^\[([A-Za-z_][A-Za-z_0-9]*)\]$/.exec(field.text);
      if (field.kind === "number" && typeof field.dataset === "string" && match) addDetailTotal(p, band, field.dataset, match[1]);
      return result({ selected: [element.id] });
    }
    case "add-text":
    case "add-line":
    case "add-rectangle":
    case "add-shape":
    case "add-chart":
    case "add-table":
    case "add-image": {
      checkEditable(p, [], band);
      let items: ReportElement[];
      const dataset = p.datasets.find(
        (d) =>
          d.id === p.report.details.find((d) => d.band.id === band.id)?.dataset,
      ) ??
        p.datasets.find((d) =>
          d.schema.fields.some((f) => f.type === "number"),
        ) ??
        p.datasets[0] ?? { id: "", name: "", data: [], schema: { fields: [] } };
      if (request.action === "add-table") {
        items = createTable(dataset, Math.min(6, p.report.page.width - 0.8));
        const detail = p.report.details.find((d) => d.band.id === band.id);
        if (detail && !detail.dataset) detail.dataset = dataset.id;
      } else if (
        request.action === "add-shape" ||
        request.action === "add-rectangle"
      )
        items = [
          createShape(
            request.action === "add-rectangle" ? "rectangle" : "circle",
          ),
        ];
      else if (request.action === "add-chart") items = [createChart(dataset)];
      else if (request.action === "add-image") {
        const src = await native("open_image");
        if (!src) return {};
        items = [makeElement("image", { src, width: 1, height: 1 })];
      } else
        items = [
          makeElement(request.action === "add-line" ? "line" : "text", {
            text: args.text ?? "Text",
            ...(request.action === "add-line" ? { height: 0.02 } : {}),
          }),
        ];
      for (const e of items) {
        e.x += args.x ?? 0.1;
        e.y += args.y ?? 0.1;
        band.elements.push(e);
        band.height = Math.max(band.height, e.y + e.height + 0.05);
      }
      if (request.action === "add-table") {
        for (const field of dataset.schema.fields.slice(0, items[0]?.table?.columns ?? 0))
          if (field.type === "number") addDetailTotal(p, band, dataset.id, field.name);
      }
      return result({
        selected: [items.find((e) => e.type === "text")?.id ?? items[0].id],
      });
    }
    case "move": {
      const target = allBands.find((b) => b.id === args.targetBand) ?? band;
      checkEditable(p, chosen, target);
      if (!chosen.length) return {};
      const references = allBands.flatMap((b) =>
        b.elements
          .filter((e) => ids.includes(e.id))
          .map((e) => ({ bandId: b.id, elementId: e.id })),
      );
      const bundle = captureSelectionElements(p.report, p.datasets, references);
      if (!bundle) return {};
      const source = allBands.find((b) => b.elements.includes(chosen[0]))!;
      const heights = sectionHeights(p.report);
      const top = (b: Band) =>
        allBands
          .slice(0, allBands.indexOf(b))
          .reduce((sum, b) => sum + (heights.get(b.id) ?? b.height), 0);
      const bounds = elementBounds(bundle.elements);
      const placed = placeElements(
        p.report,
        bundle,
        target.id,
        {
          x: bounds.x + Number(args.dx ?? 0),
          y:
            bounds.y +
            (bundle.multiple ? 0 : top(source)) -
            top(target) +
            Number(args.dy ?? 0),
        },
        false,
        source.id,
      );
      p.report = placed.report;
      return result({
        selected: placed.selection.elements?.map((e) => e.elementId) ?? [
          placed.selection.elementId,
        ],
      });
    }
    case "copy":
    case "cut": {
      if (!chosen.length) return {};
      if (request.action === "cut") checkEditable(p, chosen);
      const references = allBands.flatMap((b) =>
        b.elements
          .filter((e) => ids.includes(e.id))
          .map((e) => ({ bandId: b.id, elementId: e.id })),
      );
      const bundle = captureSelectionElements(p.report, p.datasets, references);
      if (!bundle) return {};
      await native("write_clipboard", { text: JSON.stringify(bundle) });
      if (request.action === "cut") {
        for (const b of allBands)
          b.elements = b.elements.filter((e) => !chosen.includes(e));
        return result({ selected: [] });
      }
      return { message: "Copied" };
    }
    case "paste": {
      checkEditable(p, [], band);
      const bundle = parseElementBundle(await native("read_clipboard"));
      const bounds = elementBounds(bundle.elements);
      const placed = placeElements(p.report, bundle, band.id, {
        x: (bundle.position?.x ?? bounds.x) + 0.1,
        y: (bundle.position?.y ?? bounds.y) + 0.1,
      });
      p.report = placed.report;
      return result({
        selected: placed.selection.elements?.map((e) => e.elementId) ?? [
          placed.selection.elementId,
        ],
      });
    }
    case "delete":
      checkEditable(p, chosen);
      for (const b of allBands)
        b.elements = b.elements.filter((e) => !chosen.includes(e));
      return result({ selected: [] });
    case "cell-text": {
      checkEditable(p, chosen);
      if (!first) return {};
      first.text = String(args.text ?? "");
      if (first.table && first.cell) {
        const settings = structuredClone(first.table);
        settings.contents[`${first.cell.row}:${first.cell.column}`] =
          first.text;
        const next = rebuild(
          p,
          allBands.find((b) => b.elements.includes(first))!,
          first,
          settings,
        );
        return result({
          selected: [
            next.find(
              (e) =>
                e.type === "text" &&
                e.cell?.row === first.cell!.row &&
                e.cell?.column === first.cell!.column,
            )?.id ?? next[0].id,
          ],
        });
      }
      return result();
    }
    case "table-structure": {
      checkEditable(p, chosen);
      if (!first?.table) return {};
      const settings = editTableStructure(
        first.table,
        chosen,
        args.axis,
        args.index ??
          (args.axis === "row" ? first.cell?.row : first.cell?.column) ??
          0,
        args.operation,
      );
      const next = rebuild(
        p,
        allBands.find((b) => b.elements.includes(first))!,
        first,
        settings,
      );
      return result({
        selected: [selectedCell(next, first)],
      });
    }
    case "style":
      checkEditable(p, chosen);
      for (const e of chosen.filter((e) => e.type === "text" || !e.table))
        { e.style = { ...e.style, ...args }; if(e.style.fontFamily === null) delete e.style.fontFamily; }
      return result();
    case "chart-settings":
      checkEditable(p, chosen);
      if (first?.chart) { first.chart = { ...first.chart, ...args }; if(first.chart.categoryColors === null) delete first.chart.categoryColors; }
      return result();
    case "table-geometry": {
      checkEditable(p, chosen);
      if (!first?.table) return {};
      const settings = structuredClone(first.table);
      const x = Math.min(...chosen.map((e) => e.x)),
        y = Math.min(...chosen.map((e) => e.y));
      const value = Number(args.value);
      if (!Number.isFinite(value)) throw new Error("Invalid geometry.");
      if (args.property === "x" || args.property === "y") {
        const delta = value - (args.property === "x" ? x : y);
        for (const e of chosen) e[args.property] += delta;
        return result();
      }
      if (args.property === "width") {
        if (value <= 0) return {};
        const ratio = value / settings.width;
        settings.width = value;
        if (settings.columnWidths)
          settings.columnWidths = settings.columnWidths.map((w) => w * ratio);
      }
      if (args.property === "height") {
        if (value <= 0) return {};
        const heights =
          settings.rowHeights ?? Array(settings.rows).fill(settings.rowHeight);
        const ratio = value / heights.reduce((sum, h) => sum + h, 0);
        settings.rowHeights = heights.map((h) => h * ratio);
      }
      const next = rebuild(
        p,
        allBands.find((b) => b.elements.includes(first))!,
        first,
        settings,
      );
      return result({
        selected: [selectedCell(next, first)],
      });
    }
    case "table-settings":
    case "table-style":
    case "table-content":
    case "table-dimension": {
      checkEditable(p, chosen);
      if (!first?.table) return {};
      let settings = structuredClone(first.table);
      const row = first.cell?.row ?? 0, column = first.cell?.column ?? 0;
      const elements = allBands.flatMap(b => b.elements).filter(e => e.groupId === first.groupId);
      if (request.action === 'table-settings') {
        if (typeof args.headers === 'boolean') {
          const fields = p.datasets.find(d => d.id === settings.dataset)?.schema.fields.map(f => f.name) ?? [];
          settings = setTableHeaders(settings, elements, fields, args.headers);
        }
        for (const key of ['rows','columns','width','rowHeight','rowHeights','columnWidths','contents'] as const)
          if (args[key] !== undefined) {
            if (args[key] === null) delete settings[key];
            else (settings as any)[key] = args[key];
          }
      } else if (request.action === 'table-content') {
        if (args.operation === 'clear') settings = clearTableContents(settings,args.scope,row,column);
        if (args.operation === 'reset') delete settings.contents[`${row}:${column}`];
        if (args.operation === 'bind') for (let r=0;r<settings.rows;r++)
          if (args.scope === 'column' || r === row) settings.contents[`${r}:${column}`] = settings.headers && r === 0 ? args.field : `[${args.field}]`;
        if (args.operation === 'drop-field') {
          const tableBand = allBands.find(b => b.elements.includes(first))!;
          settings.contents[`${row}:${column}`] = paletteFieldText(p, tableBand, args.field);
        }
      } else if (request.action === 'table-dimension') {
        if (args.axis === 'column') {
          const widths = settings.columnWidths ?? Array(settings.columns).fill(settings.width/settings.columns);
          widths[args.index] = args.value; settings.columnWidths = widths;
          settings.width = widths.reduce((sum,w)=>sum+w,0);
        } else {
          const heights = settings.rowHeights ?? Array(settings.rows).fill(settings.rowHeight);
          heights[args.index] = args.value; settings.rowHeights = heights;
        }
      } else {
        const key = args.scope === 'table' ? 'table' : args.scope === 'row' ? `row:${row}` : args.scope === 'column' ? `column:${column}` : `cell:${row}:${column}`;
        settings.styles[key] = {...settings.styles[key],...args.style};
        if (args.scope !== 'cell') for(let r=0;r<settings.rows;r++) for(let c=0;c<settings.columns;c++)
          if(args.scope==='table'||(args.scope==='row'&&r===row)||(args.scope==='column'&&c===column))
            settings.styles[`cell:${r}:${c}`] = {...settings.styles[`cell:${r}:${c}`],...args.style};
      }
      if (settings.rowHeights && settings.rowHeights.length !== settings.rows)
        settings.rowHeights = Array.from({length:settings.rows},(_,r)=>settings.rowHeights?.[r]??settings.rowHeight);
      if (settings.columnWidths) {
        const widths=Array.from({length:settings.columns},(_,c)=>settings.columnWidths?.[c]??settings.width/settings.columns);
        const sum=widths.reduce((a,b)=>a+b,0); settings.columnWidths=widths.map(w=>w*settings.width/sum);
      }
      // Null means document defaults / automatic colors, not a stored font ID.
      for(const style of Object.values(settings.styles)) if(style.fontFamily === null) delete style.fontFamily;
      const tableBand = allBands.find(b=>b.elements.includes(first))!;
      const next = rebuild(p, tableBand, first, settings);
      if (request.action === "table-content" && args.operation === "bind" && typeof args.field === "string" && (args.scope === "column" || !settings.headers || row > 0))
        addDetailTotal(p, tableBand, settings.dataset, args.field);
      if (request.action === "table-content" && args.operation === "drop-field" && args.field?.kind === "number" && typeof args.field.dataset === "string") {
        const match = /^\[([A-Za-z_][A-Za-z_0-9]*)\]$/.exec(args.field.text);
        if (match) addDetailTotal(p, tableBand, args.field.dataset, match[1]);
      }
      return result({selected:[selectedCell(next,first)]});
    }
    case 'element-settings':
      checkEditable(p,chosen); for(const e of chosen) for(const key of ['type','shape','src','borderColor','borderWidth']) if(args[key]!==undefined)(e as any)[key]=args[key]; return result();
    case 'change-image': {
      checkEditable(p,chosen); const src=await native('open_image');
      if(src && first?.type==='image') first.src=src; return result();
    }
    case 'duplicate': {
      checkEditable(p,chosen); if(!chosen.length)return {};
      const refs=allBands.flatMap(b=>b.elements.filter(e=>ids.includes(e.id)).map(e=>({bandId:b.id,elementId:e.id})));
      const bundle=captureSelectionElements(p.report,p.datasets,refs); if(!bundle)return {};
      const bounds=elementBounds(bundle.elements);
      const placed=placeElements(p.report,bundle,band.id,{x:bounds.x+0.1,y:bounds.y+0.1});
      p.report=placed.report;return result({selected:placed.selection.elements?.map(e=>e.elementId)??[placed.selection.elementId]});
    }
    case 'report-settings':
      for(const key of ['title','currency','locale'])if(args[key]!==undefined)(p.report as any)[key]=args[key];return result();
    case 'page-settings':
      if(args.paper){p.report.page.width=args.paper==='letter'?8.5:210/25.4;p.report.page.height=args.paper==='letter'?11:297/25.4;}
      if(args.margin!==undefined)p.report.page.margins={top:args.margin,bottom:args.margin,left:args.margin,right:args.margin};return result();
    case 'detail-settings': {
      const detail=p.report.details.find(d=>d.id===args.id);if(detail)for(const key of ['dataset','groupBy'])if(args[key]!==undefined)(detail as any)[key]=args[key];return result();
    }
    case "layer":
      checkEditable(p, chosen);
      for (const b of allBands)
        for (const id of ids)
          b.elements = reorderElements(b.elements, id, args.position);
      return result();
    case "apply-definition": {
      const value = args.value;
      if (args.kind === "Grouping") {
        const detail = p.report.details.find(d => d.id === value.detailId);
        const dataset = p.datasets.find(d => d.id === detail?.dataset);
        if (!detail || !dataset) throw new Error("Select a detail with a data source.");
        checkEditable(p, [], detail.band);
        if (!Array.isArray(value.groups) || value.groups.length > 10) throw new Error("Maximum 10 grouping levels per detail.");
        const fields = new Set<string>();
        if (typeof value.legacyField === 'string') {
          if (value.legacyField && !dataset.schema.fields.some(f => f.name === value.legacyField)) throw new Error("Unknown grouping field.");
          detail.groupBy = value.legacyField || undefined;
        }
        if (value.legacyDirection !== undefined) {
          if (!['asc','desc'].includes(value.legacyDirection)) throw new Error("Invalid grouping order.");
          detail.sortDirection = value.legacyDirection;
        }
        if (detail.groupBy) fields.add(detail.groupBy);
        if (value.groups.length + (detail.groupBy ? 1 : 0) > 10) throw new Error("Maximum 10 grouping levels per detail.");
        const previous = detail.groups ?? [];
        detail.groups = value.groups.map((input: any) => {
          if (!dataset.schema.fields.some(f => f.name === input.field) || fields.has(input.field)) throw new Error("Select a different field for each group.");
          if (!['asc','desc'].includes(input.direction)) throw new Error("Invalid grouping order.");
          fields.add(input.field);
          const old = previous.find(group => group.id === input.id);
          if (old) {
            if (old.header.name === `Group header · ${old.field}`) old.header.name = `Group header · ${input.field}`;
            if (old.footer.name === `Group footer · ${old.field}`) old.footer.name = `Group footer · ${input.field}`;
            if (old.header.elements.length === 1 && old.header.elements[0].text === `[${old.field}]`) old.header.elements[0].text = `[${input.field}]`;
            return { ...old, field:input.field, direction:input.direction };
          }
          const header = makeBand(`Group header · ${input.field}`, .35);
          header.elements.push(makeElement('text', {text:`[${input.field}]`, x:.1, y:.03, width:2.5, height:.25}));
          return { id:uid('group'), field:input.field, direction:input.direction, header, footer:makeBand(`Group footer · ${input.field}`, .35) };
        });
      } else if (args.kind === "Formula") {
        const list = (p.report.formulas ??= []);
        const i = list.findIndex((f) => f.name === value.name);
        if (i < 0) list.push(value);
        else list[i] = value;
      } else if (args.kind === "Relationship") {
        const check = relationshipPreview(p, value);
        if (check.error) throw new Error(check.error);
        const list = (p.relations ??= []);
        const i = list.findIndex((r) => r.id === value.id);
        if (i < 0) list.push(value);
        else list[i] = value;
      } else if (args.kind === "Parameter") {
        const list = (p.parameters ??= []);
        const i = list.findIndex((r) => r.id === value.id);
        if (i < 0) list.push(value);
        else list[i] = value;
      } else if (args.kind === "Add table" || args.kind === "Data table") {
        const check = tableDefinition(p, value, args.kind === "Data table");
        if(check.error) throw new Error(check.error);
        const i = p.datasets.findIndex((t) => t.id === check.table.id);
        if (i < 0) p.datasets.push(check.table);
        else {
          p.datasets[i] = check.table;
          for(const relation of p.relations ?? []) for(const endpoint of [relation.from,relation.to])
            if(endpoint.dataset === check.table.id) endpoint.field=check.mapping.get(endpoint.field) ?? endpoint.field;
          for (const detail of p.report.details.filter(d => d.dataset === check.table.id)) {
            if (detail.groupBy) detail.groupBy = check.mapping.get(detail.groupBy) ?? detail.groupBy;
            for (const group of detail.groups ?? []) {
              const previous = group.field, renamed = check.mapping.get(previous) ?? previous;
              if (group.header.name === `Group header · ${previous}`) group.header.name = `Group header · ${renamed}`;
              if (group.footer.name === `Group footer · ${previous}`) group.footer.name = `Group footer · ${renamed}`;
              for (const element of group.header.elements) if (element.text === `[${previous}]`) element.text = `[${renamed}]`;
              group.field = renamed;
            }
          }
        }
      } else if (args.kind === "Record") {
        const table =
          p.datasets.find((t) => t.id === args.table) || p.datasets[0];
        if (table) {
          if (args.original) {
            const fields = table.schema.fields.map((f) => f.name);
            const index = table.data.findIndex((row) =>
              fields.every(
                (key) =>
                  JSON.stringify(row[key] ?? null) ===
                  JSON.stringify(args.original[key] ?? null),
              ),
            );
            if (index < 0)
              throw new Error(
                "The record changed. Run the query again before editing.",
              );
            table.data[index] = Object.fromEntries(
              fields
                .filter((key) => key in value)
                .map((key) => [key, value[key]]),
            );
          } else table.data.push(value);
        }
      } else {
        checkEditable(p, chosen);
        if (!first) return {};
        if (args.kind === "Chart") first.chart = value;
        else if (args.kind === "Table") {
          const next = rebuild(
            p,
            allBands.find((b) => b.elements.includes(first))!,
            first,
            value,
          );
          return result({
            selected: [selectedCell(next, first)],
          });
        } else Object.assign(first, value, { id: first.id });
      }
      return result();
    }
    default:
      throw new Error(`Unknown action: ${request.action}`);
  }
}
