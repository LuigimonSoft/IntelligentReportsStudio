import { expressionParameters } from "./shared/parameters/reportParameters.ts";
import { JsonSyntaxError } from "./tabs/data/model/jsonSyntax.ts";
import { importTables } from "./tabs/data/model/importTables.ts";
import { modelQueryPlan, modelRecords } from "./tabs/data/records/modelQuery.ts";
import { tableDefinition } from "./tabs/data/model/tableDefinition.ts";
import { relationshipPreview } from "./tabs/data/model/relationshipPreview.ts";
import { SQL_TYPES } from "./engine/sqlTypes.ts";
import { recordsCSV } from "./tabs/data/records/recordsQuery.ts";

import {
  act,
  layoutOf,
  native,
  displayedProject,
  type Request,
} from "./core.ts";
import { pdfBytes, pdfMeasureText } from "./adapters/pdf.ts";
import { evaluateExpression, chartPoints, validateProject } from "./engine/index.ts";
import { chartCategoryColor } from "./charts/chartColors.ts";
import { renderChart } from "./charts/renderChart.ts";
import type { ReportLayout } from "./engine/types.ts";
// Preview and export share the exact bytes for the same compiled layout.
// The cache contains only the current report and is replaced on any layout change.
let cachedPdf: { key: string; bytes: Promise<Uint8Array> } | undefined;
function pdfForLayout(layout: ReportLayout): Promise<Uint8Array> {
  const key = JSON.stringify(layout);
  if (cachedPdf?.key === key) return cachedPdf.bytes;
  const entry = { key, bytes: pdfBytes(layout) };
  cachedPdf = entry;
  entry.bytes.catch(() => { if (cachedPdf === entry) cachedPdf = undefined; });
  return entry.bytes;
}

