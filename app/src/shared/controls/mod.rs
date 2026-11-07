use crate::state::studio;
use leptos::prelude::*;
use serde_json::Value;
pub mod base_button;
pub use base_button::BaseButton;
pub use base_button::BaseButton as Button;
#[component]
pub fn ActionButton(
    label: &'static str,
    #[prop(optional)] icon: &'static str,
    #[prop(optional)] primary: bool,
    #[prop(optional)] disabled: Option<Signal<bool>>,
    #[prop(optional)] action: Option<&'static str>,
) -> impl IntoView {
    let s = studio();
    let tool = action.filter(|action| {
        [
            "add-text",
            "add-image",
            "add-line",
            "add-rectangle",
            "add-table",
            "add-chart",
            "add-shape",
            "add-subreport",
        ]
        .contains(action)
    });
    view! {
        <Button
            label
            icon
            primary
            disabled=disabled.unwrap_or_else(|| Signal::derive(|| false))
            tool=tool
            on_press=move |_| s.command(action.unwrap_or(label), Value::Null)
        />
    }
    .into_any()
}
#[component]
pub fn NumberField(
    label: &'static str,
    value: Signal<f64>,
    #[prop(into)] on_change: Callback<f64>,
) -> impl IntoView {
    let s = studio();
    view! {
        <label class="property">
            <span>{move || s.t(label)}</span>
            <input
                type="number"
                step="0.05"
                prop:value=move || value.get().to_string()
                on:change=move |e| {
                    if let Ok(n) = event_target_value(&e).parse::<f64>() {
                        if n.is_finite() {
                            on_change.run(n)
                        }
                    }
                }
            />
        </label>
    }
}
