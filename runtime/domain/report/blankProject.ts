import {
  ensureDefaultSections,
  makeBand,
  uid,
  validateProject,
  type Dataset,
  type Project,
} from '@reportstudio/mini-reports';

/** Unbound visual tables may be designed before any data source is added. */
export const UNBOUND_TABLE_SOURCE: Dataset = { id: '', name: '', schema: { fields: [] }, data: [] };

export function createBlankProject(title = 'New report'): Project {
  const project: Project = {
    version: 1,
    report: {
      version: 1,
      id: uid('report'),
      title,
      locale: 'en-US',
      currency: 'MXN',
      page: {
        width: 210 / 25.4,
        height: 297 / 25.4,
        margins: { top: 0.4, right: 0.4, bottom: 0.4, left: 0.4 },
      },
      details: [{ id: uid('detail'), dataset: '', band: makeBand('Details', 0.4) }],
    },
    datasets: [],
  };
  ensureDefaultSections(project.report);
  return validateProject(project);
}
export type StartupDocument = 'example' | 'blank';
export function startupDocumentMode(
  configured: string | undefined,
  development: boolean,
): StartupDocument {
  return configured === 'example' || configured === 'blank'
    ? configured
    : development
      ? 'example'
      : 'blank';
}
