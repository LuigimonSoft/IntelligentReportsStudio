use crate::domain::*;
use crate::{shared::controls::*, state::studio};
mod parameter_field;
use leptos::prelude::*;
use serde_json::Value;
#[component]
pub fn PreviewSidebar() -> impl IntoView {
    let s = studio();
    view! {
        <aside class="preview-sidebar preview-options-panel">
            <details open>
                <summary>{move || s.t("Report parameters")}</summary>
                <For each=move || { array(&s.project.get()["parameters"]).into_iter().map(|p| text(&p,"id")).collect::<Vec<_>>() } key=|id| id.clone()
                    children=move |id| view! { <parameter_field::ParameterField id /> } />
                <Show when=move || array(&s.project.get()["parameters"]).is_empty()>
                    <p class="preview-muted">{move || s.t("This template has no parameters.")}</p>
                </Show>
            <Button
                label="Refresh preview"
                primary=true
                on_press=move |_| s.command("preview", Value::Null)
            />
            </details>
            <details open>
                <summary>{move || s.t("View options")}</summary>
            <label class="preview-option-check">
                <input
                    type="checkbox"
                    prop:checked=move || s.preview_header.get()
                    on:change=move |e| {
                        s.preview_header.set(event_target_checked(&e));
                        s.command("preview", Value::Null);
                    }
                />
                {move || s.t("Show report header")}
            </label>
            <label class="preview-option-check">
                <input
                    type="checkbox"
                    prop:checked=move || s.preview_footer.get()
                    on:change=move |e| {
                        s.preview_footer.set(event_target_checked(&e));
                        s.command("preview", Value::Null);
                    }
                />
                {move || s.t("Show report footer")}
            </label>
                <label class="preview-option-check">
                    <input type="checkbox" prop:checked=move || s.preview_fit_width.get()
                        on:change=move |event| {
                            if event_target_checked(&event) { s.fit_preview(); } else { s.preview_fit_width.set(false); }
                        } />
                    {move || s.t("Fit to width")}
                </label>
            </details>
            <section class="preview-panel-information">
            <h2>{move || s.t("Information")}</h2>
            <dl>
                <dt>{move || s.t("Pages:")}</dt>
                <dd>{move || array(&s.preview.get()["pages"]).len()}</dd>
                <dt>{move || s.t("Size:")}</dt>
                <dd>
                    {move || {
                        let p = s.project.get();
                        format!(
                            "{:.0} × {:.0} mm",
                            number(&p["report"]["page"], "width") * 25.4,
                            number(&p["report"]["page"], "height") * 25.4,
                        )
                    }}
                </dd>
                <dt>{move || s.t("Orientation:")}</dt>
                <dd>
                    {move || {
                        let p = s.project.get();
                        s.t(
                            if number(&p["report"]["page"], "width")
                                > number(&p["report"]["page"], "height")
                            {
                                "Landscape"
                            } else {
                                "Portrait"
                            },
                        )
                    }}
                </dd>
                <dt>{move || s.t("Records:")}</dt>
                <dd>{move || number(&s.preview.get(), "recordCount") as usize}</dd>
            </dl>
            </section>
        </aside>
    }
}
