import type { Dataset, Project } from '../../../engine/types.ts';
import { expandNestedJson } from './nestedJson.ts';

type Row = Record<string, unknown>;
const validKey = (key: string) => /^[A-Za-z_][A-Za-z_0-9]*$/.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key);
const row = (value: unknown): Row => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Nested arrays must contain JSON objects.');
  return value as Row;
};
const pathValue = (value: unknown, path: string): unknown => {
  let current = value;
  for (const key of path.split('.')) {
    if (!validKey(key)) throw new Error('Invalid nested JSON source path.');
    if (current === null || current === undefined) return undefined;
    current = row(current)[key];
  }
  return current;
};
const generated = (project: Project, parent: Dataset, child: Dataset) => (project.relations ?? []).some(relation =>
  relation.from.dataset === parent.id && relation.to.dataset === child.id &&
  /^record_id(?:_\d+)?$/.test(relation.from.field) && /^parent_id(?:_\d+)?$/.test(relation.to.field) &&
  parent.schema.fields.some(f => f.name === relation.from.field && f.type === 'number' && !f.sourcePath) &&
  child.schema.fields.some(f => f.name === relation.to.field && f.type === 'number' && !f.sourcePath));

/** Find the shared source even when the user reloads a child table. */
export function nestedSourceRoot(project: Project, tableId: string): string | undefined {
  let table = project.datasets.find(item => item.id === tableId);
  if (!table) return;
  if (table.schema.nestedSource) {
    const group = table.schema.nestedSource.group;
    return project.datasets.find(item => item.schema.nestedSource?.group === group && item.schema.nestedSource.arrayPath === '')?.id;
  }
  const seen = new Set<string>();
  while (true) {
    if (seen.has(table.id)) return;
    seen.add(table.id);
    const parents = project.datasets.filter(parent => table!.id.startsWith(`${parent.id}_`) && generated(project, parent, table!));
    if (parents.length > 1) return;
    if (!parents.length) break;
    table = parents[0];
  }
  return table.schema.fields.some(field => field.sourcePath?.includes('.')) || project.datasets.some(child => generated(project, table!, child)) ? table.id : undefined;
}

function rootRows(parsed: unknown, property?: string): unknown[] {
  let value = parsed;
  if (property !== undefined) value = row(parsed)[property];
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  throw new Error('The JSON does not contain the original nested data source.');
}

/** Upgrade unambiguous sources imported before source metadata was introduced. */
function adoptLegacy(project: Project, root: Dataset, parsed: unknown): void {
  const property = !Array.isArray(parsed) && parsed && typeof parsed === 'object' && Array.isArray((parsed as Row)[root.id]) ? root.id : undefined;
  const rows = rootRows(parsed, property);
  if (!rows.length) throw new Error('Reload this older nested source with at least one record first.');
  const inferred = expandNestedJson(root.id, rows, false, property);
  for (const item of inferred.tables) {
    const existing = project.datasets.find(table => table.id === item.name);
    if (!existing || existing.schema.nestedSource) throw new Error('The original nested table structure cannot be identified.');
    const meta = item.schema.nestedSource!;
    for (const field of item.schema.fields.filter(field => field.sourcePath)) {
      if (!existing.schema.fields.some(old => old.sourcePath === field.sourcePath)) throw new Error('The original nested fields cannot be identified.');
    }
    for (const key of [meta.idField, meta.parentField].filter(Boolean)) {
      if (!existing.schema.fields.some(field => field.name === key && field.type === 'number' && !field.sourcePath)) throw new Error('The original nested keys cannot be identified.');
    }
    existing.schema.nestedSource = meta;
  }
}

