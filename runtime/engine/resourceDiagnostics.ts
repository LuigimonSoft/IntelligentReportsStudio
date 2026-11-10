import { bandsOf, reportFonts, reportPdfFontFamily, type ReportDefinition, type ReportLayout } from './index.ts';

/** Inspect the generated pages so hidden or filtered-out elements do not trigger warnings. */
export function resourceDiagnostics(layout: ReportLayout, report: ReportDefinition) {
  const sections = new Map(bandsOf(report).map(section => [section.id, section.name]));
  const result: {kind:string; elementId:string; bandId:string; section:string; resource:string; fallback?:string}[] = [];
  const seen = new Set<string>();
  for (const page of layout.pages) for (const element of page.elements) {
    let kind = '', resource = '', fallback: string | undefined;
    if (element.type === 'image' && !element.src) { kind = 'missing-image'; resource = ''; }
    if (element.type === 'text' && element.style.fontFamily && !['sans-serif','serif','monospace'].includes(element.style.fontFamily)) {
      kind = 'font-fallback';
      resource = reportFonts.find(font => font.id === element.style.fontFamily)?.label ?? element.style.fontFamily;
      const family = reportPdfFontFamily(element.style.fontFamily);
      fallback = family === 'serif' ? 'Times' : family === 'monospace' ? 'Courier' : 'Helvetica';
    }
    if (!kind) continue;
    const key = JSON.stringify([kind, element.bandId, element.id]);
    if (seen.has(key) || result.length >= 50) continue;
    seen.add(key);
    result.push({kind,elementId:element.id,bandId:element.bandId,section:sections.get(element.bandId) ?? element.bandId,resource,...(fallback ? {fallback} : {})});
  }
  return result;
}
