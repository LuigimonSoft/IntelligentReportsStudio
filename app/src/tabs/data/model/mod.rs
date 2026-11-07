mod connection;
mod table_drag;
use connection::{open_relationship, Connection};
pub mod toolbar;
use crate::{domain::*, shared::controls::*, state::studio};
use leptos::prelude::*;
use serde_json::{json, Value};
use std::collections::{HashMap, VecDeque};
use table_drag::{model_position, TableDrag};

fn table_levels(project: &Value) -> HashMap<String, usize> {
    let tables = array(&project["datasets"]);
    let root = project["dataModel"]["rootDataset"].as_str().unwrap_or("");
    let mut levels = HashMap::new();
    if !tables.iter().any(|table| text(table, "id") == root) {
        return levels;
    }
    levels.insert(root.to_owned(), 0);
    let mut queue = VecDeque::from([root.to_owned()]);
    while let Some(current) = queue.pop_front() {
        let level = levels[&current];
        for relation in array(&project["relations"]) {
            let from = text(&relation["from"], "dataset");
            let to = text(&relation["to"], "dataset");
            let next = if from == current {
                &to
            } else if to == current {
                &from
            } else {
                continue;
            };
            if !levels.contains_key(next) && tables.iter().any(|table| text(table, "id") == *next) {
                levels.insert(next.clone(), level + 1);
                queue.push_back(next.clone());
            }
        }
    }
    levels
}

