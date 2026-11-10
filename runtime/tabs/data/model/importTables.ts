import { expandNestedJson } from "./nestedJson.ts";
import { parseImportJson } from "./jsonSyntax.ts";
import type { Dataset, Project } from "../../../engine/types.ts";
import { validateProject } from "../../../engine/index.ts";
import { inferTable } from "./inferTables.ts";
import { tableDefinition } from "./tableDefinition.ts";

/** Parse and validate the entire import before changing the project. */
export function importTables(project: Project, input: string, recognizeDates = false, expandNested = false): Project {
  if (typeof input !== "string" || !input.trim()) throw new Error("Choose a JSON file or paste its contents.");
  if (new TextEncoder().encode(input).length > 16 * 1024 * 1024) throw new Error("The document exceeds the 16 MiB limit.");
  const parsed: any = parseImportJson(input);
  const definitions = (items: any[]) => items.length > 0 && items.every(item => item && typeof item === 'object' && typeof item.name === 'string' && (Array.isArray(item.schema?.fields) || Array.isArray(item.data)));
  let incoming: any[] | null = null;
  const generatedRelations: NonNullable<Project['relations']> = [];
  const infer = (name: string, rows: unknown[], rootProperty?: string) => {
    if (!expandNested) return [inferTable(name, rows, recognizeDates)];
    const result = expandNestedJson(name, rows, recognizeDates, rootProperty);
    generatedRelations.push(...result.relations);
    return result.tables;
  };
  if (Array.isArray(parsed)) {
    incoming = definitions(parsed) ? parsed : infer('Records', parsed);
  } else if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.tables) && definitions(parsed.tables)) incoming = parsed.tables;
    else if (typeof parsed.name === 'string' && (parsed.schema || Array.isArray(parsed.data))) incoming = [parsed];
    else {
      const entries = Object.entries(parsed);
      if (entries.length && entries.every(([, value]) => Array.isArray(value))) incoming = entries.flatMap(([name, rows]) => infer(name, rows as unknown[], name));
      else if (expandNested) incoming = infer("Records", [parsed]);
    }
  }
  if (!incoming?.length) throw new Error("The JSON must contain at least one table.");
  let candidate = structuredClone(project);
  for (const item of incoming) {
    if (item && typeof item === 'object' && typeof item.name === 'string' && !item.schema && Array.isArray(item.data)) Object.assign(item, inferTable(item.name, item.data, recognizeDates));
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.name !== "string" || !Array.isArray(item.schema?.fields) || item.schema.fields.some((field: any) => !field || typeof field.name !== "string")) throw new Error("Each table needs a name and schema.fields.");
    const draft = { ...item, id: "", data: [], schema: { ...item.schema, fields: item.schema.fields } } as Dataset;
    const check = tableDefinition(candidate, draft, false);
    if (check.error) throw new Error(check.error);
    if (item.data !== undefined && !Array.isArray(item.data)) throw new Error("Table data must be an array.");
    check.table.data = item.data ?? [];
    candidate.datasets.push(check.table);
  }
  if (generatedRelations.length) candidate.relations = [...(candidate.relations ?? []), ...generatedRelations];
  candidate = validateProject(candidate);
  return candidate;
}
