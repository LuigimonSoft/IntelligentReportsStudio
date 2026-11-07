import type { Field } from './types.ts';

export type SqlDialect = 'mssql' | 'postgresql' | 'mysql';
export type SqlType = { dialect: SqlDialect; name: string; arguments?: string };
export type SqlTypeOption = { name: string; group: string; valueType: Field['type'] };

// SQL metadata describes the database column. valueType describes its JSON transport value.
const definitions: Record<SqlDialect, Record<string, string>> = {
  mssql: {
    Numeric: 'tinyint smallint int bigint decimal numeric money smallmoney float real',
    Boolean: 'bit',
    Text: 'char varchar text nchar nvarchar ntext',
    Temporal: 'date time datetime datetime2 smalldatetime datetimeoffset',
    Binary: 'binary varbinary image rowversion timestamp',
    Other: 'uniqueidentifier xml json geometry geography hierarchyid sql_variant vector',
  },
  postgresql: {
    Numeric:
      'smallint integer int int2 int4 int8 bigint decimal numeric real float4 float8 double precision|smallserial serial bigserial serial2 serial4 serial8 money',
    Boolean: 'boolean bool',
    Text: 'char character varchar character varying|text',
    Temporal:
      'date time time without time zone|time with time zone|timetz timestamp timestamp without time zone|timestamp with time zone|timestamptz interval',
    Binary: 'bytea bit bit varying|varbit',
    Other:
      'uuid json jsonb jsonpath xml point line lseg box path polygon circle cidr inet macaddr macaddr8 tsvector tsquery int4range int8range numrange tsrange tstzrange daterange int4multirange int8multirange nummultirange tsmultirange tstzmultirange datemultirange oid regclass regcollation regconfig regdictionary regnamespace regoper regoperator regproc regprocedure regrole regtype regdatabase pg_lsn txid_snapshot pg_snapshot',
  },
  mysql: {
    Numeric:
      'tinyint smallint mediumint int integer bigint decimal dec numeric fixed float double double precision|real',
    Boolean: 'boolean bool',
    Text: 'char varchar tinytext text mediumtext longtext enum set',
    Temporal: 'date time datetime timestamp year',
    Binary: 'bit binary varbinary tinyblob blob mediumblob longblob',
    Other:
      'json geometry point linestring polygon multipoint multilinestring multipolygon geometrycollection',
  },
};

// A trailing | marks the end of a multiword SQL type name.
function parseNames(names: string): string[] {
  const multiword = [
    'double precision',
    'character varying',
    'timestamp without time zone',
    'timestamp with time zone',
    'time without time zone',
    'time with time zone',
    'bit varying',
  ];
  for (const name of multiword) names = names.replaceAll(name, name.replaceAll(' ', '~'));
  return names
    .replaceAll('|', ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((name) => name.replaceAll('~', ' ').toUpperCase());
}
export const SQL_TYPES: Record<SqlDialect, SqlTypeOption[]> = Object.fromEntries(
  Object.entries(definitions).map(([dialect, groups]) => {
    const options = Object.entries(groups).flatMap(([group, names]) =>
      parseNames(names).map((name) => ({
        name,
        group,
        valueType: (group === 'Numeric'
          ? 'number'
          : group === 'Boolean'
            ? 'boolean'
            : 'text') as Field['type'],
      })),
    );
    if (dialect === 'postgresql')
      options.push(
        ...options.map((option) => ({
          name: `${option.name}[]`,
          group: 'Arrays',
          valueType: 'text' as const,
        })),
      );
    return [dialect, options];
  }),
) as Record<SqlDialect, SqlTypeOption[]>;

export function sqlValueType(sqlType: SqlType): Field['type'] {
  const option = SQL_TYPES[sqlType.dialect]?.find((option) => option.name === sqlType.name);
  if (!option) throw new Error('Unsupported SQL data type for the selected database.');
  return option.valueType;
}
export function sqlTypeLabel(field: Field): string {
  return field.sqlType
    ? `${field.sqlType.name}${field.sqlType.arguments ? `(${field.sqlType.arguments})` : ''}`
    : field.type === 'number'
      ? 'DECIMAL(18, 4)'
      : field.type === 'boolean'
        ? 'BOOLEAN'
        : 'VARCHAR(255)';
}
export function validateSqlType(field: Field): void {
  if (!field.sqlType) return;
  if (field.type !== sqlValueType(field.sqlType))
    throw new Error('SQL data type and JSON value type do not match.');
  const args = field.sqlType.arguments;
  if (
    args !== undefined &&
    (typeof args !== 'string' || args.length > 1000 || /[;\n\r]|--|\/\*|\*\//.test(args))
  )
    throw new Error('Invalid SQL type arguments.');
}
