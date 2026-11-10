import { chartKinds } from './charts.ts';
import { isReportFontFamily } from './fonts.ts';
import { validateExpression } from './expressions.ts';
import { validateSqlType } from './sqlTypes.ts';
import { bandsOf } from './types.ts';
import type { Project, ReportDefinition, Dataset } from './types.ts';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected a JSON object.');
  return value as Record<string, unknown>;
}
function number(value: unknown, min: number, max: number, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    throw new Error(`${name} must be between ${min} and ${max}.`);
  return value;
}
function text(value: unknown, name: string, max = 10000): string {
  if (typeof value !== 'string' || value.length > max)
    throw new Error(`${name} is not valid text.`);
  return value;
}
export function validateReport(input: unknown): ReportDefinition {
  const report = object(input);
  if (report.version !== 1) throw new Error('Unsupported report version.');
  text(report.id, 'ID', 200);
  text(report.title, 'Title', 200);
  if (report.formulas !== undefined) {
    if (!Array.isArray(report.formulas) || report.formulas.length > 100)
      throw new Error('Maximum 100 formulas per report.');
    const names = new Set<string>();
    for (const input of report.formulas) {
      const formula = object(input);
      const name = text(formula.name, 'Formula name', 100);
      if (
        !/^[A-Za-z_][A-Za-z_0-9]*$/.test(name) ||
        names.has(name) ||
        [
          '__proto__',
          'constructor',
          'prototype',
          'TRUE',
          'FALSE',
          'NULL',
          'AND',
          'OR',
          'NOT',
          'IF',
          'IIF',
          'FIELD',
          'SUM',
          'MOD',
          'DATE',
          'FORMAT',
          'PAGE_NUMBER',
          'PAGE_COUNT',
          'ROW_NUMBER',
          'ROW_COUNT',
          'TABLE_ROW_NUMBER',
          'COLUMN_NUMBER',
          'IS_ODD_ROW',
        ].includes(name.toUpperCase()) ||
        ['__proto__', 'constructor', 'prototype'].includes(name)
      )
        throw new Error('Use a unique formula name with letters, numbers and underscores.');
      if (!text(formula.expression, 'Formula expression', 2048).trim())
        throw new Error('Enter a formula expression.');
      validateExpression(String(formula.expression));
      names.add(name);
    }
  }
  const locale = text(report.locale, 'Language', 30);
  const currency = text(report.currency, 'Currency', 3);
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Use a three-letter ISO currency.');
  try {
    new Intl.NumberFormat(locale, { style: 'currency', currency });
  } catch {
    throw new Error('Invalid locale or currency.');
  }
  const page = object(report.page);
  const margins = object(page.margins);
  if (page.background !== undefined && !/^#[0-9a-fA-F]{6}$/.test(String(page.background)))
    throw new Error('Invalid page background color.');
  const width = number(page.width, 3, 30, 'Page width');
  const height = number(page.height, 3, 40, 'Page height');
  for (const key of ['top', 'right', 'bottom', 'left']) number(margins[key], 0, 10, 'Margen');
  const contentWidth = width - Number(margins.left) - Number(margins.right);
  if (contentWidth < 0.5 || height - Number(margins.top) - Number(margins.bottom) < 0.5)
    throw new Error('Margins leave no room on the page.');
  if (!Array.isArray(report.details) || !report.details.length || report.details.length > 20)
    throw new Error('Between 1 and 20 data sections are required.');
  const ids = new Set<string>();
  const uniqueId = (value: unknown) => {
    const id = text(value, 'ID', 200);
    if (!id || ids.has(id)) throw new Error('Empty or duplicate IDs.');
    ids.add(id);
  };
  let sectionCount = 0;
  const validateNestedBand = (input: unknown, depth: number) => band(input, depth);
  function band(input: unknown, depth = 0) {
    if (depth > 8 || ++sectionCount > 100)
      throw new Error('Maximum 100 sections and 8 subsection levels.');
    const band = object(input);
    uniqueId(band.id);
    text(band.name, 'Section name', 200);
    number(band.height, 0.05, 30, 'Section height');
    if (band.visible !== undefined && typeof band.visible !== 'boolean')
      throw new Error('Invalid section visibility.');
    if (band.readOnly !== undefined && typeof band.readOnly !== 'boolean')
      throw new Error('Invalid section read-only flag.');
    if (band.pageBreakBefore !== undefined && typeof band.pageBreakBefore !== 'boolean')
      throw new Error('Invalid page break setting.');
    if (depth > 0 && band.pageBreakBefore === true)
      throw new Error('Page breaks are available only for root sections.');
    for (const key of ['visibilityExpression', 'backgroundExpression'])
      if (band[key] !== undefined) text(band[key], 'Section expression', 2048);
    if (band.background !== undefined && !/^#[0-9a-fA-F]{6}$/.test(String(band.background)))
      throw new Error('Invalid section color.');
    if (band.sections !== undefined) {
      if (!Array.isArray(band.sections)) throw new Error('Invalid subsections.');
      for (const child of band.sections) validateNestedBand(child, depth + 1);
    }
    if (!Array.isArray(band.elements) || band.elements.length > 200)
      throw new Error('Maximum 200 elements per section.');
    for (const input of band.elements) {
      const el = object(input);
      uniqueId(el.id);
      for (const key of ['visible', 'locked'])
        if (el[key] !== undefined && typeof el[key] !== 'boolean')
          throw new Error(`Invalid element ${key}.`);
      if (el.groupId !== undefined) text(el.groupId, 'Table group', 200);
      if (!['text', 'image', 'line', 'box', 'shape', 'chart'].includes(String(el.type)))
        throw new Error('Unsupported element type.');
      if (el.type === 'chart') {
        const chart = object(el.chart);
        if (!(chartKinds as readonly string[]).includes(String(chart.kind)))
          throw new Error('Invalid chart type.');
        for (const key of ['dataset', 'category', 'value', 'title'])
          text(chart[key], 'Chart binding', 500);
        if (!['sum', 'average', 'count', 'min', 'max'].includes(String(chart.aggregation)))
          throw new Error('Invalid chart aggregation.');
        if (!['source', 'ascending', 'descending'].includes(String(chart.sort)))
          throw new Error('Invalid chart sort.');
        const limit = number(chart.limit, 1, 200, 'Chart limit');
        if (!Number.isInteger(limit)) throw new Error('Invalid chart limit.');
        for (const key of ['color', 'background'])
          if (!/^#[0-9a-fA-F]{6}$/.test(String(chart[key])))
            throw new Error('Invalid chart color.');
        if (chart.categoryColors !== undefined) {
          const colors = object(chart.categoryColors);
          if (Object.keys(colors).length > 1000) throw new Error('Maximum 1000 category colors.');
          for (const [label, color] of Object.entries(colors)) {
            text(label, 'Chart category', 10000);
            if (!/^#[0-9a-fA-F]{6}$/.test(String(color))) throw new Error('Invalid chart color.');
          }
        }
        for (const key of ['showLegend', 'showLabels', 'showGrid'])
          if (typeof chart[key] !== 'boolean') throw new Error('Invalid chart option.');
      }
      if (el.type === 'shape') {
        if (!['circle', 'triangle', 'diamond', 'rectangle'].includes(String(el.shape)))
          throw new Error('Invalid shape.');
        if (!/^#[0-9a-fA-F]{6}$/.test(String(el.borderColor)))
          throw new Error('Invalid border color.');
        number(el.borderWidth, 0, 12, 'Border width');
      }
      if (el.table !== undefined) {
        const table = object(el.table);
        const rows = number(table.rows, 1, 20, 'Table rows');
        const columns = number(table.columns, 1, 12, 'Table columns');
        if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows * columns > 80)
          throw new Error('Maximum 80 cells per table.');
        if (typeof table.headers !== 'boolean') throw new Error('Invalid headers.');
        text(table.dataset, 'Data table', 200);
        number(table.width, 0.12 * columns, 30, 'Table width');
        number(table.rowHeight, 0.15, 1, 'Row height');
        for (const input of Object.values(object(table.styles))) {
          const appearance = object(input);
          if (appearance.backgroundExpression !== undefined)
            text(appearance.backgroundExpression, 'Table background expression', 2048);
          for (const key of ['background', 'color', 'borderColor'])
            if (appearance[key] !== undefined && !/^#[0-9a-fA-F]{6}$/.test(String(appearance[key])))
              throw new Error('Invalid cell color.');
          if (appearance.verticalAlign !== undefined && !['top', 'middle', 'bottom'].includes(String(appearance.verticalAlign))) throw new Error('Invalid vertical alignment.');
          if (appearance.fontFamily !== undefined && !isReportFontFamily(appearance.fontFamily))
            throw new Error('Invalid font family.');
          if (appearance.fontsize !== undefined) number(appearance.fontsize, 6, 48, 'Text size');
          for (const key of ['bold', 'italic', 'underline'])
            if (appearance[key] !== undefined && typeof appearance[key] !== 'boolean')
              throw new Error('Invalid text formatting.');
          if (
            appearance.format !== undefined &&
            !['text', 'number', 'currency', 'percent', 'date'].includes(String(appearance.format))
          )
            throw new Error('Invalid value format.');
          if (appearance.borderWidth !== undefined)
            number(appearance.borderWidth, 0, 6, 'Cell border');
          if (
            appearance.align !== undefined &&
            !['left', 'center', 'right'].includes(String(appearance.align))
          )
            throw new Error('Invalid cell alignment.');
        }
        for (const value of Object.values(object(table.contents))) text(value, 'Cell content');
        const cell = object(el.cell);
        number(cell.row, 0, rows - 1, 'Cell row');
        number(cell.column, 0, columns - 1, 'Cell column');
      }
      if (el.borderColor !== undefined && !/^#[0-9a-fA-F]{6}$/.test(String(el.borderColor)))
        throw new Error('Invalid border color.');
      if (el.borderWidth !== undefined) number(el.borderWidth, 0, 12, 'Border width');
      if (el.table !== undefined) {
        const table = object(el.table);
        if (table.rowHeights !== undefined) {
          if (!Array.isArray(table.rowHeights) || table.rowHeights.length !== table.rows)
            throw new Error('Invalid row heights.');
          table.rowHeights.forEach((height) => number(height, 0.15, 1, 'Row height'));
        }
        if (table.columnWidths !== undefined) {
          if (!Array.isArray(table.columnWidths) || table.columnWidths.length !== table.columns)
            throw new Error('Invalid column widths.');
          const widths = table.columnWidths.map((width) =>
            number(width, 0.12, 30, 'Column width'),
          );
          if (Math.abs(widths.reduce((sum, width) => sum + width, 0) - Number(table.width)) > 0.001)
            throw new Error('Column widths do not match the table.');
        }
      }
      number(el.x, 0, 30, 'X position');
      number(el.y, 0, 30, 'Y position');
      number(el.width, 0.01, 30, 'Width');
      number(el.height, 0.005, 30, 'Height');
      // Saved objects may extend past the current margins or paper size after
      // page settings change. The PDF renderer clips them to the printable area.
      text(el.text, 'Content');
      const src = text(el.src, 'Image', 3_000_000);
      if (src && !/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=\s]+$/.test(src))
        throw new Error('Only embedded PNG or JPEG images are supported.');
      const style = object(el.style);
      number(style.fontsize, 5, 96, 'Font size');
      if (style.fontFamily !== undefined && !isReportFontFamily(style.fontFamily))
        throw new Error('Invalid font family.');
      if (!/^#[0-9a-fA-F]{6}$/.test(String(style.color))) throw new Error('Invalid color.');
      if (!['left', 'center', 'right'].includes(String(style.align)))
        throw new Error('Invalid alignment.');
      if (!['text', 'number', 'currency', 'percent', 'date'].includes(String(style.format)))
        throw new Error('Invalid format.');
      if (style.verticalAlign !== undefined && !['top', 'middle', 'bottom'].includes(String(style.verticalAlign))) throw new Error('Invalid vertical alignment.');
      if (style.underline !== undefined && typeof style.underline !== 'boolean') throw new Error('Invalid style.');
      for (const flag of ['wrap', 'bold', 'italic'])
        if (typeof style[flag] !== 'boolean') throw new Error('Invalid style.');
    }
  }
  for (const detailInput of report.details) {
    const detail = object(detailInput);
    uniqueId(detail.id);
    text(detail.dataset, 'Data source', 100);
    if (detail.emptyMessage !== undefined) text(detail.emptyMessage, 'Empty message', 1000);
    if (detail.groupBy !== undefined) text(detail.groupBy, 'Grouping field', 100);
    if (
      detail.sortDirection !== undefined &&
      !['asc', 'desc'].includes(String(detail.sortDirection))
    )
      throw new Error('Invalid grouping order.');
    if (detail.groups !== undefined) {
      if (!Array.isArray(detail.groups) || detail.groups.length + (detail.groupBy ? 1 : 0) > 10) throw new Error('Maximum 10 grouping levels per detail.');
      const fields = new Set<string>();
      for (const entry of detail.groups) {
        const group = object(entry); uniqueId(group.id);
        const field = text(group.field, 'Grouping field', 100);
        if (!field || fields.has(field)) throw new Error('Select a different field for each group.');
        fields.add(field);
        if (!['asc', 'desc'].includes(String(group.direction))) throw new Error('Invalid grouping order.');
        band(group.header); band(group.footer);
      }
    }
    band(detail.band);
    if (detail.groupHeader) band(detail.groupHeader);
    if (detail.groupFooter) band(detail.groupFooter);
  }
  for (const key of ['header', 'footer', 'pageHeader', 'pageFooter']) {
    if (report[key]) {
      if (key !== 'footer' && object(report[key]).pageBreakBefore === true)
        throw new Error('Page breaks are not available for report or page headers and page footers.');
      band(report[key]);
    }
  }
  return structuredClone(input) as ReportDefinition;
}
export function validateDatasets(input: unknown): Dataset[] {
  if (!Array.isArray(input) || input.length > 20) throw new Error('Invalid data source list.');
  const ids = new Set<string>();
  for (const value of input) {
    const ds = object(value);
    const id = text(ds.id, 'Source ID', 100);
    text(ds.name, 'Source name', 200);
    if (!id || ids.has(id)) throw new Error('Duplicate or empty source IDs.');
    ids.add(id);
    const schema = object(ds.schema);
    if (!Array.isArray(schema.fields) || schema.fields.length > 100)
      throw new Error('Invalid schema.');
    const names = new Set<string>();
    for (const value of schema.fields) {
      const field = object(value);
      const name = text(field.name, 'Field', 100);
      if (
        !/^[A-Za-z_][A-Za-z_0-9]*$/.test(name) ||
        ['__proto__', 'constructor', 'prototype'].includes(name) ||
        names.has(name)
      )
        throw new Error('Invalid or duplicate field name.');
      if (field.sourcePath !== undefined) text(field.sourcePath, 'Source path', 200);
      if (!['text', 'number', 'boolean'].includes(String(field.type)))
        throw new Error('Invalid field type.');
      if (field.sqlType !== undefined) {
        object(field.sqlType);
        validateSqlType(field as import('./types.ts').Field);
      }
      names.add(name);
    }
    if (schema.nestedSource !== undefined) {
      const source = object(schema.nestedSource);
      if (!text(source.group, 'Nested source group', 100)) throw new Error('Invalid nested source group.');
      text(source.arrayPath, 'Nested array path', 200);
      if (source.rootProperty !== undefined && !text(source.rootProperty, 'Nested root property', 100)) throw new Error('Invalid nested root property.');
      for (const key of ['idField', 'parentField']) if (source[key] !== undefined) {
        const name = text(source[key], 'Nested key', 100);
        if (!schema.fields.some(value => { const field = object(value); return field.name === name && field.type === 'number' && field.sourcePath === undefined; })) throw new Error('Invalid nested key.');
      }
      if (!!source.arrayPath !== !!source.parentField) throw new Error('Invalid nested source parent.');
    }
    if (!Array.isArray(ds.data) || ds.data.length > 10000)
      throw new Error('Maximum 10000 rows per source.');
    for (const value of ds.data) {
      const row = object(value);
      for (const fieldInput of schema.fields) {
        const field = object(fieldInput);
        const v = row[String(field.name)];
        if (
          v !== null && v !== undefined &&
          (field.type === 'number'
            ? typeof v !== 'number' || !Number.isFinite(v)
            : field.type === 'boolean'
              ? typeof v !== 'boolean'
              : typeof v !== 'string')
        )
          throw new Error(`Invalid value in ${String(field.name)}.`);
      }
      for (const v of Object.values(row))
        if (v !== null && !['string', 'number', 'boolean'].includes(typeof v))
          throw new Error('Invalid row data.');
    }
  }
  return structuredClone(input) as Dataset[];
}
export function validateProject(input: unknown): Project {
  const obj = object(input);
  if (obj.version !== 1) throw new Error('Unsupported project version.');
  if (obj.schemaVersion !== undefined && obj.schemaVersion !== 1) throw new Error('Unsupported report schema version.');
  const report = validateReport(obj.report);
  const datasets = validateDatasets(obj.datasets);
  for (const detail of report.details) {
    if (detail.dataset === '') {
      if (detail.groupBy || detail.groups?.length) throw new Error('An unbound detail cannot group records.');
      continue;
    }
    const ds = datasets.find((ds) => ds.id === detail.dataset);
    if (!ds) throw new Error(`Data source ${detail.dataset} is missing.`);
    if (detail.groupBy && !ds.schema.fields.some((f) => f.name === detail.groupBy))
      throw new Error(`Unknown grouping field: ${detail.groupBy}`);
    for (const group of detail.groups ?? []) if (!ds.schema.fields.some(f => f.name === group.field))
      throw new Error(`Unknown grouping field: ${group.field}`);
  }
  if (bandsOf(report).length > 100) throw new Error('Too many sections.');
  let relations: Project['relations'];
  if (obj.relations !== undefined) {
    if (!Array.isArray(obj.relations) || obj.relations.length > 200)
      throw new Error('Maximum 200 relationships.');
    const relationIds = new Set<string>();
    for (const value of obj.relations) {
      const relation = object(value);
      const id = text(relation.id, 'Relationship ID', 200);
      if (!id || relationIds.has(id)) throw new Error('Duplicate or empty relationship ID.');
      relationIds.add(id);
      if (!['1:1', '1:n', 'n:1', 'n:n'].includes(String(relation.cardinality)))
        throw new Error('Invalid cardinality.');
      for (const endpoint of [relation.from, relation.to]) {
        const ref = object(endpoint);
        const ds = datasets.find((ds) => ds.id === ref.dataset);
        if (!ds?.schema.fields.some((field) => field.name === ref.field))
          throw new Error('The relationship references an unknown table or column.');
      }
    }
    relations = structuredClone(obj.relations) as Project['relations'];
  }
  let parameters: Project['parameters'];
  if (obj.parameters !== undefined) {
    if (!Array.isArray(obj.parameters) || obj.parameters.length > 30)
      throw new Error('Invalid parameters.');
    const ids = new Set<string>();
    parameters = obj.parameters.map((value) => {
      const parameter = object(value);
      const id = text(parameter.id, 'Parameter ID', 200);
      const label = text(parameter.label, 'Parameter label', 200);
      const dataset = text(parameter.dataset, 'Parameter table', 200);
      const field = text(parameter.field, 'Parameter field', 200);
      if (
        !id ||
        ids.has(id) ||
        !datasets
          .find((table) => table.id === dataset)
          ?.schema.fields.some((column) => column.name === field)
      )
        throw new Error('Invalid parameter reference.');
      ids.add(id);
      if (
        !['date', 'select', 'text', 'number', 'boolean'].includes(String(parameter.type)) ||
        !['gte', 'lte', 'eq', 'contains'].includes(String(parameter.operator))
      )
        throw new Error('Invalid parameter type.');
      if (parameter.saveValue !== undefined && typeof parameter.saveValue !== 'boolean')
        throw new Error('Invalid parameter value persistence.');
      if (parameter.required !== undefined && typeof parameter.required !== 'boolean') throw new Error('Invalid required parameter flag.');
      return {
        id,
        label,
        dataset,
        field,
        ...(parameter.required !== undefined ? { required: parameter.required as boolean } : {}),
        type: parameter.type,
        operator: parameter.operator,
        ...(parameter.value !== undefined
          ? { value: text(parameter.value, 'Parameter value', 200) }
          : {}),
        ...(parameter.saveValue !== undefined ? { saveValue: parameter.saveValue as boolean } : {}),
        ...(parameter.defaultValue !== undefined
          ? { defaultValue: text(parameter.defaultValue, 'Parameter value', 200) }
          : {}),
      } as NonNullable<Project['parameters']>[number];
    });
  }
  let dataModel: Project['dataModel'];
  if (obj.dataModel !== undefined) {
    const tables = object(object(obj.dataModel).tables);
    dataModel = { tables: {} };
    const rootDataset = object(obj.dataModel).rootDataset;
    if (rootDataset !== undefined) {
      const id = text(rootDataset, "Parent table", 100);
      if (!datasets.some((table) => table.id === id)) throw new Error("Unknown parent table.");
      dataModel.rootDataset = id;
    }
    for (const [id, value] of Object.entries(tables)) {
      const dataset = datasets.find((table) => table.id === id);
      if (!dataset) continue;
      const settings = object(value);
      const entry: NonNullable<Project['dataModel']>['tables'][string] = {};
      for (const key of ['x', 'y'] as const)
        if (settings[key] !== undefined)
          entry[key] = number(settings[key], 0, 100000, 'Table position');
      if (settings.alias !== undefined) entry.alias = text(settings.alias, 'Alias', 100);
      if (settings.color !== undefined) {
        if (!/^#[0-9a-fA-F]{6}$/.test(String(settings.color)))
          throw new Error('Invalid table color.');
        entry.color = String(settings.color);
      }
      if (settings.hiddenFields !== undefined) {
        if (
          !Array.isArray(settings.hiddenFields) ||
          settings.hiddenFields.some(
            (name) => !dataset.schema.fields.some((field) => field.name === name),
          )
        )
          throw new Error('Unknown hidden column.');
        entry.hiddenFields = [...new Set(settings.hiddenFields)] as string[];
      }
      dataModel.tables[id] = entry;
    }
  }
  let dataSource: Project['dataSource'];
  if (obj.dataSource !== undefined) {
    const name = text(object(obj.dataSource).name, 'Data source name', 200);
    if (!name.trim()) throw new Error('The data source requires a name.');
    dataSource = { name };
  }
  return {
    version: 1,
    schemaVersion: 1,
    ...(parameters ? { parameters } : {}),
    ...(dataModel ? { dataModel } : {}),
    report,
    datasets,
    ...(dataSource ? { dataSource } : {}),
    ...(relations ? { relations } : {}),
  };
}
