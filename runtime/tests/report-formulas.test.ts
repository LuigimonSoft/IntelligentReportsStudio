import test from 'node:test';
import assert from 'node:assert/strict';
import { compileReport, evaluateExpression, validateProject } from '../engine/index.ts';
import { whitespaceProject } from './fixtures/footerWhitespace.ts';
import { templateOnly, bindSourceData } from '../data/sources.ts';
import { sectionHeights } from '../tabs/design/report-area/sectionGeometry.ts';

test('named formulas resolve dependencies per record and can be reused by totals, preview and saved JSON',()=>{
 const project=whitespaceProject();project.datasets[0].schema.fields.push({name:'quantity',type:'number'},{name:'price',type:'number'});
 project.datasets[0].data.forEach((row,index)=>{row.quantity=index+1;row.price=10;});
 project.report.formulas=[{name:'LineTotal',expression:'quantity * price'},{name:'GrandTotal',expression:'SUM(LineTotal)'},{name:'Stripe',expression:"IF(MOD(ROW_NUMBER, 2) = 1, '#e5e7eb', '#ffffff')"}];
 project.report.details[0].band.elements[0].text='[LineTotal]';project.report.details[0].groupFooter!.elements[0].text='[GrandTotal]';
 const layout=compileReport(project.report,project.datasets,{sectionHeights:Object.fromEntries(sectionHeights(project.report))});
 const elements=layout.pages.flatMap(page=>page.elements);assert.deepEqual(elements.filter(el=>el.id==='row').map(el=>el.text),['10','20','30']);assert.equal(elements.find(el=>el.id==='total')!.text,'60');
 const saved=templateOnly(project);assert.deepEqual(saved.report.formulas,project.report.formulas);assert.equal(saved.datasets[0].data.length,0);
 assert.deepEqual(bindSourceData(JSON.parse(JSON.stringify(saved))).report.formulas,project.report.formulas);
});
test('formula definitions reject duplicates, special names and invalid syntax; cycles fail safely',()=>{
 const project=whitespaceProject();
 for(const formulas of [[{name:'ROW_NUMBER',expression:'1'}],[{name:'Bad name',expression:'1'}],[{name:'A',expression:'('}],[{name:'A',expression:'1'},{name:'A',expression:'2'}]]) {
   project.report.formulas=formulas;assert.throws(()=>validateProject(project));
 }
 const context={row:{},rows:[],now:new Date(),formulas:[{name:'A',expression:'B + 1'},{name:'B',expression:'A + 1'}]};
 assert.throws(()=>evaluateExpression('A',context),/Circular formula/);
 assert.equal(evaluateExpression("IF(true, 2 + 3, 0)",{row:{},rows:[],now:new Date()}),5);
});

test('page-dependent named formulas reserve sections and resolve separately on each page',()=>{
 const project=whitespaceProject(80);
 project.report.formulas=[{name:'ShowLater',expression:'PAGE_NUMBER > 1'}];
 project.report.pageHeader!.visibilityExpression='ShowLater';
 const layout=compileReport(project.report,project.datasets,{sectionHeights:Object.fromEntries(sectionHeights(project.report))});
 assert(layout.pages.length>1);
 assert.equal(layout.pages[0].elements.some(el=>el.id==='customer'),false);
 assert.equal(layout.pages[1].elements.some(el=>el.id==='customer'),true);
});
