import type { Project, Dataset, TableRelation, DataRow } from "../../../engine/types.ts";
import { previewProject } from "../../preview/previewSettings.ts";
import { queryRecords, normalizeSearch } from "./recordsQuery.ts";

type Join = { relation: TableRelation; source: string; target: string; sourceField: string; targetField: string };
export function modelQueryPlan(project: Project, args: any = {}) {
  const root = project.datasets.find(t => t.id === (args.table || project.dataModel?.rootDataset || project.datasets[0]?.id));
  if (!root) return { tables: [] as Dataset[], joins: [] as Join[], constraints: [] as TableRelation[], columns: [] as {key:string; label:string; type:any}[], sql: "" };
  const tables = [root], known = new Set([root.id]), joins: Join[] = [], used = new Set<TableRelation>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of project.relations ?? []) {
      if (used.has(r)) continue;
      const a = known.has(r.from.dataset), b = known.has(r.to.dataset);
      if (a === b) continue;
      const source = a ? r.from : r.to, target = a ? r.to : r.from;
      const table = project.datasets.find(t => t.id === target.dataset);
      if (!table) continue;
      joins.push({ relation: r, source: source.dataset, target: target.dataset, sourceField: source.field, targetField: target.field });
      tables.push(table); known.add(table.id); used.add(r); changed = true;
    }
  }
  const constraints = (project.relations ?? []).filter(r => !used.has(r) && known.has(r.from.dataset) && known.has(r.to.dataset));
  const columns = tables.flatMap((t, i) => t.schema.fields.map(f => ({ key: i ? `${t.id}.${f.name}` : f.name, label: i ? `${t.name}.${f.name}` : f.name, type: f.type })));
  const q = (s: string) => `[${s.replace(/]/g, "]]")}]`;
  const alias = (id: string) => `t${tables.findIndex(t => t.id === id)}`;
  const limit = Math.max(1, Number(args.limit) || 200);
  const select = tables.flatMap((t,i) => t.schema.fields.map(f => `  ${q(alias(t.id))}.${q(f.name)} AS ${q(i ? `${t.id}.${f.name}` : f.name)}`)).join(",\n");
  let sql = `SELECT TOP (${limit})\n${select}\nFROM ${q(root.name)} AS ${q(alias(root.id))}`;
  for (const j of joins) { const t = tables.find(t => t.id === j.target)!; sql += `\nINNER JOIN ${q(t.name)} AS ${q(alias(t.id))} ON ${q(alias(j.source))}.${q(j.sourceField)} = ${q(alias(j.target))}.${q(j.targetField)}`; }
  if (constraints.length) sql += `\nWHERE ` + constraints.map(r => `${q(alias(r.from.dataset))}.${q(r.from.field)} = ${q(alias(r.to.dataset))}.${q(r.to.field)}`).join(" AND ");
  return { tables, joins, constraints, columns, sql: sql + ";" };
}
export function modelRecords(project: Project, args: any = {}) {
  const filtered = previewProject(project, { values: args.values ?? {}, header: true, footer: true });
  const plan = modelQueryPlan(filtered, args), root = plan.tables[0];
  if (!root) return { rows: [], columns: plan.columns };
  let combinations: Record<string, DataRow>[] = root.data.map(row => ({ [root.id]: row }));
  for (const j of plan.joins) {
    const table = plan.tables.find(t => t.id === j.target)!;
    const index = new Map<unknown, DataRow[]>();
    for (const row of table.data) { const key = row[j.targetField]; if (key == null) continue; const bucket = index.get(key) ?? []; bucket.push(row); index.set(key, bucket); }
    const next: typeof combinations = [];
    for (const part of combinations) { const key = part[j.source]?.[j.sourceField]; if (key == null) continue; for (const row of index.get(key) ?? []) { if (next.length >= 100000) throw new Error("The joined result exceeds 100,000 rows."); next.push({ ...part, [j.target]: row }); } }
    combinations = next;
  }
  combinations = combinations.filter(part => plan.constraints.every(r => { const a = part[r.from.dataset]?.[r.from.field], b = part[r.to.dataset]?.[r.to.field]; return a != null && b != null && a === b; }));
  const data = combinations.map(part => Object.fromEntries(plan.tables.flatMap((table, i) => table.schema.fields.map(f => [i ? `${table.id}.${f.name}` : f.name, part[table.id]?.[f.name] ?? null])))).filter(row => Object.entries(args.filters ?? {}).every(([key,value]) => normalizeSearch(row[key]).includes(normalizeSearch(value))));
  const table = { ...root, data, schema: { fields: plan.columns.map(c => ({ name: c.key, type: c.type })) } };
  const rows = queryRecords({ datasets: filtered.datasets, table, joinMode: "inner", parameters: [], values: {}, filters: args.groups ?? [], combination: args.combination === "or" ? "or" : "and", search: args.search ?? "", sort: args.sort ?? null, limit: args.limit ?? 200, locale: args.locale ?? "en" }).rows.map(r => r.row);
  return { rows, columns: plan.columns };
}
