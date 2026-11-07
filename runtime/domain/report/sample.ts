import type { Project } from '@reportstudio/mini-reports';
import exampleInvoice from '../../data/exampleInvoice.json' with { type: 'json' };
import { bindSourceData } from '../../data/sources.ts';
export { addressFields, invoiceFields, invoiceDatasets } from '../../data/tables.ts';

/** The example is an ordinary editable JSON template backed by a named runtime source. */
export function createSampleProject(): Project {
  return bindSourceData(structuredClone(exampleInvoice) as Project);
}
