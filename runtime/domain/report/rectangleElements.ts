import { bandsOf, type ReportDefinition } from '@reportstudio/mini-reports';

/** Upgrade standalone rectangles without converting table cell backgrounds. */
export function upgradeRectangles(report: ReportDefinition): void {
  for (const band of bandsOf(report)) {
    band.elements = band.elements.map((element) =>
      element.type === 'box' && !element.table && !element.groupId
        ? {
            ...element,
            type: 'shape',
            shape: 'rectangle',
            borderColor: element.borderColor ?? '#cbd5e1',
            borderWidth: element.borderWidth ?? 0,
          }
        : element,
    );
  }
}
