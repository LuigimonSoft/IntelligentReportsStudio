import { ensureDefaultSections } from './defaultSections.ts';
import { defaultTextStyle, makeBand, makeElement, uid } from './types.ts';
import type { Band, DetailSection, ReportDefinition, TextStyle } from './types.ts';

/** Subset of the fluent API observed in the legacy HTML artifact, implemented independently. */
export class ReportBuilder {
  private def: ReportDefinition;
  private current?: Band;
  private detailSection?: DetailSection;
  private groupMode = false;
  constructor(title = 'New report') {
    this.def = {
      version: 1,
      id: uid('report'),
      title,
      locale: 'en-US',
      currency: 'USD',
      page: {
        width: 8.5,
        height: 11,
        margins: { top: 0.75, right: 0.75, bottom: 0.75, left: 0.75 },
      },
      details: [],
    };
  }
  name(title: string): this {
    this.def.title = title;
    return this;
  }
  page(width: number, height: number, units: 'inches' | 'mm' = 'inches'): this {
    const factor = units === 'mm' ? 1 / 25.4 : 1;
    this.def.page.width = width * factor;
    this.def.page.height = height * factor;
    return this;
  }
  margins(top: number, right = top, bottom = top, left = right): this {
    this.def.page.margins = { top, right, bottom, left };
    return this;
  }
  header(height: number): this {
    const band = makeBand(this.groupMode ? 'Details header' : 'Report header', height);
    if (this.groupMode && this.detailSection) this.detailSection.groupHeader = band;
    else this.def.header = band;
    this.current = band;
    return this;
  }
  footer(height: number): this {
    const band = makeBand(this.groupMode ? 'Details footer' : 'Report footer', height);
    if (this.groupMode && this.detailSection) this.detailSection.groupFooter = band;
    else this.def.footer = band;
    this.current = band;
    return this;
  }
  pageHeader(height: number): this {
    this.current = this.def.pageHeader = makeBand('Page header', height);
    return this;
  }
  pageFooter(height: number): this {
    this.current = this.def.pageFooter = makeBand('Page footer', height);
    return this;
  }
  detail(height: number): this {
    this.groupMode = false;
    const band = makeBand('Details', height);
    this.detailSection = { id: uid('section'), dataset: '', band };
    this.def.details.push(this.detailSection);
    this.current = band;
    return this;
  }
  data(dataset: string): this {
    if (!this.detailSection) throw new Error('Call detail() before data().');
    this.detailSection.dataset = dataset;
    this.detailSection.band.name = 'Details';
    return this;
  }
  groupBy(field: string, _sortField = field, direction: 'asc' | 'desc' = 'asc'): this {
    if (!this.detailSection) throw new Error('groupBy() requires a detail section.');
    this.detailSection.groupBy = field;
    this.detailSection.sortDirection = direction;
    this.groupMode = true;
    return this;
  }
  private band(): Band {
    if (!this.current) throw new Error('Create a section before adding elements.');
    return this.current;
  }
  text(
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    options: Partial<TextStyle> = {},
  ): this {
    this.band().elements.push(
      makeElement('text', {
        text,
        x,
        y,
        width,
        height,
        style: { ...defaultTextStyle, ...options },
      }),
    );
    return this;
  }
  image(src: string, x: number, y: number, width: number, height: number): this {
    this.band().elements.push(makeElement('image', { src, x, y, width, height }));
    return this;
  }
  line(x: number, y: number, width: number, color = '#cbd5cf'): this {
    this.band().elements.push(
      makeElement('line', { x, y, width, height: 0.015, style: { ...defaultTextStyle, color } }),
    );
    return this;
  }
  box(x: number, y: number, width: number, height: number, color = '#eef3ef'): this {
    this.band().elements.push(
      makeElement('box', { x, y, width, height, style: { ...defaultTextStyle, color } }),
    );
    return this;
  }
  done(): ReportDefinition {
    if (!this.def.details.length) throw new Error('Each report requires detail().');
    const report = structuredClone(this.def);
    ensureDefaultSections(report);
    return report;
  }
}
export const createReport = (title?: string): ReportBuilder => new ReportBuilder(title);
