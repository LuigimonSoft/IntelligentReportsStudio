mod chart_editor;
mod data_table_editor;
mod definition_fields;
mod grouping_editor;
mod import_tables;
mod native_window;
mod print_settings;
mod query_editor;
mod record_editor;
mod relationship_editor;
pub use native_window::NativeEditorWindow;
pub use print_settings::{page_preset, paper_dimensions};

use crate::{shared::controls::Button, state::studio};
use leptos::prelude::*;
#[cfg(feature = "csr")]
use serde_json::json;
use serde_json::Value;
#[component]
pub fn EditorDialog() -> impl IntoView {
    let s = studio();
    let relation_valid = RwSignal::new(false);
    let table_valid = RwSignal::new(false);
    let import_valid = RwSignal::new(false);
    let grouping_valid = RwSignal::new(false);
    view! {
        <Show when=move || {
            !s.dialog.get().is_empty()
                && (!crate::platform::editor_windows::native_desktop()
                    || crate::platform::editor_windows::editor_window())
        }>
            <div class="modal-backdrop">
                <section role="dialog" aria-modal="true" class="editor-dialog">
                    <header>
                        <h2>
                            {move || {
                                let kind = s.dialog.get();
                                s.t(
                                    if kind == "Query" {
                                        "Edit query"
                                    } else if kind == "Chart" {
                                        "Chart editor"
                                    } else if kind == "Data table" { "Edit table"
                                    } else if kind == "Relationship" {
                                        if relationship_editor::is_editing(s) { "Edit relationship" } else { "Add relationship" }
                                    } else {
                                        &kind
                                    },
                                )
                            }}
                        </h2>
                        <Button label="Close" on_press=move |_| close_editor(s) />
                    </header>
                    <div class="editor-dialog-body">
                        {move || match s.dialog.get().as_str() {
                            "Grouping" => view! { <grouping_editor::GroupingEditor valid=grouping_valid /> }.into_any(),
                            "Import tables" => view! { <import_tables::ImportTables valid=import_valid /> }.into_any(),
                            "Query" => view! { <query_editor::QueryEditor /> }.into_any(),
                            "Print settings" => view! { <print_settings::PrintSettings /> }.into_any(),
                            "Formula" => view! { <definition_fields::FormulaEditor /> }.into_any(),
                            "Relationship" => view! { <relationship_editor::RelationshipEditor valid=relation_valid /> }.into_any(),
                            "Parameter" => view! { <definition_fields::ParameterEditor /> }.into_any(),
                            "Add table" | "Data table" => {
                                view! { <data_table_editor::DataTableEditor valid=table_valid /> }.into_any()
                            }
                            "Record" => view! { <record_editor::RecordEditor /> }.into_any(),
                            "Chart" => view! { <definition_fields::ChartEditor /> }.into_any(),
                            _ => {
                                view! { <p>{s.t("Edit the definition and apply your changes.")}</p> }
                                    .into_any()
                            }
                        }}
                        <details
                            class="advanced-definition"
                            hidden=move || matches!(s.dialog.get().as_str(), "Chart" | "Relationship" | "Add table" | "Data table" | "Print settings" | "Import tables" | "Grouping")
                            open=move || {
                                ![
                                    "Formula",
                                    "Relationship",
                                    "Parameter",
                                    "Chart",
                                    "Add table",
                                    "Data table",
                                    "Record",
                                    "Query",
                                ]
                                    .contains(&s.dialog.get().as_str())
                            }
                        >
                            <summary>{move || s.t("Advanced JSON definition")}</summary>
                            <textarea
                                aria-label="Definition"
                                spellcheck="false"
                                prop:value=move || s.draft.get()
                                on:input=move |e| s.draft.set(event_target_value(&e))
                            ></textarea>
                        </details>
                        <p class="editor-message" role="status">
                            {move || s.t(&s.message.get())}
                        </p>
                    </div>
                    <footer>
                        <Button label="Cancel" on_press=move |_| close_editor(s) />
                        {move || {
                            let label = match s.dialog.get().as_str() {
                                "Grouping" => "Save groups",
                                "Import tables" => "Import tables",
                                "Formula" => "Save formula",
                                "Chart" => "Apply chart",
                                "Parameter" => "Save parameter",
                                "Add table" => "Add table",
                                "Data table" | "Record" => "Save changes",
                                "Relationship" => {
                                    let id = serde_json::from_str::<Value>(&s.draft.get_untracked())
                                        .ok()
                                        .and_then(|v| v["id"].as_str().map(str::to_owned))
                                        .unwrap_or_default();
                                    if crate::domain::array(&s.project.get()["relations"])
                                        .iter()
                                        .any(|r| r["id"] == id)
                                    {
                                        "Save relationship"
                                    } else {
                                        "Create relationship"
                                    }
                                }
                                _ => "Apply",
                            };
                            view! {
                                <Button
                                    label
                                    primary=true
                                    disabled=Signal::derive(move || (s.dialog.get() == "Relationship" && !relation_valid.get()) || (matches!(s.dialog.get().as_str(), "Add table" | "Data table") && !table_valid.get()) || (s.dialog.get() == "Import tables" && !import_valid.get()) || (s.dialog.get() == "Grouping" && !grouping_valid.get()))
                                    on_press=move |_| {
                                        match serde_json::from_str::<
                                            Value,
                                        >(&s.draft.get_untracked()) {
                                            Ok(value) => {
                                                if s.dialog.get_untracked() == "Print settings" && !print_settings::valid(&value) {
                                                    s.message.set("Invalid page size or margins.".into());
                                                    return;
                                                }
                                                if s.dialog.get_untracked() == "Formula" {
                                                    #[cfg(feature = "csr")]
                                                    leptos::task::spawn_local(async move {
                                                        match crate::platform::call(
                                                                json!(
                                                                    {"action":"formula-preview","project":s.project.get_untracked(),"args":value}
                                                                ),
                                                            )
                                                            .await
                                                        {
                                                            Ok(check) if check["valid"] == true => {
                                                                let formula = json!(
                                                                    {"name":value["name"].as_str().unwrap_or("").trim(),"expression":value["expression"].as_str().unwrap_or("").trim()}
                                                                );
                                                                save_editor(s, "Formula", formula);
                                                            }
                                                            Ok(check) => {
                                                                s.message
                                                                    .set(
                                                                        if check["validation"].as_str().unwrap_or("").is_empty() {
                                                                            check["error"]
                                                                                .as_str()
                                                                                .unwrap_or("Invalid formula.")
                                                                                .to_owned()
                                                                        } else {
                                                                            check["validation"].as_str().unwrap_or_default().to_owned()
                                                                        },
                                                                    )
                                                            }
                                                            Err(error) => s.message.set(error),
                                                        }
                                                    });
                                                    return;
                                                }
                                                save_editor(s, &s.dialog.get_untracked(), value);
                                            }
                                            Err(error) => s.message.set(error.to_string()),
                                        }
                                    }
                                />
                            }
                        }}
                    </footer>
                </section>
            </div>
        </Show>
    }
}

