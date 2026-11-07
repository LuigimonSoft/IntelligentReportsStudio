import { makeBand, type ReportDefinition } from './types.ts';

export const REPORT_SECTION_NAMES = {
  header: 'Report header',
  pageHeader: 'Page header',
  footer: 'Report footer',
  pageFooter: 'Page footer',
} as const;
export const DETAIL_SECTION_NAMES = {
  header: 'Details header',
  detail: 'Details',
  footer: 'Details footer',
} as const;

/** Fill missing roles without changing existing IDs, contents or visibility. */
export function ensureDefaultSections(report: ReportDefinition, visible = true): void {
  const create = (name: string) => ({ ...makeBand(name, 0.35), visible });
  for (const key of ['header', 'pageHeader', 'pageFooter', 'footer'] as const)
    report[key] ??= create(REPORT_SECTION_NAMES[key]);
  for (const detail of report.details) {
    detail.groupHeader ??= create(DETAIL_SECTION_NAMES.header);
    detail.groupFooter ??= create(DETAIL_SECTION_NAMES.footer);
  }
}

/** The four report roles and the first detail's three roles always remain present. */
export function isDefaultSection(report: ReportDefinition, bandId: string): boolean {
  const detail = report.details[0];
  return [
    report.header,
    report.pageHeader,
    detail?.groupHeader,
    detail?.band,
    detail?.groupFooter,
    report.pageFooter,
    report.footer,
  ].some((band) => band?.id === bandId);
}
