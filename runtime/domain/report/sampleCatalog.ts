import { createBlankProject } from './blankProject.ts';
import { defaultTextStyle, makeElement, validateProject, type Dataset, type Project, type TextStyle } from '@reportstudio/mini-reports';

type Column = { key: string; title: string; width: number; type: 'text' | 'number'; format?: TextStyle['format'] };
type Example = { title: string; subtitle: string; table: string; columns: Column[]; rows: Dataset['data']; total?: { label: string; field: string } };
const catalog: Record<string, Example> = {
  quotation: {
    title:'Service quotation', subtitle:'Example quotation · editable sample data', table:'quotationItems',
    columns:[{key:'description',title:'Description',width:3.15,type:'text'}, {key:'quantity',title:'Quantity',width:1.0,type:'number'}, {key:'unitPrice',title:'Unit price',width:1.4,type:'number',format:'currency'}, {key:'subtotal',title:'Subtotal',width:1.55,type:'number',format:'currency'}],
    rows:[{description:'Implementation consulting',quantity:10,unitPrice:1200,subtotal:12000},{description:'Report development',quantity:20,unitPrice:1000,subtotal:20000},{description:'Training',quantity:4,unitPrice:800,subtotal:3200}],
    total:{label:'Estimated total',field:'subtotal'},
  },
  products: {
    title:'Product list', subtitle:'Example catalog · editable sample data', table:'products',
    columns:[{key:'name',title:'Product',width:2.75,type:'text'}, {key:'category',title:'Category',width:1.7,type:'text'}, {key:'price',title:'Unit price',width:1.4,type:'number',format:'currency'}, {key:'stock',title:'In stock',width:1.25,type:'number'}],
    rows:[{name:'Notebook',category:'Office',price:90,stock:35},{name:'Desk lamp',category:'Equipment',price:450,stock:12},{name:'Monitor stand',category:'Equipment',price:680,stock:8}],
  },
  sales: {
    title:'Sales report', subtitle:'Example sales · editable sample data', table:'sales',
    columns:[{key:'date',title:'Date',width:1.45,type:'text'}, {key:'customer',title:'Customer',width:2.5,type:'text'}, {key:'region',title:'Region',width:1.5,type:'text'}, {key:'amount',title:'Amount',width:1.65,type:'number',format:'currency'}],
    rows:[{date:'2026-10-01',customer:'Example customer A',region:'North',amount:12500},{date:'2026-10-03',customer:'Example customer B',region:'Central',amount:18400},{date:'2026-10-05',customer:'Example customer C',region:'South',amount:7600}],
    total:{label:'Total sales',field:'amount'},
  },
};

/** Examples are normal editable reports; data remains session-only when saved. */
export function createCatalogExample(key: string): Project {
  const example = catalog[key];
  if (!example) throw new Error('Unknown example template.');
  const project = createBlankProject(example.title);
  const report = project.report;
  const dataset: Dataset = {id:example.table, name:example.title, schema:{fields:example.columns.map(column=>({name:column.key,type:column.type}))}, data:structuredClone(example.rows)};
  project.datasets = [dataset];
  project.dataSource = {name:'Example data'};
  report.details[0].dataset = dataset.id;
  const header = report.header!, detail = report.details[0], columnHeader = detail.groupHeader!, body = detail.band, totals = detail.groupFooter!, footer = report.pageFooter!;
  header.height = 0.9;
  header.elements.push(makeElement('text',{text:example.title.toUpperCase(),x:0,y:0.08,width:6.7,height:0.34,style:{...defaultTextStyle,fontsize:18,bold:true,color:'#10213c'}}));
  header.elements.push(makeElement('text',{text:example.subtitle,x:0,y:0.52,width:6.7,height:0.2,style:{...defaultTextStyle,fontsize:9,color:'#64748b'}}));
  report.pageHeader!.height = 0.1;
  columnHeader.height = 0.38;
  body.height = 0.34;
  const totalWidth = example.columns.reduce((sum,column)=>sum+column.width,0);
  columnHeader.elements.push(makeElement('box',{x:0,y:0,width:totalWidth,height:0.36,style:{...defaultTextStyle,color:'#e9eef5'}}));
  let x = 0;
  for (const column of example.columns) {
    const align = column.type === 'number' ? 'right' : 'left';
    columnHeader.elements.push(makeElement('text',{text:column.title,x:x+0.05,y:0.08,width:column.width-0.1,height:0.2,style:{...defaultTextStyle,fontsize:9,bold:true,align,color:'#10213c'}}));
    body.elements.push(makeElement('text',{text:`[${column.key}]`,x:x+0.05,y:0.06,width:column.width-0.1,height:0.2,style:{...defaultTextStyle,fontsize:9,align,format:column.format ?? (column.type === 'number' ? 'number' : 'text'),color:'#10213c'}}));
    x += column.width;
  }
  totals.height = 0.42;
  if (example.total) {
    totals.elements.push(makeElement('text',{text:example.total.label,x:3.4,y:0.1,width:2.05,height:0.2,style:{...defaultTextStyle,fontsize:10,bold:true,align:'right',color:'#10213c'}}));
    totals.elements.push(makeElement('text',{text:`[SUM(${example.total.field})]`,x:5.55,y:0.1,width:1.45,height:0.2,style:{...defaultTextStyle,fontsize:10,bold:true,align:'right',format:'currency',color:'#10213c'}}));
  }
  footer.height = 0.35;
  footer.elements.push(makeElement('text',{text:'Report Studio · Example',x:0,y:0.08,width:4.5,height:0.2,style:{...defaultTextStyle,fontsize:8,color:'#64748b'}}));
  footer.elements.push(makeElement('text',{text:'[PAGE_NUMBER] / [PAGE_COUNT]',x:5.65,y:0.08,width:1.4,height:0.2,style:{...defaultTextStyle,fontsize:8,align:'right',color:'#64748b'}}));
  return validateProject(project);
}
