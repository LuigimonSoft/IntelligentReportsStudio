import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankProject } from '../domain/report/blankProject.ts';
import { makeBand, makeElement, validateProject, compileReport } from '../engine/index.ts';
import { canEditProject, isSectionReadOnly, hasReadOnlyAncestor } from '../domain/report/readOnlySections.ts';

test('read-only sections protect content and descendants atomically while allowing unlock and other sections', () => {
  const project = createBlankProject('Locked'); const band = project.report.header!;
  band.readOnly = true; band.elements = [makeElement('text', { text: 'Locked content' })];
  const child = makeBand('Child', .3); band.sections = [child];
  assert(isSectionReadOnly(project.report, child.id)); assert(hasReadOnlyAncestor(project.report, child.id));
  for (const modify of [(draft: typeof project)=>{draft.report.header!.elements[0].x=1;}, (draft: typeof project)=>{draft.report.header!.sections![0].elements.push(makeElement('text'));}, (draft: typeof project)=>{delete draft.report.header;}]) {
    const draft=structuredClone(project); modify(draft); assert.equal(canEditProject(project,draft),false);
  }
  const unlocked=structuredClone(project);unlocked.report.header!.readOnly=false;assert(canEditProject(project,unlocked));
  const elsewhere=structuredClone(project);elsewhere.report.pageHeader!.name='Changed';assert(canEditProject(project,elsewhere));
  assert.doesNotThrow(()=>validateProject(project));
  const invalid=structuredClone(project);invalid.report.header!.readOnly='yes' as never;assert.throws(()=>validateProject(invalid),/read-only/);
  assert.deepEqual(compileReport(project.report,project.datasets),compileReport(unlocked.report,unlocked.datasets));
});
