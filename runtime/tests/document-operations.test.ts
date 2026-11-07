import test from "node:test";
import assert from "node:assert/strict";
import { act, templateOnly, query, layoutOf } from "../core.ts";
import { createBlankProject } from "../domain/report/blankProject.ts";
import { bandsOf } from "../engine/index.ts";
import sample from "../data/exampleInvoice.json" with { type: "json" };
import { bindExample } from "../core.ts";
test("all seven sections remain in a new document and no source is attached", async () => {
  const { project } = await act({
    action: "new",
    project: bindExample(structuredClone(sample) as any),
  });
  assert.equal(bandsOf(project.report).length, 7);
  assert.deepEqual(project.datasets, []);
  assert.equal(project.dataSource, undefined);
});
test("cut cancellation and read-only groups do not lose elements", async () => {
  const project = createBlankProject();
  const added = await act({ action: "add-text", project });
  const p = added.project;
  bandsOf(p.report)[0].readOnly = true;
  await assert.rejects(
    act({ action: "delete", project: p, selected: added.selected }),
    /read only/,
  );
  assert.equal(bandsOf(p.report)[0].elements.length, 1);
});
test("cross-section movement transfers the entire table group with geometry", async () => {
  let project = createBlankProject();
  const b = bandsOf(project.report);
  const added = await act({ action: "add-table", project, band: b[0].id });
  project = added.project;
  const group = bandsOf(project.report)[0].elements;
  const count = group.length;
  const result = await act({
    action: "move",
    project,
    band: b[0].id,
    selected: added.selected,
    args: { targetBand: b[3].id, dx: 0.5, dy: 1 },
  });
  assert.equal(bandsOf(result.project.report)[0].elements.length, 0);
  assert.equal(bandsOf(result.project.report)[3].elements.length, count);
  assert.equal(
    new Set(
      bandsOf(result.project.report)[3].elements.map((e: any) => e.groupId),
    ).size,
    1,
  );
});
test("relations change queried records and values are not persisted", () => {
  const p = createBlankProject();
  p.datasets = [
    {
      id: "a",
      name: "A",
      schema: { fields: [{ name: "id", type: "number" }] },
      data: [{ id: 1 }, { id: 2 }],
    },
    {
      id: "b",
      name: "B",
      schema: { fields: [{ name: "parent", type: "number" }] },
      data: [{ parent: 1 }],
    },
  ];
  p.relations = [
    {
      id: "r",
      from: { dataset: "a", field: "id" },
      to: { dataset: "b", field: "parent" },
      cardinality: "1:n",
    },
  ];
  assert.equal(query(p, { table: "a" }).length, 1);
  assert.deepEqual(templateOnly(p).datasets[0].data, []);
});
test("cancelled save preserves the current project", async () => {
  const p = createBlankProject();
  (globalThis as any).__TAURI__ = { core: { invoke: async () => false } };
  const result = await act({ action: "save", project: p });
  assert.equal(result.saved, false);
  assert.equal(result.project, undefined);
  delete (globalThis as any).__TAURI__;
});
test("host API table replacement remains serializable without persisting rows", async () => {
  const p = createBlankProject();
  const tables = [
    {
      id: "items",
      name: "Items",
      schema: { fields: [{ name: "description", type: "text" }] },
      data: [{ description: "From API" }],
    },
  ];
  const result = await act({
    action: "replace-tables",
    project: p,
    args: { tables, name: "ExternalAPI" },
  });
  assert.equal(
    query(result.project, { table: "items" })[0].description,
    "From API",
  );
  assert.equal(templateOnly(result.project).dataSource.name, "ExternalAPI");
  assert.deepEqual(templateOnly(result.project).datasets[0].data, []);
});
test("table header toggling preserves first body row contents", async () => {
  const added = await act({
    action: "add-table",
    project: createBlankProject(),
  });
  const p = added.project;
  const cell = bandsOf(p.report)
    .flatMap((b) => b.elements)
    .find((e) => e.table);
  for (const e of bandsOf(p.report)
    .flatMap((b) => b.elements)
    .filter((e) => e.table)) {
    e.table.contents["1:0"] = "Edited first row";
    if (e.type === "text" && e.cell?.row === 1 && e.cell?.column === 0)
      e.text = "Edited first row";
  }
  const original = structuredClone(cell.table.contents);
  const removed = await act({
    action: "table-settings",
    project: p,
    selected: added.selected,
    args: { headers: false },
  });
  const body = bandsOf(removed.project.report)
    .flatMap((b) => b.elements)
    .find((e) => e.table);
  assert.equal(body.table.contents["0:0"], original["1:0"]);
  const restored = await act({
    action: "table-settings",
    project: removed.project,
    selected: removed.selected,
    args: { headers: true },
  });
  const final = bandsOf(restored.project.report)
    .flatMap((b) => b.elements)
    .find((e) => e.table);
  assert.equal(final.table.contents["1:0"], original["1:0"]);
});
test("record editing replaces the selected original record without appending", async () => {
  const p = createBlankProject();
  p.datasets = [
    {
      id: "items",
      name: "Items",
      schema: {
        fields: [
          { name: "id", type: "number" },
          { name: "name", type: "text" },
        ],
      },
      data: [
        { id: 1, name: "First" },
        { id: 2, name: "Second" },
      ],
    },
  ];
  const edited = await act({
    action: "apply-definition",
    project: p,
    args: {
      kind: "Record",
      table: "items",
      original: { id: 2, name: "Second" },
      value: { id: 2, name: "Updated" },
    },
  });
  assert.deepEqual(edited.project.datasets[0].data, [
    { id: 1, name: "First" },
    { id: 2, name: "Updated" },
  ]);
  await assert.rejects(
    act({
      action: "apply-definition",
      project: p,
      args: {
        kind: "Record",
        table: "items",
        original: { id: 99, name: "Missing" },
        value: { id: 99, name: "Bad" },
      },
    }),
    /record changed/,
  );
});
test("model positions and appearance survive template serialization", async () => {
  const p = createBlankProject();
  p.datasets = [
    {
      id: "items",
      name: "Items",
      schema: { fields: [{ name: "id", type: "number" }] },
      data: [],
    },
  ];
  const edited = await act({
    action: "model-settings",
    project: p,
    args: {
      table: "items",
      settings: { x: 200, y: 150, alias: "i", color: "#123456" },
    },
  });
  assert.deepEqual(templateOnly(edited.project).dataModel.tables.items, {
    x: 200,
    y: 150,
    alias: "i",
    color: "#123456",
  });
});

