use crate::{domain::text, state::studio};
use leptos::prelude::*;
use serde_json::{json, Value};

/// Preserve the field payload, including the value format, across both insertion methods.
#[component]
pub fn FieldButton(token: Value) -> impl IntoView {
    let s = studio();
    let kind = text(&token, "kind");
    let expression = text(&token, "text");
    let label = text(&token, "label");
    let name = if token["dataset"].is_string() {
        label.split(" · ").skip(1).collect::<Vec<_>>().join(" · ")
    } else {
        label.clone()
    };
    let payload = token.to_string();
    let drag_token = token.clone();
    let (symbol, badge) = match kind.as_str() {
        "number" => ("#", "NUM"),
        "boolean" => ("✓", "✓"),
        "formula" => ("Σ", "Σ"),
        "special" => ("✦", "#"),
        _ => ("A", "STR"),
    };
    view! {
        <button
            type="button"
            class=format!("field-chip field-kind-{kind}")
            draggable="true"
            title=format!("{label}: {expression}")
            data-field-text=expression.clone()
            on:dragstart=move |event| {
                s.dragged_field.set(Some(drag_token.clone()));
                if let Some(data) = event.data_transfer() {
                    let _ = data.set_data("application/x-reportstudio-field", &payload);
                    let _ = data.set_data("text/plain", &expression);
                    data.set_effect_allowed("copy");
                }
            }
            on:dragend=move |_| s.dragged_field.set(None)
            on:click=move |_| s.command("add-field", json!({"field":token}))
        >
            <span class="field-symbol">{symbol}</span>
            <span class="field-name">{name}</span>
            <small>{badge}</small>
        </button>
    }
    .into_any()
}
