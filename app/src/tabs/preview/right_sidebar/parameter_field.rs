//! Preview-only parameter controls: no editor actions or persistence settings.
use crate::{domain::*, state::studio};
use leptos::prelude::*;
use serde_json::json;
use std::collections::BTreeSet;

#[component]
pub(super) fn ParameterField(id: String) -> impl IntoView {
    let s = studio();
    let lookup = id.clone();
    let parameter = move || {
        array(&s.project.get()["parameters"])
            .into_iter()
            .find(|parameter| parameter["id"] == lookup)
            .unwrap_or_default()
    };
    let parameter = Signal::derive(parameter);
    let value = move || {
        let p = parameter.get();
        let value = if p["value"].is_null() {
            &p["defaultValue"]
        } else {
            &p["value"]
        };
        value.as_str().map(str::to_owned).unwrap_or_else(|| {
            if value.is_null() {
                String::new()
            } else {
                value.to_string()
            }
        })
    };
    let update = Callback::new(move |value: String| {
        s.mutate(|project| {
            for parameter in project["parameters"].as_array_mut().into_iter().flatten() {
                if parameter["id"] == id {
                    parameter["value"] = json!(value);
                }
            }
        })
    });
    view! {
        <label class="preview-parameter-field">
            <span>{move || s.t(&text(&parameter.get(),"label"))}</span>
            <Show when=move || parameter.get()["type"] == "boolean" fallback=move || view! {
            <Show when=move || parameter.get()["type"] == "select" fallback=move || view! {
                <input type=move || match parameter.get()["type"].as_str() { Some("date")=>"date",Some("number")=>"number",_=>"text" }
                    step="any" maxlength="200" prop:value=value
                    on:change=move |event| update.run(event_target_value(&event)) />
            }>
                <select prop:value=value on:change=move |event| update.run(event_target_value(&event))>
                    <option value="">{move || s.t("All")}</option>
                    {move || {
                        let p = parameter.get();
                        let mut options = array(&s.project.get()["datasets"]).into_iter().find(|table| table["id"] == p["dataset"])
                            .map(|table| array(&table["data"]).into_iter().map(|row| {
                                let value=&row[text(&p,"field")];
                                value.as_str().map(str::to_owned).unwrap_or_else(|| if value.is_null() { String::new() } else { value.to_string() })
                            }).filter(|value| !value.is_empty()).collect::<BTreeSet<_>>()).unwrap_or_default();
                        let current=value();if !current.is_empty() {options.insert(current);}
                        options.into_iter().map(|option| {let selected=option.clone();view! {
                            <option value=option.clone() selected=move || value()==selected>{option.clone()}</option>
                        }}).collect_view()
                    }}
                </select>
            </Show>
            }>
                <select prop:value=value on:change=move |event| update.run(event_target_value(&event))>
                    <option value="">{move || s.t("Select value")}</option>
                    <option value="true">{move || s.t("True")}</option>
                    <option value="false">{move || s.t("False")}</option>
                </select>
            </Show>
        </label>
    }
}
