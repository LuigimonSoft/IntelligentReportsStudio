import type { PreviewParameter } from '@reportstudio/mini-reports';
export function parameterValues(
  parameters: PreviewParameter[] = [],
  runtime: Record<string, string> = {},
): Record<string, string> {
  return Object.fromEntries(
    parameters.map((p) => [p.id, runtime[p.id] ?? p.value ?? p.defaultValue ?? '']),
  );
}
/** Strip every stored value for parameters that must be requested at preview time. */
export function serializableParameters(parameters: PreviewParameter[]): PreviewParameter[] {
  return parameters.map((parameter) => {
    if (parameter.saveValue !== false) return { ...parameter };
    const { value, defaultValue, ...definition } = parameter;
    return definition;
  });
}
export function persistParameterValues(
  parameters: PreviewParameter[],
  values: Record<string, string>,
): PreviewParameter[] {
  return parameters.map((p) =>
    p.saveValue !== false && Object.hasOwn(values, p.id) ? { ...p, value: values[p.id] } : p,
  );
}
/** Host code can update the currently loaded report without reaching into internal application state. */
export function setReportParameterValues(values: Record<string, string | number | null>): void {
  window.dispatchEvent(new CustomEvent('reportstudio:parameters', { detail: values }));
}

export function expressionParameters(parameters: PreviewParameter[] = [], values: Record<string, string> = {}): Record<string, string | number | boolean> {
  return Object.fromEntries(parameters.map(p => {
    const raw = String(values[p.id] ?? p.value ?? p.defaultValue ?? '');
    return [p.id, raw === '' ? '' : p.type === 'boolean' ? raw === 'true' : p.type === 'number' && Number.isFinite(Number(raw)) ? Number(raw) : raw];
  }));
}

/** Validate ISO calendar dates without accepting JavaScript's date normalization. */
export function validParameterDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  if (year < 1 || month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1];
}
