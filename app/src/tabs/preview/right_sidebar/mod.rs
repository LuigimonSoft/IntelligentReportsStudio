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
            <Show when=move || !array(&s.preview.get()["fieldDiagnostics"]).is_empty()>
                <details class="preview-field-warnings" open>
                    <summary>{move || s.t("Data warnings")}</summary>
                    <p>{move || s.t("The report was generated, but some fields may be empty.")}</p>
                    <ul>
                        {move || array(&s.preview.get()["fieldDiagnostics"]).into_iter().map(|warning| {
                            let kind = if warning["kind"] == "missing-values" { "Missing in some records" } else { "Field not found" };
                            view! { <li><strong>{text(&warning,"field")}</strong><br />{s.t(kind)}" · "{s.t(&text(&warning,"section"))}</li> }
                        }).collect_view()}
                    </ul>
                </details>
            </Show>
            <Show when=move || !array(&s.preview.get()["resourceDiagnostics"]).is_empty()>
                <details class="preview-field-warnings" open>
                    <summary>{move || s.t("Resource warnings")}</summary>
                    <p>{move || s.t("Review these resources to improve the exported report.")}</p>
                    <ul>
                        {move || array(&s.preview.get()["resourceDiagnostics"]).into_iter().map(|warning| {
                            let section = text(&warning,"section");
                            let band = text(&warning,"bandId");
                            let element = text(&warning,"elementId");
                            let resource = text(&warning,"resource");
                            let fallback = text(&warning,"fallback");
                            let image = warning["kind"] == "missing-image";
                            view! { <li>
                                <strong>{if image {s.t("Image has no file")} else {s.t("PDF font substitution")}}</strong><br />
                                {s.t(&section)}
                                {(!image).then(|| view! { <span>" · "{resource}" → "{fallback}</span> })}
                                <div><Button label="Review element" on_press=move |_| {
                                    s.band.set(band.clone()); s.selected.set(vec![element.clone()]); s.tab.set("Design".into());
                                    let section_id = band.clone();
                                    request_animation_frame(move || {
                                        if let Some(section) = document().get_element_by_id(&format!("report-section-{section_id}")) {
                                            section.scroll_into_view_with_bool(false);
                                        }
                                    });
                                } /></div>
                            </li> }
                        }).collect_view()}
                    </ul>
                </details>
            </Show>
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
