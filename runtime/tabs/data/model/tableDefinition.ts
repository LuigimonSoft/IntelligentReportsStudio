import { validateSqlType } from '../../../engine/sqlTypes.ts';
import type { Dataset, Project } from '../../../engine/types.ts';

/** Prepare an editor draft without persisting UI-only column identities. */
export function tableDefinition(project: Project, draft: Dataset, editing: boolean) {
 const original=editing ? project.datasets.find(table=>table.id===draft.id) : undefined;
 const name=String(draft.name ?? '').trim();
 const fields=(draft.schema?.fields ?? []).map(field=>({...field,name:field.name.trim()}));
 let error=!original && project.datasets.length>=20 ? 'Maximum 20 tables per model.'
  : !name ? 'Enter a table name.'
  : name.length>100 ? 'Table names must not exceed 100 characters.'
  : project.datasets.some(table=>table.id!==original?.id && (table.id===name || table.name===name)) ? 'A table with that name already exists.'
  : fields.length<1 || fields.length>100 || fields.some(field=>! /^[A-Za-z_][A-Za-z_0-9]*$/.test(field.name) || field.name.length>100 || ['__proto__','constructor','prototype'].includes(field.name)) || new Set(fields.map(field=>field.name)).size!==fields.length
   ? 'Use unique column names with letters, numbers and underscores.' : '';
 try {fields.forEach(validateSqlType);} catch {error ||= 'Invalid SQL type arguments.';}
 const mapping=new Map(fields.map(field=>[(field as any)._sourceName ?? field.name,field.name]));
 if(original && project.relations?.some(relation=>[relation.from,relation.to].some(endpoint=>endpoint.dataset===original.id && !mapping.has(endpoint.field))))
  error ||= 'Remove relationships using a column before deleting it.';
 if(original && project.report.details.some(detail=>detail.dataset===original.id && [detail.groupBy,...(detail.groups ?? []).map(group=>group.field)].some(field=>!!field && !mapping.has(field))))
  error ||= 'Remove grouping before deleting its column.';
 const cleaned=fields.map(field=>{const {_sourceName,...clean}=field as any;return clean;});
 const data=original?.data.map(row=>Object.fromEntries(fields.map(field=>{
  const key=(field as any)._sourceName ?? field.name;
  return [field.name,Object.hasOwn(row,key)?row[key]:field.type==='number'?0:field.type==='boolean'?false:''];
 }))) ?? [];
 return {error,table:{...draft,id:original?.id ?? name,name,schema:{...draft.schema,fields:cleaned},data},mapping};
}
