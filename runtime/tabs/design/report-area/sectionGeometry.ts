import { bandsOf, lineHeight, wrapText } from '@reportstudio/mini-reports';
import type { Band, MeasureText, ReportDefinition } from '@reportstudio/mini-reports';

/** Preserve a section's explicit height while growing to contain edited elements. */
export function contentHeight(band: Band, measure: MeasureText): number {
  return Math.max(
    0.15,
    ...band.elements.map((el) => {
      const textHeight =
        el.type === 'text' && !el.text.includes('[')
          ? wrapText(el.text.replace(/\\n/g, '\n'), el.width, el.style, measure).length *
            lineHeight(el.style)
          : 0;
      return el.y + Math.max(el.height, textHeight) + 0.05;
    }),
  );
}

/** Design heights reflect each section's assigned size. */
export function sectionHeights(report: ReportDefinition): Map<string, number> {
  return new Map(bandsOf(report).map(band => [band.id, band.height]));
}

/** Resize this section independently, keeping its contents visible. */
export function resizeSectionBoundary(
  report: ReportDefinition,
  bandId: string,
  height: number,
  measure: MeasureText,
): void {
  const band = bandsOf(report).find(section => section.id === bandId);
  if (!band || !Number.isFinite(height)) return;
  if (band.id === report.footer?.id && band.elements.length) {
    const leading = Math.min(...band.elements.map(element => element.y));
    const shift = Math.min(leading, Math.max(0, contentHeight(band, measure) - height));
    if (shift > 0) for (const element of band.elements) element.y -= shift;
  }
  band.height = Math.max(contentHeight(band, measure), height);
}
