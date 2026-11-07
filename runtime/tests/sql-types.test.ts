import test from 'node:test';
import assert from 'node:assert/strict';
import { SQL_TYPES, sqlValueType, sqlTypeLabel, validateDatasets } from '../engine/index.ts';
import { parseTablesResponse } from '../adapters/tablesApi.ts';
import { fieldType } from '../tabs/data/model/modelHelpers.ts';

test('SQL catalogs contain provider-specific native types and PostgreSQL arrays', () => {
  for (const [dialect, names] of Object.entries({ mssql: ['DATETIMEOFFSET', 'UNIQUEIDENTIFIER', 'ROWVERSION', 'VECTOR'], postgresql: ['DOUBLE PRECISION', 'TIMESTAMP WITH TIME ZONE', 'JSONB', 'INET', 'INT4RANGE', 'INTEGER[]'], mysql: ['MEDIUMINT', 'ENUM', 'SET', 'LONGBLOB', 'GEOMETRYCOLLECTION'] })) {
    const catalog = SQL_TYPES[dialect as keyof typeof SQL_TYPES];
    assert.equal(new Set(catalog.map(type => type.name)).size, catalog.length);
    for (const name of names) assert(catalog.some(type => type.name === name), `${dialect}: ${name}`);
  }
  assert.equal(sqlValueType({ dialect: 'mssql', name: 'BIT' }), 'boolean');
  assert.equal(sqlValueType({ dialect: 'mysql', name: 'BIT' }), 'text');
});

test('every SQL type survives the API/JSON pipeline with the correct transport value', () => {
  for (const dialect of ['mssql', 'postgresql', 'mysql'] as const) for (const option of SQL_TYPES[dialect]) {
    const field = { name: 'value', type: option.valueType, sqlType: { dialect, name: option.name } };
    const value = field.type === 'number' ? 12.5 : field.type === 'boolean' ? true : 'serialized value';
    const table = { id: 'example', name: 'Example', schema: { fields: [field] }, data: [{ value }, { value: null }] };
    assert.deepEqual(parseTablesResponse(JSON.parse(JSON.stringify([table]))), [table]);
    assert.equal(fieldType(table, field), option.name);
  }
});

test('SQL metadata validates dialect, native type, transport and arguments', () => {
  const table = { id: 't', name: 'T', schema: { fields: [{ name: 'price', type: 'number', sqlType: { dialect: 'mysql', name: 'DECIMAL', arguments: '18, 4' } }] }, data: [] };
  assert.equal(sqlTypeLabel(table.schema.fields[0] as never), 'DECIMAL(18, 4)');
  assert.doesNotThrow(() => validateDatasets([table]));
  for (const patch of [{ dialect: 'unknown' }, { name: 'JSONB' }, { arguments: '); DROP TABLE t;' }]) {
    const bad = structuredClone(table); Object.assign(bad.schema.fields[0].sqlType, patch);
    assert.throws(() => validateDatasets([bad]));
  }
  table.schema.fields[0].type = 'text';
  assert.throws(() => validateDatasets([table]), /do not match/);
  assert.doesNotThrow(() => validateDatasets([{ id: 'legacy', name: 'Legacy', schema: { fields: [{ name: 'value', type: 'text' }] }, data: [{ value: 'ok' }] }]));
});
