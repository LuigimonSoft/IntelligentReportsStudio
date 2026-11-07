import test from 'node:test';
import assert from 'node:assert/strict';
import { compileReport, validateProject, reportFontCss, reportFonts } from '../engine/index.ts';
import { pdfMeasureText, buildPdf } from '../adapters/pdf.ts';
import { whitespaceProject } from './fixtures/footerWhitespace.ts';

test('portable font families survive JSON and use their own PDF metrics and fonts', async () => {
  for (const font of reportFonts) {
    const project = whitespaceProject();
    const element = project.report.details[0].band.elements[0];
    element.style.fontFamily = font.id;
    element.text = 'Wide iii';
    const saved = JSON.parse(JSON.stringify(project));
    validateProject(saved);
    assert.equal(saved.report.details[0].band.elements[0].style.fontFamily, font.id);
    const layout = compileReport(saved.report, saved.datasets, { measureText: pdfMeasureText });
    assert.equal(layout.pages[0].elements.find(item => item.id === element.id)?.style.fontFamily, font.id);
    const pdf = await buildPdf(layout);
    assert.ok((await pdf.save()).length > 0);
    assert.match(reportFontCss(font.id), /Liberation/);
  }
  const style = whitespaceProject().report.details[0].band.elements[0].style;
  assert.notEqual(pdfMeasureText('WWWW', {...style, fontFamily:'serif'}), pdfMeasureText('WWWW', {...style, fontFamily:'monospace'}));
  assert.equal(reportFontCss(), reportFontCss('sans-serif'));
  const original = whitespaceProject();
  assert.equal(original.report.details[0].band.elements[0].style.fontFamily, undefined);
  assert.ok(reportFonts.length >= 12);
  const invalid = whitespaceProject();
  Object.assign(invalid.report.details[0].band.elements[0].style, {fontFamily:'unknown'});
  assert.throws(() => validateProject(invalid), /font family/);
});
