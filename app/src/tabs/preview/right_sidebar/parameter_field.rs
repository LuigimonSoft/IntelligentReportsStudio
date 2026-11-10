//! Preview-only parameter controls: no editor actions or persistence settings.
use crate::{domain::*, state::studio};
use leptos::prelude::*;
use serde_json::json;
use std::collections::BTreeSet;

/// Match the runtime's ISO date and required-value validation in the preview form.
fn parameter_error(parameter: &serde_json::Value, value: &str) -> Option<&'static str> {
    let value = value.trim();
    if value.is_empty() {
        return (parameter["required"] == true).then_some("Enter a value for this required parameter.");
    }
    match parameter["type"].as_str() {
        Some("boolean") if value != "true" && value != "false" => Some("Choose true or false."),
        Some("number") if !value.parse::<f64>().is_ok_and(f64::is_finite) => Some("Enter a valid number."),
        Some("date") if !valid_date(value) => Some("Enter a valid date (YYYY-MM-DD)."),
        _ => None,
    }
}

fn valid_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 10 || bytes[4] != b'-' || bytes[7] != b'-'
        || !bytes.iter().enumerate().all(|(i, byte)| i == 4 || i == 7 || byte.is_ascii_digit()) {
        return false;
    }
    let year = value[0..4].parse::<u32>().unwrap_or(0);
    let month = value[5..7].parse::<usize>().unwrap_or(0);
    let day = value[8..10].parse::<u32>().unwrap_or(0);
    if year == 0 || !(1..=12).contains(&month) { return false; }
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let days = [31, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    day > 0 && day <= days[month - 1]
}

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
    let error = move || parameter_error(&parameter.get(), &value());
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
            <span>{move || s.t(&text(&parameter.get(),"label"))}
                <Show when=move || parameter.get()["required"] == true>
                    <span class="parameter-required" aria-hidden="true">" *"</span>
                    <span class="parameter-required-label">{move || s.t("Required")}</span>
                </Show>
            </span>
            <Show when=move || parameter.get()["type"] == "boolean" fallback=move || view! {
            <Show when=move || parameter.get()["type"] == "select" fallback=move || view! {
                <input type=move || match parameter.get()["type"].as_str() { Some("date")=>"date",Some("number")=>"number",_=>"text" }
                    step="any" maxlength="200" prop:value=value
                    required=move || parameter.get()["required"] == true
                    aria-invalid=move || error().is_some()
                    on:change=move |event| update.run(event_target_value(&event)) />
            }>
                <select prop:value=value required=move || parameter.get()["required"] == true aria-invalid=move || error().is_some() on:change=move |event| update.run(event_target_value(&event))>
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
                <select prop:value=value required=move || parameter.get()["required"] == true aria-invalid=move || error().is_some() on:change=move |event| update.run(event_target_value(&event))>
                    <option value="">{move || s.t("Select value")}</option>
                    <option value="true">{move || s.t("True")}</option>
                    <option value="false">{move || s.t("False")}</option>
                </select>
            </Show>
            {move || error().map(|message| view! { <small class="parameter-error" role="alert">{s.t(message)}</small> })}
        </label>
    }
}
