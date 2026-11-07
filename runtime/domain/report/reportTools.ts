import { defaultTextStyle, makeElement, uid, defaultChart } from '@reportstudio/mini-reports';
import type { Dataset, ReportElement, ReportLayout, ShapeKind } from '@reportstudio/mini-reports';

export { createTable } from './tableElements.ts';

/** Shapes are vector elements with their own geometry and border properties. */
export function createShape(shape: ShapeKind = 'circle'): ReportElement {
  return makeElement('shape', {
    shape,
    width: 0.8,
    height: 0.8,
    borderColor: '#1e40af',
    borderWidth: 1,
    style: { ...defaultTextStyle, color: '#60a5fa' },
  });
}

export function createChart(dataset: Dataset): ReportElement {
  return makeElement('chart', { width: 4, height: 2.4, chart: defaultChart(dataset) });
}

/** Import the rendered child report as editable elements, without external dependencies. */
export function createSubreport(layout: ReportLayout, width: number): ReportElement[] {
  const ratio = Math.min(1, width / layout.width);
  return layout.pages.flatMap((page, pageIndex) =>
    page.elements.map(({ chartData: _chartData, lines, bandId: _bandId, ...element }) => ({
      ...element,
      id: uid('subreport'),
      x: element.x * ratio,
      y: (element.y + pageIndex * layout.height) * ratio,
      width: element.width * ratio,
      height: element.height * ratio,
      text: element.type === 'text' ? lines.join('\n') : element.text,
      style: { ...element.style, fontsize: element.style.fontsize * ratio },
    })),
  );
}
