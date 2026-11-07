import { createReport, rootBandsOf } from '@reportstudio/mini-reports';
import type { Project } from '@reportstudio/mini-reports';

import { createTable } from '../../domain/report/reportTools.ts';
import { createInitialTables } from '../../data/tables.ts';
export { addressFields, invoiceFields, invoiceDatasets } from '../../data/tables.ts';

export function createSampleProject(): Project {
  const report = createReport("Service invoice")
    .margins(0.75)
    .header(1)
    .text('ACME', 0, 0, 2, 0.35, { fontsize: 22, bold: true, color: '#244d3e' })
    .text('SOLUTIONS LLC', 0, 0.38, 3, 0.2, { fontsize: 8, color: '#657b70' })
    .text("INVOICE", 4, 0, 3, 0.3, { align: 'right', fontsize: 18, bold: true })
    .text("[=FORMAT(DATE(), 'dd/mm/yyyy')]", 4, 0.4, 3, 0.25, { align: 'right', color: '#657b70' })
    .line(0, 0.85, 7)
    .footer(1)
    .line(0, 0, 7)
    .text('Total', 3, 0.2, 2.5, 0.3, { align: 'right', bold: true, fontsize: 12 })
    .text('[SUM(quantity * unitPrice)]', 5.5, 0.2, 1.5, 0.3, {
      align: 'right',
      bold: true,
      fontsize: 12,
      format: 'currency',
    })
    .text('Gracias por confiar en nosotros.', 0, 0.7, 7, 0.25, {
      align: 'center',
      color: '#657b70',
    })
    .detail(1.1)
    .data('addresses')
    .text('[addressType]', 0, 0, 0.6, 0.25, { bold: true })
    .text('[name]\\n[street1]\\n[city], [state] [zipcode]\\n[country]', 0.75, 0, 5, 0.85)
    .detail(0.4)
    .data('invoice')
    .text('[description]', 0, 0.04, 3, 0.3)
    .text('[quantity]', 3, 0.04, 1, 0.3, { align: 'center', format: 'number' })
    .text('[unitPrice]', 4, 0.04, 1.5, 0.3, { align: 'right', format: 'currency' })
    .text('[=quantity * unitPrice]', 5.5, 0.04, 1.5, 0.3, { align: 'right', format: 'currency' })
    .groupBy('category')
    .header(0.6)
    .box(0, 0.08, 7, 0.42)
    .text('[category]', 0.1, 0.18, 2.8, 0.25, { bold: true })
    .text('[unitLabel]', 3, 0.18, 1, 0.25, { align: 'center', bold: true, fontsize: 9 })
    .text("Rate", 4, 0.18, 1.5, 0.25, { align: 'right', bold: true, fontsize: 9 })
    .text('Subtotal', 5.5, 0.18, 1.4, 0.25, { align: 'right', bold: true, fontsize: 9 })
    .pageFooter(0.45)
    .text("ACME · Professional services", 0, 0.1, 4.5, 0.25, { fontsize: 8, color: '#657b70' })
    .text("[PAGE_NUMBER] of [PAGE_COUNT]", 5, 0.1, 2, 0.25, {
      align: 'right',
      fontsize: 8,
      color: '#657b70',
    })
    .done();
  // The original fixture omitted these roles; keep its pagination unchanged.
  for (const band of rootBandsOf(report)) if (!band.elements.length) band.visible = false;
  const datasets = createInitialTables();
  const concepts = report.details.find((detail) => detail.dataset === 'invoice')!;
  concepts.band.elements = createTable(
    datasets.find((dataset) => dataset.id === 'invoice')!,
    7,
  );
  concepts.band.height = 0.7;
  return { version: 1, report, datasets };
}
