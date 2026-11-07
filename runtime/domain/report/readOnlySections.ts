import { bandsOf, type ReportDefinition, type Project } from '@reportstudio/mini-reports';

export function isSectionReadOnly(report: ReportDefinition, sectionId: string): boolean {
  function containsLocked(
    section: ReturnType<typeof bandsOf>[number],
    inherited: boolean,
  ): boolean {
    const locked = inherited || section.readOnly === true;
    if (section.id === sectionId) return locked;
    return (section.sections ?? []).some((child) => containsLocked(child, locked));
  }
  return bandsOf(report).some((section) => containsLocked(section, false));
}
export function hasReadOnlyAncestor(report: ReportDefinition, sectionId: string): boolean {
  return bandsOf(report).some(
    (section) =>
      section.id !== sectionId &&
      section.readOnly === true &&
      (section.sections ?? []).some(function contains(child): boolean {
        return child.id === sectionId || (child.sections ?? []).some(contains);
      }),
  );
}
/** Editor protection is atomic: a mutation cannot partially change locked sections. */
export function canEditProject(before: Project, after: Project): boolean {
  const next = new Map(bandsOf(after.report).map((section) => [section.id, section]));
  return bandsOf(before.report)
    .filter((section) => section.readOnly)
    .every((section) => {
      const updated = next.get(section.id);
      if (!updated) return false;
      const { readOnly: _old, ...original } = section;
      const { readOnly: _new, ...candidate } = updated;
      return JSON.stringify(original) === JSON.stringify(candidate);
    });
}
