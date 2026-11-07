import type { Project } from '@reportstudio/mini-reports';
export type PreviewSettings = { values: Record<string, string>; header: boolean; footer: boolean };
export function previewProject(project: Project, settings: PreviewSettings): Project {
  const result = structuredClone(project);
  for (const parameter of project.parameters ?? []) {
    const value = settings.values[parameter.id] ?? parameter.value ?? parameter.defaultValue ?? '';
    if (!value) continue;
    const table = result.datasets.find((table) => table.id === parameter.dataset);
    if (!table) continue;
    table.data = table.data.filter((row) => {
      const raw = row[parameter.field];
      const actual = String(raw ?? '');
      if (parameter.operator === 'gte')
        return (
          raw !== null &&
          raw !== undefined &&
          (typeof raw === 'number' ? raw >= Number(value) : actual >= value)
        );
      if (parameter.operator === 'lte')
        return (
          raw !== null &&
          raw !== undefined &&
          (typeof raw === 'number' ? raw <= Number(value) : actual <= value)
        );
      if (parameter.operator === 'contains')
        return actual.toLocaleLowerCase().includes(value.toLocaleLowerCase());
      return actual === value;
    });
  }
  if (!settings.header) result.report.header = undefined;
  if (!settings.footer) result.report.footer = undefined;
  return result;
}
