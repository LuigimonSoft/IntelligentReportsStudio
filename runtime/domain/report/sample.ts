import type { Project } from '@reportstudio/mini-reports';
import { createCatalogExample } from './sampleCatalog.ts';
import exampleInvoice from '../../data/exampleInvoice.json' with { type: 'json' };
import { bindSourceData } from '../../data/sources.ts';
export { addressFields, invoiceFields, invoiceDatasets } from '../../data/tables.ts';

/** The example is an ordinary editable JSON template backed by a named runtime source. */
export function createSampleProject(kind = 'invoice'): Project {
  return kind === 'invoice' ? bindSourceData(structuredClone(exampleInvoice) as Project) : createCatalogExample(kind);
}
