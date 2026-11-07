use crate::{domain::font_stack, state::studio};
use leptos::prelude::*;
pub fn options(items: &[(&str, &str)]) -> Vec<(String, String)> {
    let s = studio();
    items.iter().map(|(v, l)| (v.to_string(), s.t(l))).collect()
}
#[component]
pub fn InspectorSection(
    title: &'static str,
    #[prop(optional)] hint: &'static str,
    children: Children,
) -> impl IntoView {
    let s = studio();
    view! {
        <section class="inspector-section">
            <h3>
                {move || s.t(title)}{(!hint.is_empty()).then(|| view! { <span>{s.t(hint)}</span> })}
            </h3>
            {children()}
        </section>
    }
    .into_any()
}
#[component]
pub fn TextField(
    label: &'static str,
    value: String,
    #[prop(into)] on_change: Callback<String>,
    #[prop(optional)] multiline: bool,
    #[prop(optional)] caption: Option<&'static str>,
) -> impl IntoView {
    let s = studio();
    view! {
        <label class="field">
            <span>{move || s.t(caption.unwrap_or(label))}</span>
            {if multiline {
                view! {
                    <textarea
                        aria-label=move || s.t(label)
                        rows="3"
                        class:content-editor=label == "Text or expression"
                        prop:value=value
                        on:change=move |e| on_change.run(event_target_value(&e))
                    ></textarea>
                }
                    .into_any()
            } else {
                view! {
                    <input
                        aria-label=move || s.t(label)
                        prop:value=value
                        on:change=move |e| on_change.run(event_target_value(&e))
                    />
                }
                    .into_any()
            }}
        </label>
    }
    .into_any()
}
#[component]
pub fn SelectField(
    label: &'static str,
    value: String,
    options: Vec<(String, String)>,
    #[prop(default = true)] show_label: bool,
    #[prop(optional)] disabled_values: Vec<String>,
    #[prop(into)] on_change: Callback<String>,
) -> impl IntoView {
    let s = studio();
    view! {
        <label class="field">
            {show_label.then(|| view! { <span>{move || s.t(label)}</span> })}
            <select
                aria-label=move || s.t(label)
                prop:value=value.clone()
                on:change=move |e| on_change.run(event_target_value(&e))
            >
                {options
                    .into_iter()
                    .map(|(id, label)| {
                        view! {
                            <option
                                selected=id == value
                                disabled=disabled_values.contains(&id)
                                value=id
                            >
                                {label}
                            </option>
                        }
                    })
                    .collect_view()}
            </select>
        </label>
    }
    .into_any()
}
#[component]
pub fn MetricField(
    label: &'static str,
    value: f64,
    #[prop(default = 0.0)] min: f64,
    #[prop(default = 100.0)] max: f64,
    #[prop(default = 0.05)] step: f64,
    #[prop(into)] on_change: Callback<f64>,
) -> impl IntoView {
    let s = studio();
    view! {
        <label class="field">
            <span>{move || s.t(label)}</span>
            <input
                aria-label=move || s.t(label)
                type="number"
                min=min
                max=max
                step=step
                prop:value=value
                on:change=move |e| {
                    if let Ok(v) = event_target_value(&e).parse::<f64>() {
                        if v.is_finite() {
                            on_change.run(v.clamp(min, max.max(min)))
                        }
                    }
                }
            />
        </label>
    }
    .into_any()
}
#[component]
pub fn CheckField(
    label: &'static str,
    checked: bool,
    #[prop(optional)] disabled: bool,
    #[prop(default = true)] toggle: bool,
    #[prop(into)] on_change: Callback<bool>,
) -> impl IntoView {
    let s = studio();
    view! {
        <label class="checkbox-field" class:toggle-row=toggle>
            <input
                aria-label=move || s.t(label)
                type="checkbox"
                prop:checked=checked
                disabled=disabled
                on:change=move |e| on_change.run(event_target_checked(&e))
            />
            {move || s.t(label)}
        </label>
    }
    .into_any()
}
#[component]
pub fn ColorField(
    #[prop(optional)] plain: bool,
    #[prop(default = true)] show_code: bool,
    label: &'static str,
    value: String,
    #[prop(into)] on_change: Callback<String>,
) -> impl IntoView {
    let s = studio();
    let value = if value.starts_with('#') && value.len() == 7 {
        value
    } else {
        "#ffffff".into()
    };
    view! {
        <label class="field">
            <span>{move || s.t(label)}</span>
            {if plain {
                view! {
                    <input
                        class="plain-color"
                        type="color"
                        aria-label=move || s.t(label)
                        prop:value=value
                        on:change=move |e| on_change.run(event_target_value(&e))
                    />
                }
                    .into_any()
            } else {
                view! {
                    <div class="color-control">
                        <input
                            type="color"
                            aria-label=move || s.t(label)
                            prop:value=value.clone()
                            on:change=move |e| on_change.run(event_target_value(&e))
                        />
                        {show_code.then(|| view! { <code>{value.to_uppercase()}</code> })}
                    </div>
                }
                    .into_any()
            }}
        </label>
    }
    .into_any()
}
#[component]
pub fn FontField(value: String, #[prop(into)] on_change: Callback<String>) -> impl IntoView {
    let s = studio();
    let choices = options(&[
        ("", "Document default"),
        ("sans-serif", "Arial / Helvetica (sans serif)"),
        ("serif", "Times New Roman / Times (serif)"),
        ("monospace", "Courier New / Courier (monospace)"),
        ("verdana", "Verdana"),
        ("tahoma", "Tahoma"),
        ("trebuchet", "Trebuchet MS"),
        ("segoe", "Segoe UI"),
        ("system", "System font"),
        ("georgia", "Georgia"),
        ("palatino", "Palatino"),
        ("garamond", "Garamond"),
        ("consolas", "Consolas / Menlo"),
    ]);
    view! {
        <label class="field">
            <span>{move || s.t("Font family")}</span>
            <select
                aria-label=move || s.t("Font family")
                data-layout=crate::platform::layout_styles::LayoutStyle::new()
                    .apply(format!("font-family:{}", font_stack(&value)))
                prop:value=value.clone()
                on:change=move |e| on_change.run(event_target_value(&e))
            >
                {choices
                    .into_iter()
                    .map(|(id, label)| {
                        view! {
                            <option
                                selected=id == value
                                data-layout=crate::platform::layout_styles::LayoutStyle::new()
                                    .apply(format!("font-family:{}", font_stack(&id)))
                                value=id
                            >
                                {label}
                            </option>
                        }
                    })
                    .collect_view()}
            </select>
        </label>
    }
    .into_any()
}