#[component]
pub fn DataModelTab() -> impl IntoView {
    let s = studio();
    let canvas = NodeRef::<leptos::html::Div>::new();
    let drag = RwSignal::new(None::<TableDrag>);
    let connection = RwSignal::new(None::<Connection>);
    view! {
        <div class="model-workspace">
            <div class="model-center">
                <toolbar::ModelToolbar />
                <div
                    class="model-canvas"
                    node_ref=canvas
                    tabindex="0"
                    on:keydown=move |event| {
                        if event.key() == "Escape" { connection.set(None); }
                    }
                    on:pointermove=move |event| {
                        if let Some(mut active) = connection.get_untracked().filter(|c| c.pointer == event.pointer_id()) {
                            if let Some(surface) = canvas.get().and_then(|c| c.first_element_child()) {
                                let rect = surface.get_bounding_client_rect();
                                let zoom = s.model_zoom.get_untracked();
                                active.cursor = ((event.client_x() as f64-rect.left())/zoom,(event.client_y() as f64-rect.top())/zoom);
                                active.moved |= (active.cursor.0-active.start.0).abs() + (active.cursor.1-active.start.1).abs() > 5.0;
                                connection.set(Some(active));
                            }
                            return;
                        }
                        if drag
                            .get_untracked()
                            .as_ref()
                            .is_none_or(|active| active.pointer != event.pointer_id())
                        {
                            return;
                        }
                        if let Some(canvas) = canvas.get() {
                            drag.update(|active| {
                                if let Some(active) = active
                                    .as_mut()
                                    .filter(|active| active.pointer == event.pointer_id())
                                {
                                    active
                                        .update(
                                            event.client_x(),
                                            event.client_y(),
                                            canvas.scroll_left(),
                                            canvas.scroll_top(),
                                        );
                                }
                            });
                        }
                    }
                    on:pointerup=move |event| {
                        if let Some(active) = connection.get_untracked().filter(|c| c.pointer == event.pointer_id() && c.moved) {
                            connection.set(None);
                            if let Some(target) = document().element_from_point(event.client_x() as f32,event.client_y() as f32)
                                .and_then(|el| el.closest(".model-field").ok().flatten()) {
                                open_relationship(s,active.from,json!({"dataset":target.get_attribute("data-dataset").unwrap_or_default(),"field":target.get_attribute("data-field").unwrap_or_default()}));
                            }
                            return;
                        }
                        let active = drag.get_untracked();
                        if let Some(mut active) = active
                            .filter(|active| active.pointer == event.pointer_id())
                        {
                            if let Some(canvas) = canvas.get() {
                                active
                                    .update(
                                        event.client_x(),
                                        event.client_y(),
                                        canvas.scroll_left(),
                                        canvas.scroll_top(),
                                    );
                            }
                            drag.set(None);
                            if active.moved() {
                                s.command(
                                    "model-settings",
                                    json!(
                                        {"table":active.id,"settings":{"x":active.position.0,"y":active.position.1}}
                                    ),
                                );
                            }
                        }
                    }
                    on:pointercancel=move |_| { drag.set(None); connection.set(None); }
                    on:lostpointercapture=move |_| drag.set(None)
                >
                    <div
                        class="model-surface"
                        data-layout={
                            let layout = crate::platform::layout_styles::LayoutStyle::new();
                            move || {
                                layout.apply({ format!("transform:scale({})", s.model_zoom.get()) })
                            }
                        }
                    >
                        <RelationshipLines drag />
                        {move || connection.get().map(|active| view! {
                            <svg class="connection-preview" width="1200" height="1100" aria-hidden="true">
                                <path d=format!("M {} {} C {} {}, {} {}, {} {}",active.start.0,active.start.1,active.start.0+40.0,active.start.1,active.cursor.0-40.0,active.cursor.1,active.cursor.0,active.cursor.1) />
                            </svg>
                        })}
                        {move || {
                            array(&s.project.get()["datasets"])
                                .into_iter()
                                .enumerate()
                                .map(|(index, table)| {
                                    view! { <ModelTableCard table index drag canvas connection /> }
                                })
                                .collect_view()
                        }}
                    </div>
                </div>
                <Show when=move || connection.get().is_some()>
                    <div class="model-connection-status" role="status">
                        <span>{move || s.t("Select the destination column node.")}</span>
                        <Button label="Cancel" on_press=move |_| connection.set(None) />
                    </div>
                </Show>
            </div>
            <ModelProperties />
        </div>
    }
}
#[component]
fn RelationshipLines(drag: RwSignal<Option<TableDrag>>) -> impl IntoView {
    let s = studio();
    view! {
        <svg class="relationship-lines" width="1200" height="1100">
            {move || {
                let project = s.project.get();
                let tables = array(&project["datasets"]);
                array(&project["relations"])
                    .into_iter()
                    .map(|relation| {
                        let from = tables
                            .iter()
                            .position(|t| t["id"] == relation["from"]["dataset"])
                            .unwrap_or(0);
                        let to = tables
                            .iter()
                            .position(|t| t["id"] == relation["to"]["dataset"])
                            .unwrap_or(0);
                        let coordinate = |index: usize, key: &str, _default: usize| {
                            let position = model_position(
                                &project,
                                &text(&tables[index], "id"),
                                index,
                                drag.get().as_ref(),
                            );
                            if key == "x" { position.0 } else { position.1 }
                        };
                        let row = |index: usize, endpoint: &Value| {
                            array(&tables[index]["schema"]["fields"])
                                .iter()
                                .position(|field| field["name"] == endpoint["field"])
                                .unwrap_or(0) as f64
                        };
                        let x1 = coordinate(from, "x", 180 + (from % 3) * 300) + 220.0;
                        let y1 = coordinate(from, "y", 50 + (from / 3) * 340) + 56.0
                            + row(from, &relation["from"]) * 30.0;
                        let x2 = coordinate(to, "x", 180 + (to % 3) * 300);
                        let y2 = coordinate(to, "y", 50 + (to / 3) * 340) + 56.0
                            + row(to, &relation["to"]) * 30.0;
                        view! {
                            <g
                                class="model-relationship"
                                on:click=move |_| s.relation.set(relation.clone())
                            >
                                <path
                                    d=format!(
                                        "M {x1} {y1} C {} {y1}, {} {y2}, {x2} {y2}",
                                        x1 + 40.0,
                                        (x2 - 40.0).max(0.0),
                                    )
                                    stroke="#8c9bab"
                                    fill="none"
                                    stroke-width="2"
                                />
                                <text x=x1.to_string() y=(y1 - 6.0).to_string()>
                                    "1"
                                </text>
                                <text x=x2.to_string() y=(y2 - 6.0).to_string()>
                                    "n"
                                </text>
                            </g>
                        }
                    })
                    .collect_view()
            }}
        </svg>
    }
}
#[component]
fn ModelTableCard(
    table: Value,
    index: usize,
    drag: RwSignal<Option<TableDrag>>,
    canvas: NodeRef<leptos::html::Div>,
    connection: RwSignal<Option<Connection>>,
) -> impl IntoView {
    let s = studio();
    let id = text(&table, "id");
    let active = id.clone();
    let select = id.clone();
    let drag_id = id.clone();
    let header = NodeRef::<leptos::html::H4>::new();
    let settings = s.project.get_untracked()["dataModel"]["tables"][&id].clone();
    let position_id = id.clone();
    let hierarchy_id = id.clone();
    let hierarchy_title_id = id.clone();
    let hierarchy_badge_id = id.clone();
    let color = settings["color"]
        .as_str()
        .unwrap_or(["#5a9bff", "#34c759", "#ffb028"][index % 3])
        .to_owned();
    let style = move || {
        let position = model_position(
            &s.project.get_untracked(),
            &position_id,
            index,
            drag.get().as_ref(),
        );
        format!(
            "left:{}px;top:{}px;--table-color:{}",
            position.0, position.1, color
        )
    };
    view! {
        <section
            class="model-card"
            data-table-id=id.clone()
            data-hierarchy=move || {
                let levels = table_levels(&s.project.get());
                if levels.is_empty() { "" } else if levels.get(&hierarchy_id) == Some(&0) { "parent" } else if levels.contains_key(&hierarchy_id) { "child" } else { "unrelated" }
            }
            title=move || {
                let levels = table_levels(&s.project.get());
                if levels.is_empty() { String::new() } else if levels.get(&hierarchy_title_id) == Some(&0) { s.t("Parent table") } else if levels.contains_key(&hierarchy_title_id) { s.t("Child table") } else { s.t("Unrelated table") }
            }
            class:active=move || s.table.get() == active
            data-layout={
                let layout = crate::platform::layout_styles::LayoutStyle::new();
                move || layout.apply(style())
            }
            on:click=move |_| s.table.set(select.clone())
        >
            <h4
                node_ref=header
                draggable="false"
                title=move || s.t("Drag to move table")
                on:dragstart=move |event| event.prevent_default()
                on:pointerdown=move |event| {
                    if event.button() != 0 || !event.is_primary() {
                        return;
                    }
                    if let (Some(header), Some(canvas)) = (header.get(), canvas.get()) {
                        event.prevent_default();
                        event.stop_propagation();
                        if header.set_pointer_capture(event.pointer_id()).is_err() {
                            return;
                        }
                        connection.set(None);
                        s.table.set(drag_id.clone());
                        let position = model_position(
                            &s.project.get_untracked(),
                            &drag_id,
                            index,
                            None,
                        );
                        drag.set(
                            Some(
                                TableDrag::new(
                                    drag_id.clone(),
                                    event.pointer_id(),
                                    event.client_x(),
                                    event.client_y(),
                                    canvas.scroll_left(),
                                    canvas.scroll_top(),
                                    s.model_zoom.get_untracked(),
                                    position,
                                ),
                            ),
                        );
                    }
                }
            >
                <crate::shared::icons::Icon name="database" />
                {text(&table, "name")}
                <span class="model-hierarchy-badge">{move || {
                    let levels = table_levels(&s.project.get());
                    if levels.is_empty() { String::new() } else if levels.get(&hierarchy_badge_id) == Some(&0) { s.t("Parent table") } else if levels.contains_key(&hierarchy_badge_id) { s.t("Child table") } else { s.t("Unrelated table") }
                }}</span>
            </h4>
            {array(&table["schema"]["fields"])
                .into_iter()
                .filter(|field| !array(&settings["hiddenFields"]).contains(&field["name"]))
                .map(|field| view! { <ModelField field table_id=id.clone() canvas connection /> })
                .collect_view()}
        </section>
    }
}
#[component]
fn ModelField(
    field: Value,
    table_id: String,
    canvas: NodeRef<leptos::html::Div>,
    connection: RwSignal<Option<Connection>>,
) -> impl IntoView {
    let s = studio();
    let name = text(&field, "name");
    let start = json!({"dataset":table_id,"field":name}).to_string();
    let target = json!({"dataset":table_id,"field":name});
    let endpoint = target.clone();
    let selected = target.clone();
    let keyboard_endpoint = target.clone();
    let candidate = target.clone();
    let row = NodeRef::<leptos::html::Div>::new();
    view! {
        <div
            class="model-field"
            node_ref=row
            data-dataset=table_id.clone()
            data-field=name.clone()
            class:connecting=move || connection.get().is_some_and(|c| c.from == selected)
            class:connection-target=move || connection.get().is_some_and(|c| c.from["dataset"] != candidate["dataset"])
            on:pointerdown=move |event| {
                if event.button() != 0 || !event.is_primary() { return; }
                event.prevent_default();
                event.stop_propagation();
                if let Some(canvas) = canvas.get() { let _ = canvas.focus(); }
                if let Some(active) = connection.get_untracked() {
                    if active.from["dataset"] != endpoint["dataset"] {
                        connection.set(None);
                        open_relationship(s,active.from,endpoint.clone());
                    } else if active.from == endpoint { connection.set(None); }
                    return;
                }
                if let (Some(row),Some(surface)) = (row.get(),canvas.get().and_then(|c| c.first_element_child())) {
                    let bounds = row.get_bounding_client_rect();
                    let origin = surface.get_bounding_client_rect();
                    let zoom = s.model_zoom.get_untracked();
                    let start = ((bounds.right()-origin.left())/zoom,(bounds.top()+bounds.height()/2.0-origin.top())/zoom);
                    if row.set_pointer_capture(event.pointer_id()).is_ok() {
                        connection.set(Some(Connection{from:endpoint.clone(),start,cursor:start,pointer:event.pointer_id(),moved:false}));
                    }
                }
            }
            draggable="true"
            on:dragstart=move |e| {
                if let Some(data) = e.data_transfer() {
                    let _ = data.set_data("text/plain", &start);
                }
            }
            on:dragover=move |e| e.prevent_default()
            on:drop=move |e| {
                e.prevent_default();
                e.stop_propagation();
                if let Some(data) = e.data_transfer() {
                    if let Ok(from) = serde_json::from_str::<
                        Value,
                    >(&data.get_data("text/plain").unwrap_or_default()) {
                        connection.set(None);
                        open_relationship(s,from,target.clone());
                    }
                }
            }
        >
            <span>
                <crate::shared::icons::Icon name=if field["type"] == "number" {
                    "hash"
                } else {
                    "letters"
                } />
                {name.clone()}
            </span>
            <small>
                {field["sqlType"]["name"]
                    .as_str()
                    .unwrap_or(if field["type"] == "number" { "INT" } else { "VARCHAR" })
                    .to_owned()}
            </small>
            <button class="column-connection-node" aria-label=format!("{}: {}.{}",s.t("Connect column"),table_id,name) title=move || s.t("Connect column")
                on:click=move |event| {
                    event.stop_propagation();
                    // Pointer gestures are handled by the row; keyboard activation uses click.
                    if event.detail() != 0 { return; }
                    if let Some(active) = connection.get_untracked() {
                        connection.set(None);
                        open_relationship(s,active.from,keyboard_endpoint.clone());
                    } else if let (Some(row),Some(surface)) = (row.get(),canvas.get().and_then(|c| c.first_element_child())) {
                        let bounds = row.get_bounding_client_rect();
                        let origin = surface.get_bounding_client_rect();
                        let zoom = s.model_zoom.get_untracked();
                        let start = ((bounds.right()-origin.left())/zoom,(bounds.top()+bounds.height()/2.0-origin.top())/zoom);
                        connection.set(Some(Connection{from:keyboard_endpoint.clone(),start,cursor:start,pointer:-1,moved:false}));
                    }
                }
            ></button>
        </div>
    }
}
#[component]
fn ModelProperties() -> impl IntoView {
    let s = studio();
    view! {
        <aside class="model-properties">
            <h3>{move || s.t("Properties")}</h3>
            {move || {
                let table = array(&s.project.get()["datasets"])
                    .into_iter()
                    .find(|t| text(t, "id") == s.table.get())
                    .unwrap_or_default();
                let edit = table.clone();
                let id = text(&table, "id");
                let settings = s.project.get()["dataModel"]["tables"][&id].clone();
                let alias_id = id.clone();
                let color_id = id.clone();
                view! {
                    <h4>{text(&table, "name")}</h4>
                    <label class="property">
                        {s.t("Alias")}
                        <input
                            value=text(&settings, "alias")
                            on:change=move |e| {
                                s.command(
                                    "model-settings",
                                    json!(
                                        {"table":alias_id,"settings":{"alias":event_target_value(&e)}}
                                    ),
                                )
                            }
                        />
                    </label>
                    <label class="property">
                        {s.t("Color")}
                        <input
                            type="color"
                            value=settings["color"].as_str().unwrap_or("#5a9bff").to_owned()
                            on:change=move |e| {
                                s.command(
                                    "model-settings",
                                    json!(
                                        {"table":color_id,"settings":{"color":event_target_value(&e)}}
                                    ),
                                )
                            }
                        />
                    </label>
                    <h4>{s.t("Columns")}</h4>
                    {array(&table["schema"]["fields"])
                        .into_iter()
                        .map(|field| {
                            let name = text(&field, "name");
                            let toggle = name.clone();
                            let table_id = id.clone();
                            let checked = !array(&settings["hiddenFields"])
                                .contains(&field["name"]);
                            view! {
                                <label class="check">
                                    <input
                                        type="checkbox"
                                        checked=checked
                                        on:change=move |event| {
                                            let mut hidden = array(
                                                &s
                                                    .project
                                                    .get_untracked()["dataModel"]["tables"][&table_id]["hiddenFields"],
                                            );
                                            hidden.retain(|name| name != &json!(toggle));
                                            if !event_target_checked(&event) {
                                                hidden.push(json!(toggle));
                                            }
                                            s.command(
                                                "model-settings",
                                                json!({"table":table_id,"settings":{"hiddenFields":hidden}}),
                                            );
                                        }
                                    />
                                    {name}
                                </label>
                            }
                        })
                        .collect_view()}
                    <Button
                        label="Edit table"
                        on_press=move |_| s.show_json("Data table", edit.clone())
                    />
                    <Button
                        label="View records"
                        on_press=move |_| s.data_tab.set("Records".into())
                    />
                    <h4>{s.t("Relationships")}</h4>
                    {array(&s.project.get()["relations"])
                        .into_iter()
                        .map(|relation| {
                            let edit = relation.clone();
                            let id = text(&relation, "id");
                            view! {
                                <div class="relation-item">
                                    <button on:click=move |_| {
                                        s.show_json("Relationship", edit.clone())
                                    }>
                                        {format!(
                                            "{}.{} → {}.{}",
                                            text(&relation["from"], "dataset"),
                                            text(&relation["from"], "field"),
                                            text(&relation["to"], "dataset"),
                                            text(&relation["to"], "field"),
                                        )}
                                    </button>
                                    <Button
                                        label="Delete relationship"
                                        compact=true
                                        on_press=move |_| {
                                            s.command("delete-relation", json!({"id":id}))
                                        }
                                    />
                                </div>
                            }
                        })
                        .collect_view()}
                }
            }}
        </aside>
    }
}
