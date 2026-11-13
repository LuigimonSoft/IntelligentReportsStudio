//! The detailed chart editor uses three panels.
use super::definition_fields::draft;
use crate::{
    domain::*,
    shared::controls::Button,
    state::{studio, Studio},
};
use leptos::prelude::*;
use serde_json::{json, Value};

fn bind(s: Studio, table: &Value, field: Option<(&str, bool)>) {
    let mut settings: Value = serde_json::from_str(&s.draft.get_untracked()).unwrap_or_default();
    if settings["dataset"] != table["id"] || field.is_none() {
        let fields = array(&table["schema"]["fields"]);
        settings["dataset"] = table["id"].clone();
        settings["category"] = json!(fields
            .iter()
            .find(|f| f["type"] != "number")
            .or(fields.first())
            .map(|f| text(f, "name"))
            .unwrap_or_default());
        settings["value"] = json!(fields
            .iter()
            .find(|f| {
                let name = text(f, "name");
                f["type"] == "number" && name != "id" && !name.ends_with("Id") && !name.ends_with("_id")
            })
            .or_else(|| fields.iter().find(|f| f["type"] == "number"))
            .map(|f| text(f, "name"))
            .unwrap_or_default());
    }
    if let Some((name, numeric)) = field {
        settings[if numeric { "value" } else { "category" }] = json!(name);
    }
    s.draft.set(settings.to_string());
}
#[component]
pub fn ChartEditor() -> impl IntoView {
    let s = studio();
    let points = RwSignal::new(Vec::<Value>::new());
    #[cfg(feature = "csr")]
    Effect::new(move |_| {
        let settings = draft();
        let project = s.project.get();
        let snapshot = s.draft.get();
        leptos::task::spawn_local(async move {
            if let Ok(result) = crate::platform::call(
                json!({"action":"chart-points","project":project,"args":{"chart":settings}}),
            )
            .await
            {
                if s.draft.get_untracked() == snapshot {
                    points.set(array(&result["points"]));
                }
            }
        });
    });
    view! {
        <div class="chart-editor-layout">
            <section class="chart-editor-settings">
                <h3>{move || s.t("Chart settings")}</h3>
                {move || {
                    view! {
                        <crate::tabs::design::right_sidebar::charts::ChartFields
                            chart=draft()
                            detailed=true
                        />
                        <crate::tabs::design::right_sidebar::charts::CategoryColors
                            chart=draft()
                            detailed=true
                        />
                    }
                }}
            </section>
            <main class="chart-editor-preview">
                <h3>{move || s.t("Chart preview")}</h3>
                <div class="chart-preview-surface">
                    {move || {
                        view! {
                            <crate::tabs::design::report_area::elements::ReportElementView element=json!(
                                {"type":"chart","chart":draft()}
                            ) />
                        }
                    }}
                </div>
                <p class="helper">
                    {move || {
                        s.t("{0} chart categories").replace("{0}", &points.get().len().to_string())
                    }}
                </p>
                <div class="chart-data-preview">
                    <table>
                        <thead>
                            <tr>
                                <th>{move || s.t("Category")}</th>
                                <th>{move || s.t("Value")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {move || {
                                points
                                    .get()
                                    .into_iter()
                                    .take(20)
                                    .map(|point| {
                                        view! {
                                            <tr>
                                                <td>{text(&point, "label")}</td>
                                                <td>{point["value"].to_string()}</td>
                                            </tr>
                                        }
                                    })
                                    .collect_view()
                            }}
                        </tbody>
                    </table>
                </div>
            </main>
            <aside class="chart-data-sidebar">
                <h3>{move || s.t("Available tables")}</h3>
                <p class="helper">
                    {move || s.t("Choose a table, then assign fields as category or value.")}
                </p>
                <Show when=move || array(&s.project.get()["datasets"]).is_empty()>
                    <p>{move || s.t("No tables available. Add a table in Data first.")}</p>
                </Show>
                {move || {
                    array(&s.project.get()["datasets"])
                        .into_iter()
                        .map(|table| {
                            let selected = draft()["dataset"] == table["id"];
                            let use_table = table.clone();
                            let fields = array(&table["schema"]["fields"]);
                            view! {
                                <details open=selected>
                                    <summary>{text(&table, "name")}</summary>
                                    <Button
                                        label="Use this table"
                                        on_press=move |_| bind(s, &use_table, None)
                                    />
                                    <div class="chart-source-fields">
                                        {fields
                                            .into_iter()
                                            .map(|field| {
                                                let category_table = table.clone();
                                                let value_table = table.clone();
                                                let name = text(&field, "name");
                                                let category_name = name.clone();
                                                let value_name = name.clone();
                                                let numeric = field["type"] == "number";
                                                view! {
                                                    <div>
                                                        <span title=name
                                                            .clone()>
                                                            {format!("{} {}", if numeric { "#" } else { "Aa" }, name)}
                                                        </span>
                                                        <Button
                                                            class="chart-binding-button"
                                                            label="Category"
                                                            on_press=move |_| bind(
                                                                s,
                                                                &category_table,
                                                                Some((&category_name, false)),
                                                            )
                                                        />
                                                        {numeric
                                                            .then(|| {
                                                                view! {
                                                                    <Button
                                                                        class="chart-binding-button"
                                                                        label="Value"
                                                                        on_press=move |_| bind(
                                                                            s,
                                                                            &value_table,
                                                                            Some((&value_name, true)),
                                                                        )
                                                                    />
                                                                }
                                                            })}
                                                    </div>
                                                }
                                            })
                                            .collect_view()}
                                    </div>
                                </details>
                            }
                        })
                        .collect_view()
                }}
            </aside>
        </div>
    }
}