fn close_editor(s: crate::state::Studio) {
    #[cfg(feature = "csr")]
    if crate::platform::editor_windows::editor_window() {
        leptos::task::spawn_local(async move {
            if let Err(error) =
                crate::platform::editor_windows::call("finish_editor", json!({"result":null})).await
            {
                s.message.set(error);
            }
        });
        return;
    }
    s.dialog.set(String::new());
}
fn save_editor(s: crate::state::Studio, kind: &str, value: Value) {
    #[cfg(feature = "csr")]
    if crate::platform::editor_windows::editor_window() {
        let kind = kind.to_owned();
        leptos::task::spawn_local(async move {
            // Validate against the snapshot before dismissing the native window.
            if kind == "Import tables" {
                if let Err(error) = crate::platform::call(json!({"action":"import-tables","project":s.project.get_untracked(),"args":value})).await { s.message.set(error); return; }
            } else if kind != "Query" && kind != "Print settings" {
                let result = crate::platform::call(json!({"action":"apply-definition","project":s.project.get_untracked(),"args":{"kind":kind,"value":value,"table":s.table.get_untracked(),"original":s.original_record.get_untracked()},"selected":s.selected.get_untracked(),"band":s.band.get_untracked()})).await;
                if let Err(error) = result {
                    s.message.set(error);
                    return;
                }
            }
            if let Err(error) =
                crate::platform::editor_windows::call("finish_editor", json!({"result":value}))
                    .await
            {
                s.message.set(error);
            }
        });
        return;
    }
    s.apply_editor_value(kind, value);
    s.dialog.set(String::new());
}
