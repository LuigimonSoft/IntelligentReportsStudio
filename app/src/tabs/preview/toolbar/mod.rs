use crate::{domain::*, shared::controls::*, state::studio};
use leptos::prelude::*;
use serde_json::{json, Value};
#[component]
pub fn PreviewToolbar() -> impl IntoView {
    let s = studio();
    let searching = RwSignal::new(false);
    let query = RwSignal::new(String::new());
    view! {
        <div class="preview-toolbar" role="toolbar" aria-label="Preview tools">
            <ActionButton label="Print" action="print" />
            <Button label="Print settings" icon="settings" on_press=move |_| s.show_json("Print settings", s.project.get_untracked()["report"]["page"].clone()) />
            <span class="preview-divider" />
            <select
                aria-label="Preview fit"
                on:change=move |e| match event_target_value(&e).as_str() {
                    "width" => s.fit_preview(),
                    "actual" => { s.preview_fit_width.set(false); s.preview_zoom.set(1.0); },
                    _ => s.fit_preview_page(),
                }
            >
                <option value="page">{move || s.t("Fit page")}</option>
                <option value="width">{move || s.t("Fit to width")}</option>
                <option value="actual">{move || s.t("Actual size")}</option>
            </select>
            <span class="preview-divider" />
            <Button label="Fit page" on_press=move |_| s.fit_preview_page() />
            <div class="preview-zoom">
                <input
                    aria-label="Preview zoom"
                    type="number"
                    min="20"
                    max="300"
                    prop:value=move || (s.preview_zoom.get() * 100.0).round()
                    on:change=move |e| {
                        if let Ok(v) = event_target_value(&e).parse::<f64>() {
                            s.preview_fit_width.set(false);
                            s.preview_zoom.set(v.clamp(20.0, 300.0) / 100.0)
                        }
                    }
                />
                <span>"%"</span>
                <Button
                    label="Zoom out"
                    icon="minus"
                    disabled=Signal::derive(move || s.preview_zoom.get() <= 0.2)
                    on_press=move |_| { s.preview_fit_width.set(false); s.preview_zoom.update(|v| *v = (*v - 0.05).max(0.2)); }
                />
                <Button
                    label="Zoom in"
                    icon="plus"
                    disabled=Signal::derive(move || s.preview_zoom.get() >= 3.0)
                    on_press=move |_| { s.preview_fit_width.set(false); s.preview_zoom.update(|v| *v = (*v + 0.05).min(3.0)); }
                />
            </div>
            <span class="preview-divider" />
            <label class="preview-page-control">
                <input
                    aria-label="Page number"
                    type="number"
                    min="1"
                    prop:value=move || s.preview_page.get()
                    on:change=move |e| {
                        if let Ok(n) = event_target_value(&e).parse() {
                            s.go_to_page(n)
                        }
                    }
                />
                <span>{move || format!("/ {}", array(&s.preview.get()["pages"]).len())}</span>
            </label>
            <Button
                label="Previous page"
                disabled=Signal::derive(move || s.preview_page.get() <= 1)
                on_press=move |_| s.go_to_page(s.preview_page.get_untracked().saturating_sub(1))
            />
            <Button
                label="Next page"
                disabled=Signal::derive(move || {
                    s.preview_page.get() >= array(&s.preview.get()["pages"]).len()
                })
                on_press=move |_| s.go_to_page(s.preview_page.get_untracked() + 1)
            />
            <span class="preview-divider" />
            <select
                aria-label=move || s.t("Page size")
                prop:value=move || crate::shared::dialogs::page_preset(&s.project.get()["report"]["page"]).to_string()
                on:change=move |e| {
                    let preset = event_target_value(&e);
                    if let Some((width, height)) = crate::shared::dialogs::paper_dimensions(&preset) {
                        let page = s.project.get_untracked()["report"]["page"].clone();
                        let landscape = number(&page, "width") > number(&page, "height");
                        s.mutate(|p| {
                            p["report"]["page"]["width"] = json!(if landscape { height } else { width });
                            p["report"]["page"]["height"] = json!(if landscape { width } else { height });
                        });
                        s.command("preview", Value::Null);
                        s.fit_preview_page();
                    }
                }
            >
                <option value="A4">"A4 (210 × 297 mm)"</option>
                <option value="Letter">{move || format!("{} (216 × 279 mm)", s.t("Letter"))}</option>
                <option value="Legal">{move || format!("{} (216 × 356 mm)", s.t("Legal"))}</option>
                <option value="Custom">{move || s.t("Custom")}</option>
            </select>
            <div class="preview-toolbar-end">
                <Button
                    label="Search document"
                    active=Signal::derive(move || searching.get())
                    on_press=move |_| searching.update(|v| *v = !*v)
                />
                <ActionButton label="Download PDF" action="export-pdf" />
                <ActionButton label="Fullscreen" action="fullscreen" />
            </div>
        </div>
        <Show when=move || searching.get()>
            <div class="preview-search-panel">
                <crate::shared::icons::Icon name="search" size=16 />
                <input
                    type="search"
                    aria-label="Find in document"
                    placeholder=move || s.t("Search document")
                    on:input=move |e| query.set(event_target_value(&e).to_lowercase())
                />
                {move || {
                    array(&s.preview.get()["pages"])
                        .into_iter()
                        .filter(|page| {
                            !query.get().is_empty()
                                && array(&page["elements"])
                                    .iter()
                                    .any(|el| {
                                        text(el, "text").to_lowercase().contains(&query.get())
                                    })
                        })
                        .map(|page| {
                            let n = page["number"].as_u64().unwrap_or(1) as usize;
                            view! {
                                <button
                                    type="button"
                                    class="button"
                                    on:click=move |_| s.go_to_page(n)
                                >
                                    {format!("{} {n}", s.t("Page"))}
                                </button>
                            }
                        })
                        .collect_view()
                }}
                <Button label="Close" on_press=move |_| searching.set(false) />
            </div>
        </Show>
    }
    .into_any()
}
