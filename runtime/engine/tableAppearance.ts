import { evaluateExpression } from './expressions.ts';
import type { ExpressionContext, ReportElement } from './types.ts';

/** Formula backgrounds share the row context used by the table's text fields. */
export function tableBackground(element: ReportElement, context: ExpressionContext): string {
  if (!element.table || !element.cell) return element.style.color;
  const { row, column } = element.cell;
  const styles = element.table.styles;
  const appearance = {
    ...styles.table,
    ...styles[`column:${column}`],
    ...styles[`row:${row}`],
    ...styles[`cell:${row}:${column}`],
  };
  const source = appearance.backgroundExpression?.trim();
  if (!source) return appearance.background ?? element.style.color;
  const value = evaluateExpression(
    source.replace(/^\[(.*)\]$/s, '$1').replace(/^\{(.*)\}$/s, '$1'),
    {
      ...context,
      tableRowNumber: row + 1,
      columnNumber: column + 1,
    },
  );
  if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value))
    throw new Error('The table background formula must return a hex color such as #e5e7eb.');
  return value;
}