let renderVersion = 0;
let renderQueue: Promise<void> = Promise.resolve();
async function renderPdf(layout: ReportLayout, zoom: number) {
  const version = ++renderVersion;
  // Invalidate old canvases before asynchronous PDF generation begins.
  for (const canvas of globalThis.document.querySelectorAll<HTMLCanvasElement>('#pdf-pages canvas, [id^="pdf-thumbnail-"]'))
    canvas.dataset.rendered = "false";
  // PDF.js cannot render two generations into the same canvas concurrently.
  const work = renderQueue.catch(() => {}).then(async () => {
    if (version !== renderVersion) return;
    const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
    GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
    const bytes = await pdfForLayout(layout);
    if (version !== renderVersion) return;
    const loadingTask = getDocument({ data: bytes.slice() });
    const document = await loadingTask.promise;
    try {
      for (let i = 1; i <= document.numPages; i++) {
        if (version !== renderVersion) return;
        const page = await document.getPage(i);
        for (const [id, scale] of [
          [`pdf-page-${i}`, (96 / 72) * zoom],
          [`pdf-thumbnail-${i}`, 0.21],
        ] as const) {
          if (version !== renderVersion) return;
          const canvas = globalThis.document.getElementById(id) as HTMLCanvasElement | null;
          if (!canvas) continue;
          canvas.dataset.rendered = "false";
          canvas.dataset.renderScale = String(scale);
          const viewport = page.getViewport({ scale });
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext("2d");
          if (context) await page.render({ canvasContext: context, canvas, viewport }).promise;
          if (version !== renderVersion) return;
          canvas.dataset.rendered = "true";
        }
      }
    } finally {
      await loadingTask.destroy();
    }
  });
  renderQueue = work.catch(() => {});
  await work;
}
export async function call(payload: string): Promise<string> {
  const request: Request = JSON.parse(payload);
  const args = request.args ?? {};
  switch (request.action) {
    case "preferences-load": {
      const preferences = (globalThis as any).__TAURI__?.core
        ? await native("load_preferences")
        : JSON.parse(localStorage.getItem("reportstudio:preferences") ?? "{}");
      return JSON.stringify({ preferences });
    }
    case "preferences-save":
      if ((globalThis as any).__TAURI__?.core) await native("save_preferences", { preferences: args.preferences });
      else localStorage.setItem("reportstudio:preferences", JSON.stringify(args.preferences));
      return "{}";
    case "accept-table-data":
      await native("accept_table_data", {table:args.table}); return "{}";
    case "clear-table-data-sources":
      await native("clear_table_data_sources"); return "{}";
    case "recent-documents":
      return JSON.stringify({ paths: await native("list_recent_documents") });
    case "recovery-load": {
      const text = await native("load_recovery");
      return JSON.stringify({ project: text ? validateProject(JSON.parse(text)) : null });
    }
    case "recovery-save":
      await native("save_recovery", { document: request.project });
      return "{}";
    case "recovery-clear":
      await native("clear_recovery");
      return "{}";
    case "import-tables-preview":
      try {
        const project = importTables(request.project, args.json, args.recognizeDates === true, args.expandNested === true);
        const tables = project.datasets.slice(request.project.datasets.length).map(table => ({
          name: table.name, recordCount: table.data.length,
          fields: table.schema.fields.map(field => ({name:field.name, type:field.type, sqlType:field.sqlType?.name, sourcePath:field.sourcePath,
            missingCount:table.data.reduce((count,row) => count + (Object.hasOwn(row,field.name) ? 0 : 1), 0)})),
        }));
        return JSON.stringify({valid:true, count:tables.length, tables});
      } catch (error) {
        return JSON.stringify({valid:false, error:error instanceof Error ? error.message : "Invalid JSON file.",
          ...(error instanceof JsonSyntaxError ? { syntaxError:true, line:error.line, column:error.column } : {})});
      }
    case "records-query-plan":
      return JSON.stringify(modelQueryPlan(request.project, args));
    case "records-query":
      return JSON.stringify(modelRecords(request.project, args));
    case "relationship-preview":
      return JSON.stringify(relationshipPreview(request.project, args));
    case "table-definition-preview":
      return JSON.stringify(tableDefinition(request.project, args.value, args.editing));
    case "sql-types":
      return JSON.stringify(SQL_TYPES);
    case "formula-preview":
    case "evaluate": {
      const project = request.project;
      const dataset = args.dataset ?? project.report.details.at(-1)?.dataset ?? project.datasets[0]?.id;
      const table = project.datasets.find(source => source.id === dataset);
      const rows = table?.data ?? [];
      const record = Math.max(1, Math.min(rows.length || 1, Number(args.record) || 1));
      const row = rows[record - 1] ?? {};
      const formula = { name: String(args.name ?? "").trim(), expression: String(args.expression ?? "").trim() };
      const formulas = request.action === "formula-preview"
        ? [...(project.report.formulas ?? []).filter(existing => existing.name !== args.editingName), formula]
        : project.report.formulas;
      let validation = "", error = "", result: unknown = "";
      if (request.action === "formula-preview") {
        try {
          if (formula.name !== args.editingName && project.report.formulas?.some(existing => existing.name === formula.name))
            throw new Error("A formula with that name already exists.");
          validateProject({ ...project, report: { ...project.report, formulas } });
        } catch (failure) { validation = failure instanceof Error ? failure.message : "Invalid formula."; }
      }
      if (formula.expression) {
        try {
          result = evaluateExpression(formula.expression, {
            row, rows, now: new Date(), formulas, parameters: expressionParameters(project.parameters),
            formulaStack: formula.name ? [formula.name] : [], dataset,
            sources: Object.fromEntries(project.datasets.map(source => [source.id, source.id === dataset ? row : source.data[0] ?? {}])),
            rowNumber: record, rowCount: rows.length, tableRowNumber: record, columnNumber: 1, pageNumber: 1, pageCount: 1,
          });
        } catch (failure) { error = failure instanceof Error ? failure.message : "Invalid formula."; }
      }
      return JSON.stringify({ result, error, validation, valid: !validation && !!formula.expression && (!error || (!rows.length && !["Circular formula reference.", "Division by zero."].includes(error))) });
    }
    case "preview":
      return JSON.stringify({
        layout: layoutOf(request.project, pdfMeasureText, args),
      });
    case "render-preview":
      await renderPdf(args.layout, args.zoom ?? 1);
      return "{}";
    case "chart-points": {
      const settings=args.chart;
      return JSON.stringify({points:chartPoints(settings,request.project.datasets).filter(point=>!['pie','donut'].includes(settings.kind)||point.value>0).map((point,index)=>({...point,color:chartCategoryColor(settings,point.label,index)}))});
    }
    case "chart-svg": {
      const e = args.element;
      return JSON.stringify({
        svg: renderChart(
          e.chart,
          chartPoints(e.chart, request.project.datasets),
          800,
          480,
        ).outerHTML,
      });
    }
    case "export-pdf": {
      const layout =
        args.layout ?? layoutOf(request.project, pdfMeasureText, args);
      const bytes = await pdfForLayout(layout);
      const saved = await native("save_pdf", { bytes: Array.from(bytes), suggestedName: layout.title });
      return JSON.stringify({
        message: saved ? "PDF exported" : "Export cancelled",
      });
    }
    case "print":
      await native("print_report");
      return "{}";
    case "fullscreen":
      await native("toggle_fullscreen");
      return "{}";
    case "export-data": {
      const { rows, columns } = modelRecords(request.project, args);
      const hidden = new Set(Array.isArray(args.hiddenColumns) ? args.hiddenColumns : []);
      const keys = columns.map((column) => column.key).filter((key) => !hidden.has(key));
      const projected = rows.map((row) => Object.fromEntries(keys.map((key) => [key, row[key] ?? null])));
      const format = args.format === "json" ? "json" : "csv";
      const text = format === "json" ? JSON.stringify(projected, null, 2) : recordsCSV(projected, keys);
      const saved = await native("save_csv", { text, format });
      return JSON.stringify({ message: saved ? "Data exported" : "Export cancelled" });
    }
    default:
      return JSON.stringify(await act(request));
  }
}
