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
