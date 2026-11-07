import es from '../../i18n/es.json' with { type: 'json' };
import fr from '../../i18n/fr.json' with { type: 'json' };
import { bandsOf, type ReportDefinition } from '@reportstudio/mini-reports';
/** Rename only known legacy labels; user-defined names remain editable. */
export function updateSectionNames(report: ReportDefinition): void {
  upgradeExamplePageHeader(report);
  const names: Record<string, string> = {
    'Page header': 'Page header',
    'Page footer': 'Page footer',
    'Group header': 'Details header',
    'Group footer': 'Details footer',
    'Table header': 'Details header',
    Details: 'Details',
    'Total and closing': 'Report footer',
    'Legacy page header': 'Page header',
    'Legacy details': 'Details',
    'Legacy detail': 'Details',
    'Legacy table header': 'Details header',
  };
  for (const catalog of [es, fr]) {
    for (const [previous, current] of Object.entries({
      ...names,
      'Report header': 'Report header',
      'Details header': 'Details header',
      'Details footer': 'Details footer',
      'Report footer': 'Report footer',
    })) {
      const translated = (catalog as Record<string, string>)[previous];
      if (translated) names[translated] = current;
    }
  }
  for (const band of bandsOf(report)) band.name = names[band.name] ?? band.name;
}

/** Repair only the known invoice example; multiple detail sources are otherwise valid. */
function upgradeExamplePageHeader(report: ReportDefinition): void {
  if (report.id !== 'example-invoice' || report.pageHeader) return;
  const customer = report.details.find(
    (detail) =>
      detail.id === 'example-client-detail' &&
      detail.dataset === 'addresses' &&
      detail.band.id === 'example-customer' &&
      !detail.groupBy &&
      !detail.groupHeader &&
      !detail.groupFooter,
  );
  if (!customer || report.details.length < 2) return;
  const fields = new Set([
    'addressType',
    'name',
    'street1',
    'street2',
    'city',
    'state',
    'zipcode',
    'country',
    'rfc',
  ]);
  function qualify(band: import('@reportstudio/mini-reports').Band): void {
    for (const element of band.elements)
      element.text = element.text.replace(
        /\[([A-Za-z_][A-Za-z_0-9]*)\]/g,
        (match, field: string) => (fields.has(field) ? `[addresses.${field}]` : match),
      );
    for (const child of band.sections ?? []) qualify(child);
  }
  qualify(customer.band);
  customer.band.name = 'Page header';
  report.pageHeader = customer.band;
  report.details = report.details.filter((detail) => detail !== customer);
}
