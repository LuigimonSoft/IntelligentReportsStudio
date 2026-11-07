import { validateDatasets, validateProject } from '@reportstudio/mini-reports';
import type { Dataset, Project } from '@reportstudio/mini-reports';

/** API contract: a table array or { tables: [...] }, using the same shape as TABLES. */
export function parseTablesResponse(payload: unknown): Dataset[] {
  const tables =
    payload && typeof payload === 'object' && !Array.isArray(payload) && 'tables' in payload
      ? (payload as { tables: unknown }).tables
      : payload;
  return validateDatasets(tables);
}
export async function loadTablesFromApi(
  url: string,
  options: { request?: RequestInit; fetcher?: typeof fetch } = {},
): Promise<Dataset[]> {
  const response = await (options.fetcher ?? fetch)(url, options.request);
  if (!response.ok) throw new Error(`Unable to load tables: HTTP ${response.status}.`);
  return parseTablesResponse(await response.json());
}
/** Validate before replacing state: report and relationship references must still exist. */
export function projectWithTables(project: Project, tables: Dataset[]): Project {
  return validateProject({ ...project, datasets: tables });
}
