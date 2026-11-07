import test from 'node:test';
import assert from 'node:assert/strict';
import { chartPoints, defaultChart, compileReport, makeElement, validateProject } from '../engine/index.ts';
import { createChart, createSubreport } from '../domain/report/reportTools.ts';
import { whitespaceProject } from './fixtures/footerWhitespace.ts';
import { templateOnly } from '../data/sources.ts';

const source = { id:'sales',name:'Sales',schema:{fields:[{name:'category',type:'text' as const},{name:'amount',type:'number' as const}]},data:[{category:'A',amount:10},{category:'B',amount:-4},{category:'A',amount:20},{category:'C',amount:null}] };
test('chart bindings aggregate current rows, handle nulls, counts, sorting and limits',()=>{
 const settings=defaultChart(source);
 assert.deepEqual(chartPoints(settings,[source]),[{label:'A',value:30},{label:'B',value:-4}]);
 assert.deepEqual(chartPoints({...settings,aggregation:'average'},[source]),[{label:'A',value:15},{label:'B',value:-4}]);
 assert.deepEqual(chartPoints({...settings,aggregation:'count',value:''},[source]),[{label:'A',value:2},{label:'B',value:1},{label:'C',value:1}]);
 assert.deepEqual(chartPoints({...settings,sort:'ascending',limit:1},[source]),[{label:'B',value:-4}]);
 assert.equal(chartPoints({...settings,category:'missing'},[source]).length,0);
 assert.equal(chartPoints(settings,[]).length,0);
});
test('charts remain editable JSON elements and compile fresh data without persisting snapshots',()=>{
 const project=whitespaceProject(1);project.datasets=[source];project.report.details[0].dataset=source.id;
 const chart=createChart(source);chart.height=1;project.report.header!.elements=[chart];
 validateProject(project);assert.equal(chart.type,'chart');assert.equal(chart.src,'');
 const layout=compileReport(project.report,project.datasets);
 assert.deepEqual(layout.pages[0].elements.find(el=>el.id===chart.id)?.chartData,chartPoints(chart.chart!,[source]));
 const saved=JSON.parse(JSON.stringify(templateOnly(project)));
 assert.deepEqual(saved.report.header.elements[0].chart,chart.chart);
 const imported=createSubreport(layout,7);
 assert.equal(Object.hasOwn(imported.find(element=>element.type==='chart')!, 'chartData'),false);
 assert.equal(saved.report.header.elements[0].chartData,undefined);assert.equal(saved.datasets[0].data.length,0);
 source.data[0].amount=15;
 assert.equal(compileReport(project.report,project.datasets).pages[0].elements.find(el=>el.id===chart.id)?.chartData?.[0].value,35);
 source.data[0].amount=10;
 for(const patch of [{kind:'unknown'},{color:'red'},{limit:0},{aggregation:'eval'}]) {
  const invalid=structuredClone(project);Object.assign(invalid.report.header!.elements[0].chart!,patch);
  assert.throws(()=>validateProject(invalid));
 }
 assert.equal(makeElement('chart',{chart:defaultChart()}).chart?.dataset,'');
});


test('optional category colors survive JSON and reject invalid color dictionaries', () => {
 const project=whitespaceProject(1);
 const chart=createChart(source);chart.height=1;
 project.report.header!.elements=[chart];
 chart.chart!.categoryColors=JSON.parse('{"A":"#ef4444","B":"#22c55e","__proto__":"#123456"}');
 validateProject(project);
 const saved=JSON.parse(JSON.stringify(templateOnly(project)));
 assert.deepEqual(saved.report.header.elements[0].chart.categoryColors,chart.chart!.categoryColors);
 assert.equal(compileReport(project.report,project.datasets).pages[0].elements.find(element=>element.id===chart.id)?.chart?.categoryColors?.A,'#ef4444');
 for(const colors of [null,[],{'A':'red'},{'A':'url(javascript:test)'},Object.fromEntries(Array.from({length:1001},(_,i)=>[String(i),'#112233']))]) {
  const invalid=structuredClone(project);
  Object.assign(invalid.report.header!.elements[0].chart!,{categoryColors:colors});
  assert.throws(()=>validateProject(invalid));
 }
 delete chart.chart!.categoryColors;
 validateProject(project);
});
