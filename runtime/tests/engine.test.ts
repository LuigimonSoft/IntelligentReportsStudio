import test from 'node:test';
import assert from 'node:assert/strict';
import { compileReport, createReport, evaluateExpression, renderText, validateProject, wrapText, defaultTextStyle } from '../engine/index.ts';
import { createSampleProject } from './fixtures/legacyProject.ts';

const now = new Date(2026, 9, 9, 12);
const context = { row: { quantity: 12, unitPrice: 150 }, rows: [{ quantity: 12, unitPrice: 150 }, { quantity: 4, unitPrice: 4.5 }, { quantity: 1, unitPrice: 32.99 }], now };
test('original invoice calculations, arithmetic precedence and decimal total', () => {
  assert.equal(evaluateExpression('quantity * unitPrice', context), 1800);
  assert.equal(evaluateExpression('SUM(quantity * unitPrice)', context), 1850.99);
  assert.equal(evaluateExpression('2 + 3 * (4 - 1)', context), 11);
  assert.equal(evaluateExpression('-2 * -3', context), 6);
  assert.equal(evaluateExpression("FORMAT(DATE(), 'm/d/yyyy')", context), '10/9/2026');
  assert.equal(evaluateExpression("FORMAT(DATE(), 'dd/mm/yyyy')", context), '09/10/2026');
});
test('formulas cannot execute JavaScript or access object prototypes', () => {
  assert.throws(() => evaluateExpression('window.alert(1)', context), /Unsupported symbol|Unsupported function/);
  assert.throws(() => evaluateExpression('eval("1")', context), /Unsupported function/);
  assert.equal(evaluateExpression('constructor', { ...context, row: {} }), '');
  assert.throws(() => evaluateExpression('1 / 0', context), /zero/);
  assert.throws(() => evaluateExpression('DATE(1)', context), /arguments/);
  assert.throws(() => evaluateExpression('('.repeat(100) + '1' + ')'.repeat(100), context), /nesting/);
});
test('field templates, newline literals, formatting and page tokens', () => {
  assert.equal(renderText('[quantity]\\n[unitPrice]', context, { locale: 'en-US', currency: 'USD' }, { format: 'text' }), '12\n150');
  assert.equal(renderText('[SUM(quantity * unitPrice)]', context, { locale: 'en-US', currency: 'USD' }, { format: 'currency' }), '$1,850.99');
  assert.equal(renderText("[PAGE_NUMBER] of [PAGE_COUNT]", { ...context, pageNumber: 2, pageCount: 8 }, { locale: 'es-MX', currency: 'USD' }, { format: 'text' }), "2 of 8");
});
test('builder preserves original section order and grouping API', () => {
  const report = createReport().header(1).text('Invoice', 0, 0, 3, 0.3).footer(1)
    .text('[SUM(quantity * unitPrice)]', 0, 0, 3, 0.3).detail(1).data('addresses')
    .text('[name]', 0, 0, 3, 0.3).detail(0.3).data('invoice').text('[description]', 0, 0, 3, 0.3)
    .groupBy('category').header(0.5).text('[category]', 0, 0, 3, 0.3).pageFooter(0.5).text('[PAGE_NUMBER] of [PAGE_COUNT]', 0, 0, 3, 0.3).done();
  assert.equal(report.details.length, 2); assert.equal(report.details[1].groupBy, 'category');
  assert.equal(report.header?.elements[0].text, 'Invoice');
  assert.equal(report.details[1].groupHeader?.elements[0].text, '[category]');
});
test('sample renders fields, category groups, final total and page numbering', () => {
  const project = createSampleProject(); const layout = compileReport(project.report, project.datasets, { now });
  const texts = layout.pages.flatMap(p => p.elements.map(el => el.text));
  assert(texts.some(t => t.includes('Joe Client'))); assert(texts.includes("Expenses")); assert(texts.includes("Professional services"));
  assert(texts.some(t => t.includes('1,850.99'))); assert(texts.includes("1 of 1"));
  assert.equal(layout.pages.length, 1);
});
test('pagination repeats group header and page footer, keeps all rows and prints total once', () => {
  const project = createSampleProject(); const invoice = project.datasets.find(d => d.id === 'invoice')!;
  invoice.data = Array.from({ length: 90 }, (_, i) => ({ category: "Services", description: `Row ${i + 1}`, unitLabel: "Hours", quantity: 1, unitPrice: 10 }));
  const layout = compileReport(project.report, project.datasets, { now });
  assert(layout.pages.length > 3);
  const texts = layout.pages.flatMap(p => p.elements.map(el => el.text));
  assert.equal(texts.filter(t => /^Row \d+$/.test(t)).length, 90);
  assert.equal(texts.filter(t => t === 'Total').length, 1);
  for (const page of layout.pages) {
    assert(page.elements.some(el => el.text === `${page.number} of ${layout.pages.length}`));
    if (page.elements.some(el => /^Row \d+$/.test(el.text))) assert(page.elements.some(el => el.text === "Services"));
    for (const el of page.elements) assert(el.y + el.height <= layout.height - project.report.page.margins.bottom + 0.001);
  }
});
test('group aggregates use group rows, report total uses all invoice rows', () => {
  const project = createSampleProject(); const invoiceSection = project.report.details[1];
  const cell = invoiceSection.band.elements.find(element => element.type === 'text')!;
  invoiceSection.groupFooter = { id: 'group-footer', name: "Group subtotal", height: 0.3,
    elements: [{ ...cell, style: { ...cell.style, format: 'currency' }, groupId: undefined, id: 'group-total', x: 0, width: 3, y: 0, text: '[SUM(quantity * unitPrice)]' }] };
  const texts = compileReport(project.report, project.datasets, { now }).pages.flatMap(p => p.elements.map(el => el.text));
  assert(texts.some(t => t.includes('50.99'))); assert(texts.some(t => t.includes('1,800.00'))); assert(texts.some(t => t.includes('1,850.99')));
});
test('long descriptions wrap and increase row height without losing content', () => {
  const project = createSampleProject(); project.datasets[1].data[0].description = "Development and documentation of an enterprise application with many additional features and business processes";
  const layout = compileReport(project.report, project.datasets, { now });
  const description = layout.pages.flatMap(p => p.elements).find(el => el.text.startsWith('Development and'))!;
  assert(description.lines.length > 1); assert(description.height > 0.3);
  assert.deepEqual(wrapText('abcdefghij', 3, defaultTextStyle, text => text.length), ['abc', 'def', 'ghi', 'j']);
});
test('empty datasets produce a valid invoice with zero total; oversized rows report an error', () => {
  const project = createSampleProject(); project.datasets.forEach(ds => ds.data = []);
  assert.equal(compileReport(project.report, project.datasets).pages.length, 1);
  project.datasets[1].data.push({ category: 'Test', description: 'x', unitLabel: '', quantity: 1, unitPrice: 1 });
  project.report.details[1].band.height = 20;
  assert.throws(() => compileReport(project.report, project.datasets), /too tall|do not fit/);
});
test('validation rejects invalid schema, nonfinite values, remote images and duplicate IDs', () => {
  const project = createSampleProject();
  const invalid = structuredClone(project); invalid.datasets[1].data[0].quantity = NaN;
  assert.throws(() => validateProject(invalid), /Invalid value/);
  const remote = structuredClone(project); remote.report.header!.elements[0].src = 'https://example.com/logo.png';
  assert.throws(() => validateProject(remote), /embedded/);
  const duplicate = structuredClone(project); duplicate.report.header!.elements[0].id = duplicate.report.header!.id;
  assert.throws(() => validateProject(duplicate), /duplicate/);
});

