import type { Dataset, Field } from '../../../engine/types.ts';
import { validParameterDate } from '../../../shared/parameters/reportParameters.ts';

/** Infer a flat, typed table without silently coercing or discarding JSON values. */
export function inferTable(name: string, records: unknown[], recognizeDates = false): Dataset {
  if (!records.length) throw new Error('An empty array needs an explicit table schema.');
  if (records.length > 10000) throw new Error('Maximum 10000 rows per source.');
  const types = new Map<string, Set<string>>();
  for (const item of records) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Each record must be a JSON object.');
    for (const [key, value] of Object.entries(item)) {
      if (!/^[A-Za-z_][A-Za-z_0-9]*$/.test(key) || key.length > 100 || ['__proto__','constructor','prototype'].includes(key))
        throw new Error('Use unique column names with letters, numbers and underscores.');
      if (value !== null && !['string', 'number', 'boolean'].includes(typeof value))
        throw new Error('Nested objects and arrays require an explicit flat data source.');
      const observed = types.get(key) ?? new Set<string>();
      if (value !== null) observed.add(typeof value);
      types.set(key, observed);
    }
  }
  if (!types.size || types.size > 100) throw new Error('Tables require between 1 and 100 columns.');
  const fields: Field[] = [...types].map(([field, observed]) => {
    if (observed.size > 1) throw new Error(`Column has mixed data types: ${field}`);
    const type = observed.values().next().value;
    const values = records.map(row => (row as Record<string, unknown>)[field]).filter(value => value != null);
    const isDate = recognizeDates && type === 'string' && values.length > 0 && values.every(value => typeof value === 'string' && validParameterDate(value));
    return { name: field, type: type === 'number' ? 'number' : type === 'boolean' ? 'boolean' : 'text',
      ...(isDate ? {sqlType: {dialect:'mssql' as const, name:'DATE'}} : {}) };
  });
  // Preserve absent properties; they are distinct from an explicit JSON null.
  const data = records.map(item => Object.fromEntries(fields.filter(field => Object.hasOwn(item as object, field.name)).map(field => [field.name, (item as Record<string, unknown>)[field.name]]))) as Dataset['data'];
  return {id: '', name, schema: {fields}, data};
}
