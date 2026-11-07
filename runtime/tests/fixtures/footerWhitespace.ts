import { makeElement, bandsOf } from '../../engine/index.ts';
import { createBlankProject } from '../../domain/report/blankProject.ts';
export function whitespaceProject(count = 3) {
  const project = createBlankProject('Footer whitespace');
  const report = project.report;
  report.header!.height = 1.45;
  report.header!.elements = [makeElement('text', { id: 'title', text: 'INVOICE', height: .3 })];
  report.pageHeader!.height = 1.55;
  report.pageHeader!.elements = [makeElement('text', { id: 'customer', text: 'Customer', height: .3 })];
  const detail = report.details[0]; detail.dataset = 'rows';
  detail.groupHeader!.height = .3;
  detail.groupHeader!.elements = [makeElement('text', { id: 'columns', text: 'Description', height: .2 })];
  detail.band.height = .4;
  detail.band.elements = [makeElement('text', { id: 'row', text: '[description]', width: 3, height: .3 })];
  detail.groupFooter!.height = .93;
  detail.groupFooter!.elements = [makeElement('text', { id: 'total', text: 'TOTAL', height: .3 })];
  report.footer!.height = .68;
  report.footer!.elements = [makeElement('text', { id: 'notes', text: 'Notes', height: .2 })];
  report.pageFooter!.height = report.page.height - bandsOf(report).filter(band => band.id !== report.pageFooter!.id).reduce((sum, band) => sum + band.height, 0);
  report.pageFooter!.elements = [makeElement('line', { id: 'footer-line', y: report.pageFooter!.height - .38, width: 7, height: .01 }),
    makeElement('text', { id: 'page', text: 'Page [PAGE_NUMBER] of [PAGE_COUNT]', y: report.pageFooter!.height - .26, height: .2, width: 3 })];
  project.datasets = [{ id: 'rows', name: 'Rows', schema: { fields: [{ name: 'description', type: 'text' }] }, data: Array.from({ length: count }, (_, index) => ({ description: `Item ${index + 1}` })) }];
  return project;
}

