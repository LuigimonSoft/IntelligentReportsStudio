// Layout variables are CSSOM rules in an external stylesheet, never DOM styles.
const properties = new Set(['left','top','right','bottom','width','height','min-height','transform','transform-origin','font-size','font-family','color','font-weight','font-style','text-align','background','background-color','border','border-color','border-top-width','border-top-style','border-top-color','border-right-width','border-right-style','border-right-color','border-bottom-width','border-bottom-style','border-bottom-color','border-left-width','border-left-style','border-left-color','background-image','background-position-x','background-position-y','background-size','background-repeat','background-attachment','background-origin','background-clip','border-image-source','border-image-slice','border-image-width','border-image-outset','border-image-repeat','background-position','background-repeat-x','background-repeat-y']);
const rules = new Map();
let parser;
function stylesheet() {
  const sheet = document.querySelector('link[data-report-layout]')?.sheet;
  if (!sheet) throw new Error('The report layout stylesheet is not loaded.');
  return sheet;
}
export function updateLayoutRule(id, declarations) {
  const sheet = stylesheet();
  if (!parser) { const index=sheet.insertRule('[data-layout-parser] {}',sheet.cssRules.length); parser=sheet.cssRules[index]; }
  parser.style.cssText = declarations;
  let rule=rules.get(id);
  if (!rule) { const index=sheet.insertRule(`[data-layout="layout-${id}"] {}`,sheet.cssRules.length); rule=sheet.cssRules[index]; rules.set(id,rule); }
  rule.style.cssText='';
  const flags=[];
  for(let index=0;index<parser.style.length;index++) {
    const name=parser.style.item(index),value=parser.style.getPropertyValue(name);
    if(name.startsWith('--')) { rule.style.setProperty(name,value); continue; }
    if(!properties.has(name)) { console.warn(`Ignored unsupported report layout property: ${name}`); continue; }
    // The property declaration itself is defined in report-layout.css.
    rule.style.setProperty(`--layout-${name}`,value);
    flags.push(name);
  }
  // A property marker selects only the CSS declarations this view actually uses.
  // Updating an attribute does not replace the element's ordinary/state classes.
  const element=document.querySelector(`[data-layout="layout-${id}"]`);
  if(element) element.setAttribute('data-layout-properties',flags.join(' '));
  rule.__properties=flags.join(' ');
}
export function removeLayoutRule(id) {
  const rule=rules.get(id);if(!rule)return;
  const sheet=stylesheet();
  const index=Array.from(sheet.cssRules).indexOf(rule);
  if(index>=0)sheet.deleteRule(index);
  rules.delete(id);
}
// Initial attribute bindings run before insertion; finish their property markers
// before paint. Later value updates reuse the same rule and the same element.
new MutationObserver(records=>{
  for(const record of records) {
    const nodes=record.type==='attributes'?[record.target]:Array.from(record.addedNodes);
    for(const node of nodes) {
      if(!(node instanceof Element))continue;
      const elements=[...(node.hasAttribute('data-layout')?[node]:[]),...node.querySelectorAll('[data-layout]')];
      for(const element of elements) {
        const id=Number(element.getAttribute('data-layout')?.replace('layout-',''));
        const rule=rules.get(id);if(rule)element.setAttribute('data-layout-properties',rule.__properties);
      }
    }
  }
}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['data-layout']});

// The preview already includes report margins in its PDF canvas. Request a
// borderless print page of the same size so those margins are not added twice.
let printPageRule;
export function updatePrintPageSize(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
  const sheet = stylesheet();
  if (!printPageRule) {
    const index = sheet.insertRule('@page { margin: 0; }', sheet.cssRules.length);
    printPageRule = sheet.cssRules[index];
  }
  printPageRule.style.setProperty('size', `${width}in ${height}in`);
}