/** Rebuild all related tables before returning a candidate; the original is never mutated. */
export function replaceNestedRecords(project: Project, selected: string, parsed: unknown): {project: Project; root: string; tables: string[]} | undefined {
  const rootId = nestedSourceRoot(project, selected);
  if (!rootId) return;
  const next = structuredClone(project);
  const root = next.datasets.find(table => table.id === rootId)!;
  if (!root.schema.nestedSource) adoptLegacy(next, root, parsed);
  const rootMeta = root.schema.nestedSource!;
  const tables = next.datasets.filter(table => table.schema.nestedSource?.group === rootMeta.group);
  if (!tables.some(table => table.id === selected)) throw new Error('The original nested table structure cannot be identified.');
  const byPath = new Map<string, Dataset>();
  for (const table of tables) {
    const meta = table.schema.nestedSource!;
    if (byPath.has(meta.arrayPath) || meta.rootProperty !== rootMeta.rootProperty || (meta.arrayPath && !meta.arrayPath.endsWith('[]'))) throw new Error('Invalid nested data source structure.');
    byPath.set(meta.arrayPath, table);
  }
  if (byPath.get('') !== root) throw new Error('Invalid nested data source structure.');
  const ids = new Set(tables.map(table => table.id));
  for (const relation of next.relations ?? []) {
    for (const [endpoint, other] of [[relation.from, relation.to], [relation.to, relation.from]]) {
      const table = tables.find(item => item.id === endpoint.dataset);
      if (table && !ids.has(other.dataset) && [table.schema.nestedSource!.idField, table.schema.nestedSource!.parentField].includes(endpoint.field))
        throw new Error('Remove external relationships using generated nested keys before reloading.');
    }
  }
  const children = new Map<string, {table: Dataset; path: string}[]>();
  for (const table of tables) {
    const meta = table.schema.nestedSource!;
    if (!meta.arrayPath) continue;
    const previous = meta.arrayPath.lastIndexOf('[]', meta.arrayPath.length - 3);
    const parentPath = previous < 0 ? '' : meta.arrayPath.slice(0, previous + 2);
    const parent = byPath.get(parentPath);
    const path = meta.arrayPath.slice(parentPath ? parentPath.length + 1 : 0, -2);
    if (!parent || !path || !meta.parentField || !parent.schema.nestedSource!.idField || !(next.relations ?? []).some(relation =>
      (relation.from.dataset === parent.id && relation.from.field === parent.schema.nestedSource!.idField && relation.to.dataset === table.id && relation.to.field === meta.parentField) ||
      (relation.to.dataset === parent.id && relation.to.field === parent.schema.nestedSource!.idField && relation.from.dataset === table.id && relation.from.field === meta.parentField)))
      throw new Error('The nested table relationship is missing or invalid.');
    const list = children.get(parentPath) ?? []; list.push({table, path}); children.set(parentPath, list);
  }
  const update = (table: Dataset, rows: unknown[], parentIds?: number[]) => {
    if (rows.length > 10000) throw new Error('Maximum 10000 rows per source.');
    const meta = table.schema.nestedSource!;
    const batches = (children.get(meta.arrayPath) ?? []).map(child => ({...child, rows: [] as unknown[], ids: [] as number[], found: false}));
    table.data = rows.map((item, index) => {
      const source = row(item), output: Row = {};
      for (const field of table.schema.fields) {
        if (!field.sourcePath) continue;
        const prefix = meta.arrayPath ? `${meta.arrayPath}.` : '';
        if (!field.sourcePath.startsWith(prefix)) throw new Error('Invalid nested JSON source path.');
        const value = pathValue(source, field.sourcePath.slice(prefix.length));
        if (value !== undefined) output[field.name] = value;
      }
      if (meta.idField) output[meta.idField] = index + 1;
      if (meta.parentField) output[meta.parentField] = parentIds?.[index];
      for (const batch of batches) {
        const value = pathValue(source, batch.path);
        if (value === undefined || value === null) continue;
        if (!Array.isArray(value)) throw new Error('Nested JSON contains inconsistent object or array types.');
        batch.found = true;
        for (const item of value) {
          if (batch.rows.length >= 10000) throw new Error('Maximum 10000 rows per source.');
          batch.rows.push(item); batch.ids.push(index + 1);
        }
      }
      return output as Dataset['data'][number];
    });
    for (const batch of batches) {
      if (rows.length && !batch.found) throw new Error('An expected nested array is missing from the JSON.');
      update(batch.table, batch.rows, batch.ids);
    }
  };
  update(root, rootRows(parsed, rootMeta.rootProperty));
  return {project: next, root: rootId, tables: tables.map(table => table.id)};
}
