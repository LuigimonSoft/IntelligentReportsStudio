import test from 'node:test';import assert from 'node:assert/strict';
import {compileReport,evaluateExpression,validateProject,bandsOf,sectionDepth,makeBand,makeElement,defaultTextStyle} from '../engine/index.ts';
import {createSampleProject} from '../domain/report/sample.ts';import {templateOnly} from '../data/sources.ts';
const ctx={row:{enabled:true,price:15},rows:[],now:new Date('2026-10-11')};
test('safe expressions support boolean comparisons, precedence, lazy IF and logical operators',()=>{
 assert.equal(evaluateExpression('1 + 2 * 3 >= 7 AND NOT(false)',ctx),true);
 assert.equal(evaluateExpression('IF(price > 10, "#e8f2ff", 1 / 0)',ctx),'#e8f2ff');
 assert.equal(evaluateExpression('false && (1 / 0 > 0)',ctx),false);
 assert.equal(evaluateExpression('enabled == true || false',ctx),true);
 assert.equal(evaluateExpression('AND(enabled, price != 0)',ctx),true);
 assert.throws(()=>evaluateExpression('IF(1,"a","b")',ctx),/boolean/);
 assert.throws(()=>evaluateExpression('globalThis.process.exit()',ctx));
});
function project(){const p=createSampleProject();p.report.header=undefined;p.report.footer=undefined;p.report.pageHeader=undefined;p.report.pageFooter=undefined;const band=makeBand("Details",.2);band.elements.push(makeElement('text',{text:'[price]',height:.15,style:defaultTextStyle}));p.report.details=[{id:'detail',dataset:'rows',band}];p.parameters=[];p.relations=[];p.datasets=[{id:'rows',name:'Rows',schema:{fields:[{name:'enabled',type:'boolean'},{name:'price',type:'number'},{name:'color',type:'text'}]},data:[{enabled:true,price:15,color:'#ff0000'},{enabled:false,price:5,color:'#00ff00'},{enabled:true,price:20,color:'#0000ff'}]}];return p;}
test('nested sections inherit current row, visibility and calculated colors; hidden rows and children collapse',()=>{
 const p=project(),band=p.report.details[0].band;band.visibilityExpression='rows.enabled';band.backgroundExpression='rows.color';const child=makeBand('Child',.2);child.elements.push(makeElement('text',{text:'child [rows.price]',height:.15}));const grandchild=makeBand('Grandchild',.1);grandchild.elements.push(makeElement('text',{text:'nested',height:.05}));child.sections=[grandchild];band.sections=[child];
 const layout=compileReport(p.report,p.datasets);const elements=layout.pages.flatMap(page=>page.elements);assert.deepEqual(elements.filter(e=>e.bandId===child.id).map(e=>e.text),['child 15','child 20']);assert.deepEqual(elements.filter(e=>e.id===`${band.id}-background`).map(e=>e.style.color),['#ff0000','#0000ff']);assert.equal(sectionDepth(p.report,grandchild.id),2);assert.equal(bandsOf(p.report).length,3);
 child.visible=false;const hidden=compileReport(p.report,p.datasets).pages.flatMap(page=>page.elements);assert(!hidden.some(e=>e.bandId===child.id||e.bandId===grandchild.id));assert(hidden.filter(e=>e.id===`${band.id}-background`).every(e=>e.height<.4));
 band.visible=false;assert.equal(compileReport(p.report,p.datasets).pages[0].elements.length,0);
});
test('section settings survive JSON save, reject invalid types/colors and respect schema boolean types',()=>{
 const p=project();const band=p.report.details[0].band;band.visible=true;band.visibilityExpression='enabled';band.background='#e8f2ff';band.sections=[makeBand('Child',.2)];assert.deepEqual(templateOnly(p).report.details[0].band,band);assert.equal(validateProject(p).datasets[0].schema.fields[0].type,'boolean');
 band.visibilityExpression='price';assert.throws(()=>compileReport(p.report,p.datasets),/boolean/);band.visibilityExpression='enabled';band.backgroundExpression='"red"';assert.throws(()=>compileReport(p.report,p.datasets),/#RRGGBB/);band.backgroundExpression=undefined;(band as any).visible='yes';assert.throws(()=>validateProject(p),/visibility/);
});
test('detail headers and footers work without grouping, and qualified aggregates use each row',()=>{
 const p=project();const detail=p.report.details[0];detail.groupHeader=makeBand("Details header",.2);detail.groupHeader.elements=[makeElement('text',{text:'header'})];detail.groupFooter=makeBand("Details footer",.3);detail.groupFooter.elements=[makeElement('text',{text:'[SUM(rows.price)]'})];const elements=compileReport(p.report,p.datasets).pages.flatMap(page=>page.elements);assert.equal(elements.filter(e=>e.bandId===detail.groupHeader!.id).length,1);assert.equal(elements.find(e=>e.bandId===detail.groupFooter!.id)!.text,'40');
});

test('qualified report aggregates use all records rather than the first source row',()=>{const p=project();p.report.footer=makeBand("Report footer",.3);p.report.footer.elements=[makeElement('text',{text:'[SUM(rows.price)]'})];const elements=compileReport(p.report,p.datasets).pages.flatMap(p=>p.elements);assert.equal(elements.find(e=>e.bandId===p.report.footer!.id)!.text,'40');});

test('page-dependent visibility and backgrounds resolve after pagination while reserving header space',()=>{const p=project();p.datasets[0].data=Array.from({length:90},()=>({enabled:true,price:15,color:'#ff0000'}));p.report.pageHeader=makeBand("Page header",.3);p.report.pageHeader.visibilityExpression='PAGE_NUMBER > 1';p.report.pageHeader.backgroundExpression="IF(PAGE_NUMBER == PAGE_COUNT, '#ff0000', '#0000ff')";p.report.pageHeader.elements=[makeElement('text',{text:'[PAGE_NUMBER]'})];const layout=compileReport(p.report,p.datasets);assert(layout.pages.length>1);assert(!layout.pages[0].elements.some(e=>e.bandId===p.report.pageHeader!.id));assert(layout.pages.at(-1)!.elements.some(e=>e.id===p.report.pageHeader!.id+'-background'&&e.style.color==='#ff0000'));});
