use crate::{domain::*, shared::controls::*, state::studio};
use leptos::prelude::*;
use serde_json::{json, Value};
#[component]
pub fn ModelToolbar() -> impl IntoView {
    let s = studio();
    view! {
        <div class="model-toolbar" role="toolbar" aria-label="Data model tools">
            <Button
                label="Add table"
                primary=true
                on_press=move |_| {
                    s.show_json(
                        "Add table",
                        json!(
                            {"id":"","name":"","schema":{"fields":[{"name":"id","type":"number","sqlType":{"dialect":"mssql","name":"INT"}}]},"data":[]}
                        ),
                    )
                }
            />
            <Button label="Import tables" on_press=move |_| s.show_json("Import tables", json!({"json":""})) />
            <Button
                label="Add relationship"
                disabled=Signal::derive(move || array(&s.project.get()["datasets"]).len() < 2)
                on_press=move |_| {
                    s.show_json(
                        "Relationship",
                        json!(
                            {"id":super::connection::new_relationship_id(s),"from":{"dataset":s.table.get_untracked(),"field":"id"},"to":{"dataset":"","field":"id"},"cardinality":"1:n"}
                        ),
                    )
                }
            />
            <Button
                label="Edit relationship"
                disabled=Signal::derive(move || s.relation.get().is_null())
                on_press=move |_| s.show_json("Relationship", s.relation.get_untracked())
            />
            <Button
                label="Delete relationship"
                disabled=Signal::derive(move || s.relation.get().is_null())
                on_press=move |_| {
                    s.command("delete-relation", json!({"id":s.relation.get_untracked()["id"]}));
                    s.relation.set(Value::Null);
                }
            />
            <label class="model-parent-selector">
                <span>{move || s.t("Parent table")}</span>
                <select aria-label=move || s.t("Parent table")
                    prop:value=move || s.project.get()["dataModel"]["rootDataset"].as_str().unwrap_or("").to_owned()
                    on:change=move |event| {
                        let id = event_target_value(&event);
                        if !id.is_empty() { s.command("model-root", json!({"table":id})); }
                    }>
                    <option value="" disabled=true>{move || s.t("Select parent table")}</option>
                    {move || array(&s.project.get()["datasets"]).into_iter().map(|table| {
                        let id = text(&table, "id");
                        let name = text(&table, "name");
                        view! { <option value=id>{name}</option> }
                    }).collect_view()}
                </select>
            </label>
            <ActionButton label="Arrange" action="organize" />
            <span class="model-toolbar-spacer" />
            <Button
                label="Zoom out"
                on_press=move |_| s.model_zoom.update(|v| *v = (*v - 0.1).max(0.25))
            />
            <select
                aria-label="Model zoom"
                prop:value=move || format!("{:.0}", s.model_zoom.get() * 100.0)
                on:change=move |e| {
                    s.model_zoom.set(event_target_value(&e).parse::<f64>().unwrap_or(100.0) / 100.0)
                }
            >
                <option value=move || {
                    format!("{:.0}", s.model_zoom.get() * 100.0)
                }>{move || format!("{:.0}%", s.model_zoom.get() * 100.0)}</option>
                {[25, 50, 75, 100, 125, 150, 200]
                    .into_iter()
                    .map(|v| view! { <option value=v.to_string()>{format!("{v}%")}</option> })
                    .collect_view()}
            </select>
            <Button
                label="Zoom in"
                on_press=move |_| s.model_zoom.update(|v| *v = (*v + 0.1).min(2.0))
            />
            <Button
                label="Fit model"
                on_press=move |_| {
                    #[cfg(feature = "csr")]
                    if let Ok(Some(canvas)) = document().query_selector(".model-canvas") {
                        let p = s.project.get_untracked();
                        let mut width: f64 = 0.0;
                        let mut height: f64 = 0.0;
                        for (i, t) in array(&p["datasets"]).iter().enumerate() {
                            let settings = &p["dataModel"]["tables"][text(t, "id")];
                            width = width
                                .max(
                                    settings["x"].as_f64().unwrap_or((180 + i % 3 * 300) as f64)
                                        + 260.0,
                                );
                            height = height
                                .max(
                                    settings["y"].as_f64().unwrap_or((50 + i / 3 * 340) as f64)
                                        + array(&t["schema"]["fields"]).len() as f64 * 30.0 + 80.0,
                                );
                        }
                        if width > 0.0 && height > 0.0 {
                            s.model_zoom
                                .set(
                                    (canvas.client_width() as f64 / width)
                                        .min(canvas.client_height() as f64 / height)
                                        .clamp(0.25, 2.0),
                                );
                        }
                    }
                }
            />
            <ActionButton label="Fullscreen" action="fullscreen" />
        </div>
    }
    .into_any()
}
