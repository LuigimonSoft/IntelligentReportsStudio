import { joinRelatedRows } from '../../../engine/index.ts';
import type { Project, TableRelation } from '../../../engine/types.ts';
import { relationshipError, suggestCardinality } from './modelHelpers.ts';

export function relationshipPreview(project: Project, relation: TableRelation) {
  const editing = project.relations?.some(item => item.id === relation.id);
  const error = relationshipError(project.datasets, project.relations ?? [], relation.from, relation.to, editing ? relation.id : undefined);
  const rows = error ? [] : joinRelatedRows(project.datasets, relation.from.dataset, relation, 'inner').rows;
  const total = project.datasets.find(table => table.id === relation.from.dataset)?.data.length ?? 0;
  return {error, matches: rows.length, unmatched: total-new Set(rows.map(row => row.index)).size,
    cardinality: suggestCardinality(project.datasets, relation.from, relation.to)};
}
