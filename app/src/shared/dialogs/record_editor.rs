use crate::{domain::*, state::studio};
use leptos::prelude::*;
use serde_json::{json, Value};

/// Edit typed record values against the selected table's schema.
#[component]
pub fn RecordEditor() -> impl IntoView {
    let s = studio();
    let table = array(&s.project.get_untracked()["datasets"])
        .into_iter()
        .find(|t| text(t, "id") == s.table.get_untracked())
        .unwrap_or_default();
    view! {
        <div class="record-editor">
            {array(&table["schema"]["fields"])
                .into_iter()
                .map(|field| {
                    let name = text(&field, "name");
                    let value_key = name.clone();
                    let edit_key = name.clone();
                    let kind = text(&field, "type");
                    view! {
                        <label class="property">
                            {name}
                            <input
                                type=if kind == "number" { "number" } else { "text" }
                                prop:value=move || {
                                    let draft = serde_json::from_str::<Value>(&s.draft.get())
                                        .unwrap_or_default();
                                    let value = &draft[&value_key];
                                    value
                                        .as_str()
                                        .map(str::to_owned)
                                        .unwrap_or_else(|| {
                                            if value.is_null() {
                                                String::new()
                                            } else {
                                                value.to_string()
                                            }
                                        })
                                }
                                on:change=move |event| {
                                    let mut draft = serde_json::from_str::<
                                        Value,
                                    >(&s.draft.get_untracked())
                                        .unwrap_or_else(|_| json!({}));
                                    let value = event_target_value(&event);
                                    draft[&edit_key] = if value.is_empty() {
                                        Value::Null
                                    } else if kind == "number" {
                                        match value.parse::<f64>() {
                                            Ok(number) if number.is_finite() => json!(number),
                                            _ => return,
                                        }
                                    } else if kind == "boolean" {
                                        match value.as_str() {
                                            "true" => json!(true),
                                            "false" => json!(false),
                                            _ => {
                                                s.message.set(s.t("Use true or false for boolean values."));
                                                return;
                                            }
                                        }
                                    } else {
                                        json!(value)
                                    };
                                    s.draft.set(draft.to_string());
                                }
                            />
                        </label>
                    }
                })
                .collect_view()}
        </div>
    }
}
