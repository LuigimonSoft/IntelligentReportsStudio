pub mod buttons;

use crate::{shared::controls::*, state::studio};
use leptos::prelude::*;
use serde_json::json;
#[component]
pub fn StudioHeader() -> impl IntoView {
    let s = studio();
    view! {
        <header class="studio-header">
            <div class="brand">
                <img class="brand-logo" src="/header-logo.png" alt="" aria-hidden="true" />
                <div>
                    <strong>"Report Studio"</strong>
                    <small>{move || s.t("Report designer")}</small>
                </div>
            </div>
            <div class="document-title">
                <input
                    aria-label="Report title"
                    prop:value=move || {
                        s.project.get()["report"]["title"].as_str().unwrap_or("").to_owned()
                    }
                    on:change=move |e| {
                        s.mutate(|p| p["report"]["title"] = json!(event_target_value(&e)))
                    }
                />
                <small>
                    {move || s.t(if s.dirty.get() { "Unsaved changes" } else { "Saved" })}
                </small>
            </div>
            <div class="header-actions">
                <label class="language-picker">
                    <crate::shared::icons::Icon name="language" size=16 />
                    <select
                        class="language-select"
                        aria-label="Language"
                        prop:value=move || s.language.get()
                        on:change=move |e| s.language.set(event_target_value(&e))
                    >
                        <option value="en">{move || format!("🇬🇧 {}", s.t("English"))}</option>
                        <option value="es">{move || format!("🇪🇸 {}", s.t("Spanish"))}</option>
                        <option value="fr">{move || format!("🇫🇷 {}", s.t("French"))}</option>
                    </select>
                </label>
                <Button label="Toggle theme" on_press=move |_| s.dark.update(|v| *v = !*v) />
                <buttons::SaveButton />
                <ActionButton label="Save as" action="save-as" />
                <buttons::NewButton />
                <buttons::OpenButton />
                <div class="studio-export-group">
                    <buttons::ExportPdfButton />
                    <details class="studio-export-menu">
                        <summary aria-label=move || s.t("Export options")>
                            <crate::shared::icons::Icon name="arrow" size=14 />
                        </summary>
                        <div>
                            <Button
                                label="Download PDF"
                                on_press=move |_| s.command("export-pdf", serde_json::Value::Null)
                            />
                        </div>
                    </details>
                </div>
            </div>
        </header>
    }
    .into_any()
}
