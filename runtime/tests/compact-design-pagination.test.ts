import test from 'node:test';
import assert from 'node:assert/strict';
import {createBlankProject} from '../domain/report/blankProject.ts';
import {makeElement,compileReport,approximateMeasure} from '../engine/index.ts';
import {sectionHeights,resizeSectionBoundary} from '../tabs/design/report-area/sectionGeometry.ts';

test('design heights are independent of paper size and resize only the selected section',()=>{
 const p=createBlankProject(),d=p.report.details[0].band;const old=Object.fromEntries(sectionHeights(p.report));
 p.report.page.height=20;assert.deepEqual(Object.fromEntries(sectionHeights(p.report)),old);
 resizeSectionBoundary(p.report,d.id,1.25,approximateMeasure);
 const next=Object.fromEntries(sectionHeights(p.report));assert.equal(next[d.id],1.25);
 for(const id of Object.keys(old))if(id!==d.id)assert.equal(next[id],old[id]);
});

test('headers and footers stay anchored while wrapping detail rows paginate',()=>{
 const p=createBlankProject(),r=p.report; r.page.height=6;r.page.margins={top:.3,bottom:.3,left:.3,right:.3};
 const put=(band:any,id:string,height:number,text:string)=>{band.height=height;band.elements=[makeElement('text',{id,text,width:2,height:.18})]};
 put(r.header,'rh',.4,'Report header');put(r.pageHeader,'ph',.35,'Page header');put(r.pageFooter,'pf',.35,'Page footer');put(r.footer,'rf',.45,'Report footer');
 const d=r.details[0];d.dataset='items';put(d.groupHeader,'dh',.25,'Details header');put(d.groupFooter,'df',.25,'Details footer');
 put(d.band,'row',.3,'[description]');d.band.elements[0].width=1;d.band.elements[0].style.wrap=true;
 p.datasets=[{id:'items',name:'Items',schema:{fields:[{name:'description',type:'text'}]},data:Array.from({length:28},(_,i)=>({description:i%4===0?`Item ${i} extended text that wraps across several lines`:`Item ${i}`}))}];
 const layout=compileReport(r,p.datasets,{sectionHeights:Object.fromEntries(sectionHeights(r))});
 assert(layout.pages.length>1);const all=layout.pages.flatMap(page=>page.elements);
 assert.equal(all.filter(e=>e.id==='rh').length,1);assert.equal(all.filter(e=>e.id==='rf').length,1);assert.equal(all.filter(e=>e.id==='row').length,28);
 assert.equal(all.filter(e=>e.id==='ph').length,layout.pages.length);assert.equal(all.filter(e=>e.id==='pf').length,layout.pages.length);
 for(const page of layout.pages){const ph=page.elements.find(e=>e.id==='ph')!,pf=page.elements.find(e=>e.id==='pf')!;assert(Math.abs(ph.y-(r.page.margins.top+(page.number===1?.4:0)))<1e-8);for(const row of page.elements.filter(e=>e.id==='row'))assert(row.y+row.height<=pf.y+1e-8);}
 const last=layout.pages.at(-1)!;assert(Math.abs(last.elements.find(e=>e.id==='rf')!.y-(r.page.height-r.page.margins.bottom-.45))<1e-8);
 assert(all.filter(e=>e.id==='row').some(e=>e.height>.3));
});
