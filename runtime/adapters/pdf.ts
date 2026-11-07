// PDF generation stays outside the dependency-free report engine.
import {
  PDFDocument,
  StandardFonts,
  StandardFontEmbedder,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  rectangle,
  clip,
  endPath,
} from '../vendor/pdf-lib.esm.min.js';
import { lineHeight, reportPdfFontFamily } from '@reportstudio/mini-reports';
import type { MeasureText, ReportLayout, TextStyle } from '@reportstudio/mini-reports';

const fontName = (s: TextStyle) => {
  const names =
    reportPdfFontFamily(s.fontFamily) === 'serif'
      ? [
          StandardFonts.TimesRoman,
          StandardFonts.TimesRomanBold,
          StandardFonts.TimesRomanItalic,
          StandardFonts.TimesRomanBoldItalic,
        ]
      : reportPdfFontFamily(s.fontFamily) === 'monospace'
        ? [
            StandardFonts.Courier,
            StandardFonts.CourierBold,
            StandardFonts.CourierOblique,
            StandardFonts.CourierBoldOblique,
          ]
        : [
            StandardFonts.Helvetica,
            StandardFonts.HelveticaBold,
            StandardFonts.HelveticaOblique,
            StandardFonts.HelveticaBoldOblique,
          ];
  return names[(s.bold ? 1 : 0) + (s.italic ? 2 : 0)];
};
const metrics = new Map(
  Object.values(StandardFonts)
    .filter((name) => /^(Helvetica|Times|Courier)/.test(name))
    .map((name) => [
      name,
      StandardFontEmbedder.for(name as unknown as Parameters<typeof StandardFontEmbedder.for>[0]),
    ]),
);
export const pdfMeasureText: MeasureText = (text, style) =>
  metrics.get(fontName(style))!.widthOfTextAtSize(text, style.fontsize) / 72;
const color = (hex: string) =>
  rgb(
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  );
export async function buildPdf(layout: ReportLayout): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  doc.setTitle(layout.title);
  doc.setCreator('Report Studio / mini-reports');
  const fonts = new Map(
    await Promise.all(
      [...metrics.keys()].map(async (name) => [name, await doc.embedFont(name)] as const),
    ),
  );
  const images = new Map<string, Awaited<ReturnType<PDFDocument['embedPng']>>>();
  for (const page of layout.pages) {
    const sheet = doc.addPage([layout.width * 72, layout.height * 72]);
    // Keep preview and exported PDF content inside all four report margins.
    // Older layouts may omit margins and retain their full-page behavior.
    if (layout.margins) {
      const { left, right, top, bottom } = layout.margins;
      sheet.pushOperators(
        pushGraphicsState(),
        rectangle(left * 72, bottom * 72,
          Math.max(0, layout.width - left - right) * 72,
          Math.max(0, layout.height - top - bottom) * 72),
        clip(),
        endPath(),
      );
    }
    for (const el of page.elements) {
      const x = el.x * 72,
        top = (layout.height - el.y) * 72,
        width = el.width * 72,
        height = el.height * 72;
      const ink = color(el.style.color);
      if (el.type === 'text') {
        const font = fonts.get(fontName(el.style))!;
        sheet.pushOperators(
          pushGraphicsState(),
          rectangle(x, top - height, width, height),
          clip(),
          endPath(),
        );
        for (const [i, line] of el.lines.entries()) {
          const textWidth = font.widthOfTextAtSize(line, el.style.fontsize);
          const left =
            x +
            (el.style.align === 'right'
              ? width - textWidth
              : el.style.align === 'center'
                ? (width - textWidth) / 2
                : 0);
          sheet.drawText(line, {
            x: left,
            y:
              top -
              font.heightAtSize(el.style.fontsize, { descender: false }) -
              i * lineHeight(el.style) * 72,
            size: el.style.fontsize,
            font,
            color: ink,
          });
        }
        sheet.pushOperators(popGraphicsState());
      } else if (el.type === 'shape') {
        const borderWidth = el.borderWidth ?? 1;
        const inset = Math.min(borderWidth / 2, width / 4, height / 4);
        const shapeWidth = width - inset * 2,
          shapeHeight = height - inset * 2;
        const options = {
          color: ink,
          borderColor: color(el.borderColor ?? '#1e40af'),
          borderWidth,
        };
        if (el.shape === 'circle')
          sheet.drawEllipse({
            x: x + width / 2,
            y: top - height / 2,
            xScale: shapeWidth / 2,
            yScale: shapeHeight / 2,
            ...options,
          });
        else if (el.shape === 'rectangle')
          sheet.drawRectangle({
            x: x + inset,
            y: top - height + inset,
            width: shapeWidth,
            height: shapeHeight,
            ...options,
          });
        else {
          const path =
            el.shape === 'triangle'
              ? `M ${shapeWidth / 2} 0 L ${shapeWidth} ${shapeHeight} L 0 ${shapeHeight} Z`
              : `M ${shapeWidth / 2} 0 L ${shapeWidth} ${shapeHeight / 2} L ${shapeWidth / 2} ${shapeHeight} L 0 ${shapeHeight / 2} Z`;
          sheet.drawSvgPath(path, { x: x + inset, y: top - inset, ...options });
        }
      } else if (el.type === 'line') {
        // Match CSS border-top: the stroke occupies the area below the top edge.
        sheet.drawLine({
          start: { x, y: top - height / 2 },
          end: { x: x + width, y: top - height / 2 },
          thickness: height,
          color: ink,
        });
      } else if (el.type === 'box')
        sheet.drawRectangle({
          x: x + (el.borderWidth ?? 0) / 2,
          y: top - height + (el.borderWidth ?? 0) / 2,
          width: width - (el.borderWidth ?? 0),
          height: height - (el.borderWidth ?? 0),
          color: ink,
          borderColor: el.borderColor ? color(el.borderColor) : undefined,
          borderWidth: el.borderWidth ?? 0,
        });
      else if (el.type === 'chart' && el.chart) {
        const { chartPng } = await import('../charts/renderChart.ts');
        const source = await chartPng(el.chart, el.chartData ?? [], width * 2, height * 2);
        const image = await doc.embedPng(source);
        sheet.drawImage(image, { x, y: top - height, width, height });
      } else if (el.src) {
        let image = images.get(el.src);
        if (!image) {
          image = await (el.src.startsWith('data:image/png')
            ? doc.embedPng(el.src)
            : doc.embedJpg(el.src));
          images.set(el.src, image);
        }
        const ratio = Math.min(width / image.width, height / image.height);
        const w = image.width * ratio,
          h = image.height * ratio;
        sheet.drawImage(image, {
          x: x + (width - w) / 2,
          y: top - (height + h) / 2,
          width: w,
          height: h,
        });
      }
    }
    if (layout.margins) sheet.pushOperators(popGraphicsState());
  }
  return doc;
}
// Preview and download share one immutable PDF for each compiled layout.
const pdfCache = new WeakMap<ReportLayout, Promise<Uint8Array>>();
export function pdfBytes(layout: ReportLayout): Promise<Uint8Array> {
  let bytes = pdfCache.get(layout);
  if (!bytes) {
    bytes = buildPdf(layout).then((doc) => doc.save());
    pdfCache.set(layout, bytes);
  }
  return bytes;
}
