use crate::{domain::*, shared::controls::*, state::studio};
use leptos::prelude::*;
use serde_json::json;
#[component]
pub fn RecordsSidebar() -> impl IntoView {
    let s = studio();
    view! {
        <aside class="records-sidebar">
            <h3>{move || s.t("Filters and parameters")}</h3>
            <Button
                label="Add parameter"
                on_press=move |_| {
                    s.show_json(
                        "Parameter",
                        json!(
                            {"id":"parameter","label":"Parameter","type":"text","dataset":s.table.get_untracked(),"field":"","operator":"contains","saveValue":false}
                        ),
                    )
                }
            />
            {move || {
                array(&s.project.get()["parameters"])
                    .into_iter()
                    .map(|p| {
                        let id = text(&p, "id");
                        let remove = id.clone();
                        let update = id.clone();
                        let save = id.clone();
                        let edit = p.clone();
                        view! {
                            <div class="parameter">
                                <div class="parameter-heading">
                                    <strong>{text(&p, "label")}</strong>
                                    <Button
                                        label="Edit parameter"
                                        compact=true
                                        on_press=move |_| s.show_json("Parameter", edit.clone())
                                    />
                                    <Button
                                        label="Remove parameter"
                                        compact=true
                                        on_press=move |_| {
                                            s.command("remove-parameter", json!({"id":remove}))
                                        }
                                    />
                                </div>
                                {if p["type"] == "boolean" {
                                    let current = p["value"].as_str().or(p["defaultValue"].as_str()).unwrap_or("").to_owned();
                                    view! {
                                        <select aria-label=text(&p, "label") prop:value=current
                                            on:change=move |e| {
                                                let value = event_target_value(&e);
                                                s.mutate(|project| {
                                                    for parameter in project["parameters"].as_array_mut().into_iter().flatten() {
                                                        if parameter["id"] == update { parameter["value"] = json!(value); }
                                                    }
                                                });
                                            }>
                                            <option value="">{s.t("Select value")}</option>
                                            <option value="true">{s.t("True")}</option>
                                            <option value="false">{s.t("False")}</option>
                                        </select>
                                    }.into_any()
                                } else {
                                    view! {
                                        <input
                                            type=match p["type"].as_str() { Some("date") => "date", Some("number") => "number", _ => "text" }
                                            aria-label=text(&p, "label")
                                            value=p["value"].as_str().or(p["defaultValue"].as_str()).unwrap_or("").to_owned()
                                            on:change=move |e| {
                                                let value = event_target_value(&e);
                                                s.mutate(|project| {
                                                    for parameter in project["parameters"].as_array_mut().into_iter().flatten() {
                                                        if parameter["id"] == update { parameter["value"] = json!(value); }
                                                    }
                                                });
                                            }
                                        />
                                    }.into_any()
                                }}
                                <label class="check">
                                    <input
                                        type="checkbox"
                                        checked=p["saveValue"] != false
                                        on:change=move |e| {
                                            s.mutate(|project| {
                                                for p in project["parameters"]
                                                    .as_array_mut()
                                                    .into_iter()
                                                    .flatten()
                                                {
                                                    if p["id"] == save {
                                                        p["saveValue"] = json!(event_target_checked(&e));
                                                    }
                                                }
                                            });
                                        }
                                    />
                                    {s.t("Save value in JSON")}
                                </label>
                            </div>
                        }
                    })
                    .collect_view()
            }}
            <Button
                label="Add record"
                on_press=move |_| {
                    s.original_record.set(serde_json::Value::Null);
                    s.show_json("Record", json!({}));
                }
            />
            <ActionButton label="Apply filters" primary=true action="query" />
        </aside>
    }
}