test('parent table persists through validation, arranging and template serialization', async () => {
 const p = createBlankProject();
 p.datasets = [{id:'items',name:'Items',schema:{fields:[{name:'id',type:'number'}]},data:[]}];
 const selected = await act({action:'model-root',project:p,args:{table:'items'}});
 assert.equal(selected.activeTable,'items');
 assert.equal(selected.project.dataModel.rootDataset,'items');
 const arranged = await act({action:'organize',project:selected.project});
 assert.equal(templateOnly(arranged.project).dataModel.rootDataset,'items');
 await assert.rejects(act({action:'model-root',project:p,args:{table:'missing'}}),/Unknown data table/);
});

test('duplicating a report creates an editable independent copy', async () => {
  const project = createBlankProject('Invoice');
  const result = await act({ action: 'duplicate-report', project });
  assert.notEqual(result.project.report.id, project.report.id);
  assert.equal(result.project.report.title, 'Invoice (copy)');
  result.project.report.title = 'Changed';
  assert.equal(project.report.title, 'Invoice');
});

test('save and save-as send the correct native operation', async () => {
  const calls = [];
  (globalThis as any).__TAURI__ = { core: { invoke: async (command, args) => { calls.push({command, args}); return true; } } };
  try {
    const project = createBlankProject();
    await act({ action: 'save', project });
    await act({ action: 'save-as', project });
    assert.deepEqual(calls.map(call => [call.command, call.args.saveAs]), [['save_report', false], ['save_report', true]]);
  } finally { delete (globalThis as any).__TAURI__; }
});
