use crate::state::studio;
use leptos::prelude::*;
#[component]
pub fn BaseButton(
    label: &'static str,
    #[prop(optional)] icon: &'static str,
    #[prop(into)] on_press: Callback<()>,
    #[prop(optional)] primary: bool,
    #[prop(optional)] disabled: Option<Signal<bool>>,
    #[prop(optional)] compact: bool,
    #[prop(optional)] class: &'static str,
    #[prop(optional)] active: Option<Signal<bool>>,
    #[prop(optional_no_strip)] tool: Option<&'static str>,
) -> impl IntoView {
    let resolved_icon = if icon.is_empty() {
        crate::shared::icons::icon_for(label)
    } else {
        icon
    };
    let compact = compact
        || matches!(
            label,
            "Toggle theme"
                | "Zoom in"
                | "Zoom out"
                | "Fit"
                | "Cut"
                | "Copy"
                | "Paste"
                | "Undo"
                | "Redo"
                | "Previous page"
                | "Next page"
                | "Close"
                | "Fit page"
                | "Fit model"
                | "Search document"
                | "Fullscreen"
                | "Download PDF"
                | "Bold"
                | "Italic"
        );
    let s = studio();
    view! {
        <button
            type="button"
            class=format!("button studio-button {class}")
            aria-label=move || {
                s.t(
                    if label == "Formula" {
                        "Add formula"
                    } else if label == "Toggle theme" {
                        if s.dark.get() { "Switch to light mode" } else { "Switch to dark mode" }
                    } else {
                        label
                    },
                )
            }
            disabled=move || {
                disabled.is_some_and(|v| v.get())
                    || match label {
                        "Undo" => s.history.get().is_empty(),
                        "Redo" => s.future.get().is_empty(),
                        "Save formula" => !s.formula_valid.get(),
                        "Copy" => s.selected.get().is_empty(),
                        "Cut" => {
                            s.selected.get().is_empty()
                                || crate::domain::read_only(
                                    &s.project.get()["report"],
                                    &s.band.get(),
                                )
                        }
                        _ => false,
                    }
            }
            draggable=tool.is_some()
            on:dragstart=move |event| {
                if let (Some(tool), Some(data)) = (tool, event.data_transfer()) {
                    let _ = data.set_data("text/plain", &format!("reportstudio-tool:{tool}"));
                }
            }

            class:primary=primary
            class:active=move || active.is_some_and(|value| value.get())
            class:icon-only=compact
            title=move || {
                s.t(
                    if label == "Formula" {
                        "Add formula"
                    } else if label == "Toggle theme" {
                        if s.dark.get() { "Switch to light mode" } else { "Switch to dark mode" }
                    } else {
                        label
                    },
                )
            }
            aria-pressed=move || if label == "Toggle theme" { Some(s.dark.get()) } else { None }
            on:click=move |_| on_press.run(())
        >
            {move || {
                if label == "Toggle theme" {
                    view! {
                        <crate::shared::icons::Icon name=if s.dark.get() {
                            "sun"
                        } else {
                            "moon"
                        } />
                    }
                        .into_any()
                } else if label == "Formula" || label == "Add formula" {
                    view! {
                        <span class="formula-icon" aria-hidden="true">
                            "ƒx"
                        </span>
                    }
                        .into_any()
                } else if label == "Bold" {
                    view! { <strong aria-hidden="true">"B"</strong> }.into_any()
                } else if label == "Italic" {
                    view! { <em aria-hidden="true">"I"</em> }.into_any()
                } else if !resolved_icon.is_empty() {
                    view! { <crate::shared::icons::Icon name=resolved_icon /> }.into_any()
                } else {
                    ().into_any()
                }
            }}
            <span class="button-label">
                {move || s.t(if label == "Formula" { "Add formula" } else { label })}
            </span>
        </button>
    }
    .into_any()
}
