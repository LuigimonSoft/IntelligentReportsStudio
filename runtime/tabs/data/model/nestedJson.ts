import { uid, type Dataset, type TableRelation } from '../../../engine/index.ts';
import { inferTable } from './inferTables.ts';

type Row = Record<string, unknown>;
type Shape = 'object' | 'array' | 'value';
export type NestedImport = { tables: Dataset[]; relations: TableRelation[] };

/** Turn nested objects into columns and arrays of objects into related child tables. */
export function expandNestedJson(name: string, records: unknown[], recognizeDates: boolean): NestedImport {
  const result: NestedImport = { tables: [], relations: [] };
  if (!records.length) throw new Error('An empty array needs an explicit table schema.');
  const visit = (tableName: string, input: unknown[], prefix: string, parent?: { table: string; key: string; ids: number[] }, depth = 0): void => {
    if (depth > 8) throw new Error('Nested JSON exceeds the maximum depth.');
    if (input.length > 10000) throw new Error('Maximum 10000 rows per source.');
    const shape = new Map<string, Shape>();
    const objects = input.map(value => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Nested arrays must contain JSON objects.');
      return value as Row;
    });
    function inspect(object: Row, path: string[] = []): void {
      if (path.length > 8) throw new Error('Nested JSON exceeds the maximum depth.');
      for (const [key, value] of Object.entries(object)) {
        if (!/^[A-Za-z_][A-Za-z_0-9]*$/.test(key) || ['__proto__','constructor','prototype'].includes(key))
          throw new Error('Use unique column names with letters, numbers and underscores.');
        const parts = [...path, key], full = parts.join('.');
        if (value === null) continue;
        const kind: Shape = Array.isArray(value) ? 'array' : typeof value === 'object' ? 'object' : 'value';
        if (shape.has(full) && shape.get(full) !== kind) throw new Error('Nested JSON contains inconsistent object or array types.');
        shape.set(full, kind);
        if (kind === 'object') inspect(value as Row, parts);
      }
    }
    objects.forEach(row => inspect(row));
    const children = new Map<string, { rows: unknown[]; ids: number[] }>();
    for (const [path, kind] of shape) if (kind === 'array') children.set(path, {rows:[],ids:[]});
    const paths = new Map<string, string>();
    const flat = objects.map((row, index) => {
      const output: Row = {};
      function flatten(object: Row, path: string[] = []): void {
        for (const [key, value] of Object.entries(object)) {
          const parts = [...path, key], full = parts.join('.'), kind = shape.get(full);
          if (kind === 'array') {
            if (value === null) continue;
            if (!Array.isArray(value)) throw new Error('Nested JSON contains inconsistent object or array types.');
            const child = children.get(full)!;
            for (const record of value) { child.rows.push(record); child.ids.push(index + 1); }
          } else if (kind === 'object') {
            if (value !== null) flatten(value as Row, parts);
          } else {
            const alias = parts.join('_'), origin = prefix ? `${prefix}.${full}` : full;
            if (paths.has(alias) && paths.get(alias) !== origin) throw new Error('Nested JSON fields produce duplicate column names.');
            paths.set(alias, origin); output[alias] = value;
          }
        }
      }
      flatten(row); return output;
    });
    const used = new Set([...paths.keys()]);
    const reserve = (base: string) => { let name = base, n = 2; while (used.has(name)) name = `${base}_${n++}`; used.add(name); return name; };
    const id = children.size || parent ? reserve('record_id') : '';
    const parentId = parent ? reserve('parent_id') : '';
    flat.forEach((row,index) => { if (id) row[id] = index + 1; if (parentId) row[parentId] = parent!.ids[index]; });
    let table: Dataset;
    if (flat.length) table = inferTable(tableName, flat, recognizeDates);
    else table = {id:'',name:tableName,schema:{fields:[{name:id,type:'number'},{name:parentId,type:'number'}]},data:[]};
    table.schema.fields = table.schema.fields.map(field => paths.has(field.name) ? {...field,sourcePath:paths.get(field.name)!} : field);
    result.tables.push(table);
    if (parent) result.relations.push({id:uid('relationship'),from:{dataset:parent.table,field:parent.key},to:{dataset:tableName,field:parentId},cardinality:'1:n'});
    for (const [path, child] of children) {
      const childName = `${tableName}_${path.replaceAll('.','_')}`;
      const origin = prefix ? `${prefix}.${path}[]` : `${path}[]`;
      visit(childName, child.rows, origin, {table:tableName,key:id,ids:child.ids}, depth+1);
    }
  };
  visit(name, records, '');
  return result;
}
