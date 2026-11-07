import type { FontFamily } from './types.ts';

/** Portable system stacks; PDF uses the corresponding standard font family. */
export const reportFonts: {
  id: FontFamily;
  label: string;
  css: string;
  pdfFamily?: 'sans-serif' | 'serif' | 'monospace';
}[] = [
  {
    id: 'sans-serif',
    label: 'Arial / Helvetica (sans serif)',
    css: 'Arial, Helvetica, "Liberation Sans", "DejaVu Sans", sans-serif',
  },
  {
    id: 'serif',
    label: 'Times New Roman / Times (serif)',
    css: '"Times New Roman", Times, "Liberation Serif", "DejaVu Serif", serif',
  },
  {
    id: 'monospace',
    label: 'Courier New / Courier (monospace)',
    css: '"Courier New", Courier, "Liberation Mono", "DejaVu Sans Mono", monospace',
  },
  {
    id: 'verdana',
    label: 'Verdana',
    css: 'Verdana, Geneva, "DejaVu Sans", "Liberation Sans", sans-serif',
  },
  {
    id: 'tahoma',
    label: 'Tahoma',
    css: 'Tahoma, Geneva, "DejaVu Sans", "Liberation Sans", sans-serif',
  },
  {
    id: 'trebuchet',
    label: 'Trebuchet MS',
    css: '"Trebuchet MS", "DejaVu Sans", "Liberation Sans", sans-serif',
  },
  {
    id: 'segoe',
    label: 'Segoe UI',
    css: '"Segoe UI", "Helvetica Neue", "DejaVu Sans", "Liberation Sans", sans-serif',
  },
  {
    id: 'system',
    label: 'System font',
    css: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "DejaVu Sans", "Liberation Sans", sans-serif',
  },
  {
    id: 'georgia',
    label: 'Georgia',
    css: 'Georgia, "DejaVu Serif", "Liberation Serif", serif',
    pdfFamily: 'serif',
  },
  {
    id: 'palatino',
    label: 'Palatino',
    css: '"Palatino Linotype", Palatino, "Book Antiqua", "DejaVu Serif", "Liberation Serif", serif',
    pdfFamily: 'serif',
  },
  {
    id: 'garamond',
    label: 'Garamond',
    css: 'Garamond, "Baskerville", "DejaVu Serif", "Liberation Serif", serif',
    pdfFamily: 'serif',
  },
  {
    id: 'consolas',
    label: 'Consolas / Menlo',
    css: 'Consolas, Menlo, Monaco, "DejaVu Sans Mono", "Liberation Mono", monospace',
    pdfFamily: 'monospace',
  },
];
export function reportFontCss(family?: FontFamily): string {
  return (reportFonts.find((font) => font.id === family) ?? reportFonts[0]).css;
}

export function reportPdfFontFamily(family?: FontFamily): 'sans-serif' | 'serif' | 'monospace' {
  if (family === 'serif' || family === 'monospace') return family;
  return reportFonts.find((font) => font.id === family)?.pdfFamily ?? 'sans-serif';
}
export function isReportFontFamily(value: unknown): value is FontFamily {
  return reportFonts.some((font) => font.id === value);
}
