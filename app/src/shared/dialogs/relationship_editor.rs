//! Relationship form: grouped endpoints and a live preview from the shared engine.
use super::definition_fields::draft;
use crate::{
    domain::*,
    state::{studio, Studio},
};
use leptos::prelude::*;
use serde_json::{json, Value};

pub(super) fn is_editing(s: Studio) -> bool {
    let value: Value = serde_json::from_str(&s.draft.get()).unwrap_or_default();
    array(&s.project.get()["relations"])
        .iter()
        .any(|r| r["id"] == value["id"])
}
fn endpoint_value(value: &Value) -> String {
    json!([value["dataset"], value["field"]]).to_string()
}

#[component]
fn EndpointSelect(side: &'static str, label: &'static str) -> impl IntoView {
    let s = studio();
    view! {
        <label>
            {move || s.t(label)}
            <select aria-label=label prop:value=move || endpoint_value(&draft()[side])
                on:change=move |event| {
                    if let Ok(parts) = serde_json::from_str::<Vec<String>>(&event_target_value(&event)) {
                        if parts.len() == 2 {
                            let mut value = draft();
                            value[side] = json!({"dataset":parts[0],"field":parts[1]});
                            s.draft.set(value.to_string());
                        }
                    }
                }
            >
                {move || array(&s.project.get()["datasets"]).into_iter().map(|table| {
                    let id = text(&table,"id");
                    view! {
                        <optgroup label=text(&table,"name")>
                            {array(&table["schema"]["fields"]).into_iter().map(|field| {
                                let endpoint = json!({"dataset":id,"field":field["name"]});
                                let value = endpoint_value(&endpoint);
                                let name = format!("{} · {} ({})",text(&table,"name"),text(&field,"name"),if field["type"] == "number" {"NUMBER"} else {"TEXT"});
                                view! { <option value=value selected=move || draft()[side] == endpoint>{name}</option> }
                            }).collect_view()}
                        </optgroup>
                    }
                }).collect_view()}
            </select>
        </label>
    }
}
#[component]
pub(super) fn RelationshipEditor(valid: RwSignal<bool>) -> impl IntoView {
    valid.set(false);
    let s = studio();
    let preview = RwSignal::new(Value::Null);
    #[cfg(feature = "csr")]
    let endpoints = RwSignal::new(Value::Null);
    // Fill missing defaults for toolbar-created relations, preserving edits and drag endpoints.
    let mut value = draft();
    let tables = array(&s.project.get_untracked()["datasets"]);
    for side in ["from", "to"] {
        let table = tables
            .iter()
            .find(|table| table["id"] == value[side]["dataset"])
            .or_else(|| {
                tables
                    .iter()
                    .find(|table| side == "from" || table["id"] != value["from"]["dataset"])
            });
        if let Some(table) = table {
            if !array(&table["schema"]["fields"])
                .iter()
                .any(|field| field["name"] == value[side]["field"])
                || value[side]["dataset"] != table["id"]
            {
                value[side] =
                    json!({"dataset":table["id"],"field":table["schema"]["fields"][0]["name"]});
            }
        }
    }
    s.draft.set(value.to_string());
    #[cfg(feature = "csr")]
    Effect::new(move |_| {
        let value = draft();
        let project = s.project.get();
        let snapshot = s.draft.get();
        let pair = json!([value["from"], value["to"]]);
        let suggest = endpoints.get_untracked() != pair
            && (!endpoints.get_untracked().is_null() || !is_editing(s));
        endpoints.set(pair);
        valid.set(false);
        leptos::task::spawn_local(async move {
            match crate::platform::call(
                json!({"action":"relationship-preview","project":project,"args":value}),
            )
            .await
            {
                Ok(check) if s.draft.get_untracked() == snapshot => {
                    if suggest && value["cardinality"] != check["cardinality"] {
                        let mut next = value;
                        next["cardinality"] = check["cardinality"].clone();
                        s.draft.set(next.to_string());
                    }
                    valid.set(check["error"] == "");
                    preview.set(check);
                }
                Err(error) => {
                    preview.set(json!({"error":error}));
                }
                _ => {}
            }
        });
    });
    view! {
        <div class="relationship-editor">
            <p class="model-help">{move || s.t("Connect columns containing the same value, such as a customer ID and customer_id.")}</p>
            <div class="relation-endpoints">
                <EndpointSelect side="from" label="Source column" />
                <crate::shared::icons::Icon name="link" />
                <EndpointSelect side="to" label="Target column" />
            </div>
            <label>
                {move || s.t("Cardinality")}
                <select aria-label="Cardinality" prop:value=move || text(&draft(),"cardinality") on:change=move |event| {
                    let mut value = draft(); value["cardinality"] = json!(event_target_value(&event)); s.draft.set(value.to_string());
                }>
                    {[("1:n","One to many (1:N)"),("n:1","Many to one (N:1)"),("1:1","One to one (1:1)"),("n:n","Many to many (N:N)")].into_iter().map(|(value,label)| view! {
                        <option value=value selected=move || draft()["cardinality"] == value>{move || s.t(label)}</option>
                    }).collect_view()}
                </select>
            </label>
            <div class="relation-preview" aria-live="polite">
                <Show when=move || preview.get()["error"] == "" fallback=move || view! { <p role="alert">{move || s.t(preview.get()["error"].as_str().unwrap_or("Select both columns."))}</p> }>
                    <strong>{move || format!("{}.{} = {}.{}",text(&draft()["from"],"dataset"),text(&draft()["from"],"field"),text(&draft()["to"],"dataset"),text(&draft()["to"],"field"))}</strong>
                    <span>{move || s.t("{0} matches · {1} unmatched source rows").replace("{0}",&preview.get()["matches"].to_string()).replace("{1}",&preview.get()["unmatched"].to_string())}</span>
                    <small>{move || s.t("Equal values are compared. Null values do not join. In Data, choose INNER or LEFT JOIN.")}</small>
                </Show>
            </div>
        </div>
    }
}
