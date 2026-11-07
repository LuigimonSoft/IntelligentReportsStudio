use crate::{domain::*, shared::controls::*, shared::icons::Icon, state::studio};
use leptos::prelude::*;
#[component]
pub fn RecordsToolbar() -> impl IntoView {
    let s = studio();
    let columns_menu = NodeRef::<leptos::html::Details>::new();
    let export_menu = NodeRef::<leptos::html::Details>::new();
    let columns_position = RwSignal::new((8.0, 8.0));
    let export_position = RwSignal::new((8.0, 8.0));
    let columns_layout = crate::platform::layout_styles::LayoutStyle::new();
    let export_layout = crate::platform::layout_styles::LayoutStyle::new();
    #[cfg(feature = "csr")]
    {
        use wasm_bindgen::JsCast;
        let outside = window_event_listener(leptos::ev::click, move |event| {
            let target = event
                .target()
                .and_then(|target| target.dyn_into::<web_sys::Node>().ok());
            for menu in [columns_menu, export_menu] {
                if let Some(menu) = menu.get_untracked() {
                    if !menu.contains(target.as_ref()) {
                        let _ = menu.remove_attribute("open");
                    }
                }
            }
        });
        on_cleanup(move || outside.remove());
    }
    view! {
        <div class="records-toolbar" role="toolbar" aria-label="Record tools">
            <Button label="Run query" primary=true on_press=move |_| s.record_refresh.update(|v| *v += 1) />
            <Button
                label="Edit query"
                on_press=move |_| {
                    s.show_json(
                        "Query",
                        serde_json::json!(
                            {"table":s.table.get_untracked(),"limit":s.limit.get_untracked()}
                        ),
                    );
                }
            />
            <Button
                label="Filters"
                active=Signal::derive(move || s.filters_open.get())
                on_press=move |_| s.filters_open.update(|v| *v = !*v)
            />
            <label class="records-limit">
                {move || s.t("Limit")}
                <select
                    aria-label="Record limit"
                    prop:value=move || s.limit.get().to_string()
                    on:change=move |e| s.limit.set(event_target_value(&e).parse().unwrap_or(200))
                >
                    {[50, 100, 200, 500, 1000, 5000, 10000]
                        .into_iter()
                        .map(|n| view! { <option value=n.to_string()>{n}</option> })
                        .collect_view()}
                </select><span>{move || s.t("records")}</span>
            </label>
            <span class="records-toolbar-spacer" />
            <label class="records-search">
                <Icon name="search" size=16 />
                <input
                    aria-label="Search results"
                    placeholder=move || s.t("Search results…")
                    prop:value=move || s.search.get()
                    on:input=move |e| s.search.set(event_target_value(&e).to_lowercase())
                />
            </label>
            <details class="records-menu" node_ref=columns_menu
                on:keydown=move |event| { if event.key() == "Escape" { if let Some(menu) = columns_menu.get() { let _ = menu.remove_attribute("open"); } } }
            >
                <summary role="button" aria-label=move || s.t("Columns") on:click=move |_| position_menu(columns_menu, export_menu, columns_position)>
                    <Icon name="columns" size=16 />
                    {move || s.t("Columns")}
                    <Icon name="arrow" size=11 />
                </summary>
                <div data-layout=move || { let (left,top) = columns_position.get(); columns_layout.apply(format!("left:{left}px;top:{top}px")) }>
                    <strong>{move || s.t("Visible columns")}</strong>
                    {move || {
                        s.record_columns.get()
                            .into_iter()
                            .map(|f| {
                                let id = text(&f, "key");
                                let label = text(&f, "label");
                                let checked = id.clone();
                                let change = id.clone();
                                view! {
                                    <label>
                                        <input
                                            type="checkbox"
                                            prop:checked=move || {
                                                !s.hidden_columns.get().contains(&checked)
                                            }
                                            on:change=move |e| {
                                                let value = event_target_checked(&e);
                                                s.hidden_columns
                                                    .update(|hidden| {
                                                        hidden.retain(|v| v != &change);
                                                        if !value {
                                                            hidden.push(change.clone())
                                                        }
                                                    })
                                            }
                                        />
                                        {label}
                                    </label>
                                }
                            })
                            .collect_view()
                    }}
                    <Button label="Show all" on_press=move |_| s.hidden_columns.set(vec![]) />
                </div>
            </details>
            <details class="records-menu records-export-menu" node_ref=export_menu
                on:keydown=move |event| { if event.key() == "Escape" { if let Some(menu) = export_menu.get() { let _ = menu.remove_attribute("open"); } } }
            >
                <summary role="button" aria-label=move || s.t("Export data") on:click=move |_| position_menu(export_menu, columns_menu, export_position)>
                    <Icon name="download" size=16 />
                    {move || s.t("Export data")}
                    <Icon name="arrow" size=11 />
                </summary>
                <div data-layout=move || { let (left,top) = export_position.get(); export_layout.apply(format!("left:{left}px;top:{top}px")) }>
                    <strong>{move || s.t("Export data")}</strong>
                    <p class="records-export-hint">{move || s.t("Exports filtered records up to the limit and visible columns.")}</p>
                    <Button
                        label="Download CSV"
                        disabled=Signal::derive(move || {
                            s.record_columns.get().iter().all(|field| s.hidden_columns.get().contains(&text(field, "key")))
                        })
                        on_press=move |_| {
                            s.command("export-data", serde_json::json!({"format":"csv"}));
                            if let Some(menu) = export_menu.get() { let _ = menu.remove_attribute("open"); }
                        }
                    />
                    <Button
                        label="Download JSON"
                        disabled=Signal::derive(move || {
                            s.record_columns.get().iter().all(|field| s.hidden_columns.get().contains(&text(field, "key")))
                        })
                        on_press=move |_| {
                            s.command("export-data", serde_json::json!({"format":"json"}));
                            if let Some(menu) = export_menu.get() { let _ = menu.remove_attribute("open"); }
                        }
                    />
                </div>
            </details>
        </div>
    }
    .into_any()
}

fn position_menu(
    current: NodeRef<leptos::html::Details>,
    other: NodeRef<leptos::html::Details>,
    position: RwSignal<(f64, f64)>,
) {
    let Some(menu) = current.get() else {
        return;
    };
    if let Some(other) = other.get() {
        let _ = other.remove_attribute("open");
    }
    if let Some(trigger) = menu.first_element_child() {
        let rect = trigger.get_bounding_client_rect();
        let width = window()
            .inner_width()
            .ok()
            .and_then(|v| v.as_f64())
            .unwrap_or(1024.0);
        let height = window()
            .inner_height()
            .ok()
            .and_then(|v| v.as_f64())
            .unwrap_or(768.0);
        position.set((
            (rect.right() - 240.0).clamp(8.0, (width - 248.0).max(8.0)),
            (rect.bottom() + 6.0).min((height - 80.0).max(8.0)),
        ));
    }
}
