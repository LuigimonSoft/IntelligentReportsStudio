import type { Project } from '@reportstudio/mini-reports';
import { createCatalogExample } from './sampleCatalog.ts';
import exampleInvoice from '../../data/exampleInvoice.json' with { type: 'json' };
import { bindSourceData } from '../../data/sources.ts';
import appleSales from '../../../examples/apple-sales/apple-sales-template.json' with { type: 'json' };
import appleSalesData from '../../../examples/apple-sales/apple-sales-data.json' with { type: 'json' };
import awbForm from '../../../examples/awb/awb-full-form-template.json' with { type: 'json' };
import awbDataOnly from '../../../examples/awb/awb-data-only-template.json' with { type: 'json' };
import awbSampleData from '../../../examples/awb/awb-sample-data.json' with { type: 'json' };
import { validateProject } from '@reportstudio/mini-reports';
export { addressFields, invoiceFields, invoiceDatasets } from '../../data/tables.ts';

/** The example is an ordinary editable JSON template backed by a named runtime source. */
export function createSampleProject(kind = 'invoice'): Project {
  if (kind === 'invoice') return bindSourceData(structuredClone(exampleInvoice) as Project);
  if (kind === 'apple-sales') {
    const project = structuredClone(appleSales) as Project;
    const tables = appleSalesData.tables as Record<string, Project['datasets'][number]['data']>;
    for (const table of project.datasets) table.data = structuredClone(tables[table.id] ?? []);
    return validateProject(project);
  }
  if (kind === 'awb-form' || kind === 'awb-data-only') {
    const project = structuredClone(kind === 'awb-form' ? awbForm : awbDataOnly) as Project;
    const rows = awbSampleData as Record<string, Project['datasets'][number]['data']>;
    for (const table of project.datasets) table.data = structuredClone(rows[table.id] ?? []);
    return validateProject(project);
  }
  return createCatalogExample(kind);
}
