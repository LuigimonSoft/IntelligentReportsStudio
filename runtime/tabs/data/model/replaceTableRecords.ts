import type { Project } from '../../../engine/types.ts';
import { validateProject } from '../../../engine/validation.ts';
import { parseImportJson } from './jsonSyntax.ts';
/** Replace records atomically while preserving the schema and report bindings. */
export function replaceTableRecords(project: Project, tableId: string, input: string): Project {
  if (new TextEncoder().encode(input).length > 16 * 1024 * 1024) throw new Error('The document exceeds the 16 MiB limit.');
  const table = project.datasets.find(dataset => dataset.id === tableId);
  if (!table) throw new Error('Unknown data table.');
  const parsed = parseImportJson(input);
  let records: unknown = parsed;
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const object = parsed as Record<string, unknown>;
    const tables = Array.isArray(object.tables) ? object.tables as Record<string, unknown>[] : [];
    const match = tables.find(candidate => candidate && (candidate.id === table.id || candidate.name === table.name));
    records = object[table.id] ?? object[table.name] ?? match?.data ?? object.data ?? object.rows;
  }
  if (!Array.isArray(records)) throw new Error('The JSON must contain an array of records for the selected table.');
  const next = structuredClone(project);
  next.datasets.find(dataset => dataset.id === tableId)!.data = records as typeof table.data;
  return validateProject(next);
}