test('section layout preserves blank detail space and anchors report/page footers with empty data', async () => {
  const { sectionHeights } = await import('../tabs/design/report-area/sectionGeometry.ts');
  const project = createSampleProject(); project.datasets[1].data = [];
  const heights = Object.fromEntries(sectionHeights(project.report));
  const layout = compileReport(project.report, project.datasets, { now, sectionHeights: heights });
  assert.equal(layout.pages.length, 1);
  const footer = layout.pages[0].elements.find(el => el.bandId === project.report.footer.id && el.text === 'Total');
  const pageFooter = layout.pages[0].elements.find(el => el.bandId === project.report.pageFooter.id);
  assert(Math.abs(footer.y - (11 - project.report.page.margins.bottom - heights[project.report.footer.id] + 0.2)) < 1e-8);
  assert(Math.abs(pageFooter.y - (11 - project.report.page.margins.bottom - heights[project.report.pageFooter.id] - heights[project.report.footer.id] + 0.1)) < 1e-8);
  assert.equal(layout.pages[0].elements.find(el => el.text === 'ACME').y, project.report.page.margins.top);
});

test('resized detail is a data area rather than a giant repeated row; enlarged page footer matches designer', async () => {
  const { sectionHeights, resizeSectionBoundary } = await import('../tabs/design/report-area/sectionGeometry.ts');
  const project = createSampleProject();
  const measure = (text, style) => text.length * style.fontsize * 0.52 / 72;
  const detail = project.report.details.at(-1).band;
  resizeSectionBoundary(project.report, detail.id, sectionHeights(project.report).get(detail.id) - 0.8, measure);
  resizeSectionBoundary(project.report, project.report.pageFooter.id, 1.2, measure);
  const heights = Object.fromEntries(sectionHeights(project.report));
  const layout = compileReport(project.report, project.datasets, { now, sectionHeights: heights });
  assert.equal(layout.pages.length, 1);
  assert.equal(layout.pages[0].elements.filter(el => el.bandId === detail.id && el.id === detail.elements[0].id).length, 3);
  const footer = layout.pages[0].elements.find(el => el.bandId === project.report.pageFooter.id);
  assert(Math.abs(footer.y - (11 - project.report.page.margins.bottom - heights[project.report.pageFooter.id] - heights[project.report.footer.id] + 0.1)) < 1e-8);
});

test('section layout paginates overflow without losing rows or duplicating final totals', async () => {
  const { sectionHeights } = await import('../tabs/design/report-area/sectionGeometry.ts');
  const project = createSampleProject();
  project.datasets[1].data = Array.from({ length: 90 }, (_, i) => ({ category: "Services", description: `Item ${i + 1}`, unitLabel: "Hours", quantity: 1, unitPrice: 10 }));
  const heights = Object.fromEntries(sectionHeights(project.report));
  const layout = compileReport(project.report, project.datasets, { now, sectionHeights: heights });
  assert(layout.pages.length > 1);
  const elements = layout.pages.flatMap(page => page.elements);
  assert.equal(elements.filter(el => /^Item \d+$/.test(el.text)).length, 90);
  assert.equal(elements.filter(el => el.text === 'Total').length, 1);
  for (const page of layout.pages) {
    const footer = page.elements.find(el => el.bandId === project.report.pageFooter.id);
    const finalFooterHeight = page.number === layout.pages.length ? heights[project.report.footer.id] : 0;
    assert(Math.abs(footer.y - (11 - project.report.page.margins.bottom - heights[project.report.pageFooter.id] - finalFooterHeight + 0.1)) < 1e-8);
  }
});
