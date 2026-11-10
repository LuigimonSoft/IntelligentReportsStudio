import { rootBandsOf, type Band, type Project } from './types.ts';
import { expressionFieldReferences } from './expressions.ts';

export type FieldDiagnostic = {
  kind: 'missing-field' | 'missing-values';
  section: string;
  field: string;
};

/** Best-effort diagnostics never prevent generating an otherwise valid report. */
export function fieldDiagnostics(project: Project): FieldDiagnostic[] {
  const { report, datasets } = project;
  const formulas = new Map((report.formulas ?? []).map(formula => [formula.name, formula.expression]));
  const special = new Set(['ROW_NUMBER', 'ROW_COUNT', 'TABLE_ROW_NUMBER', 'COLUMN_NUMBER', 'IS_ODD_ROW', 'PAGE_NUMBER', 'PAGE_COUNT']);
  const warnings: FieldDiagnostic[] = [];
  const seen = new Set<string>();
  const missingCache = new Map<string, boolean>();
  function add(kind: FieldDiagnostic['kind'], section: string, field: string) {
    const key = JSON.stringify([kind, section, field]);
    if (!seen.has(key) && warnings.length < 50) {
      seen.add(key);
      warnings.push({ kind, section, field });
    }
  }
  function inspect(expression: string, section: string, visited = new Set<string>()) {
    let refs: string[];
    try { refs = expressionFieldReferences(expression); } catch { return; }
    for (const reference of refs) {
      if (special.has(reference)) continue;
      const formula = formulas.get(reference);
      if (formula !== undefined) {
        if (!visited.has(reference)) inspect(formula, section, new Set([...visited, reference]));
        continue;
      }
      const parts = reference.split('.');
      const qualified = parts.length === 2;
      const field = qualified ? parts[1] : parts[0];
      const tables = datasets.filter(table => (!qualified || table.id === parts[0]) && table.schema.fields.some(column => column.name === field));
      if (!tables.length) {
        add('missing-field', section, reference);
        continue;
      }
      // For unqualified names, avoid attributing missing values to an ambiguous source.
      if (tables.length !== 1) continue;
      const table = tables[0];
      const key = JSON.stringify([table.id, field]);
      if (!missingCache.has(key)) missingCache.set(key, table.data.some(row => !Object.hasOwn(row, field)));
      if (missingCache.get(key)) add('missing-values', section, reference);
    }
  }
  function visit(band: Band) {
    if (band.visible === false) return;
    if (band.visibilityExpression) inspect(band.visibilityExpression, band.name);
    if (band.backgroundExpression) inspect(band.backgroundExpression, band.name);
    for (const element of band.elements) {
      if (element.visible === false || element.type !== 'text') continue;
      for (const match of element.text.matchAll(/\[([^\[\]]+)\]/g)) inspect(match[1], band.name);
    }
    for (const child of band.sections ?? []) visit(child);
  }
  for (const band of rootBandsOf(report)) visit(band);
  return warnings;
}
