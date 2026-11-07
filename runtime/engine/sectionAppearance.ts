import { evaluateExpression } from './expressions.ts';
import type { Band, ExpressionContext } from './types.ts';
const expression = (source: string) =>
  source
    .trim()
    .replace(/^\[(.*)\]$/s, '$1')
    .replace(/^\{(.*)\}$/s, '$1');
export function sectionAppearance(
  band: Band,
  context: ExpressionContext,
): { visible: boolean; background?: string } {
  if (band.visible === false) return { visible: false };
  if (band.visibilityExpression?.trim()) {
    const result = evaluateExpression(expression(band.visibilityExpression), context);
    if (typeof result !== 'boolean')
      throw new Error(`The visibility of ${band.name} must return a boolean value.`);
    if (!result) return { visible: false };
  }
  let background = band.background;
  if (band.backgroundExpression?.trim()) {
    const value = evaluateExpression(expression(band.backgroundExpression), context);
    if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value))
      throw new Error(`The background of ${band.name} must return a #RRGGBB color.`);
    background = value;
  }
  return { visible: true, background };
}
