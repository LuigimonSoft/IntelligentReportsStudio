pub(crate) mod charts;
mod elements;
mod fields;
mod sections;
mod tables;
use crate::{domain::*, shared::controls::Button, state::studio};
use fields::*;
use leptos::prelude::*;
use serde_json::{json, Value};
pub fn selected_band() -> Value {
    let s = studio();
    bands(&s.project.get()["report"])
        .into_iter()
        .find(|b| text(b, "id") == s.band.get())
        .unwrap_or_default()
}
#[component]
pub fn PropertiesSidebar() -> impl IntoView {
    let s = studio();
    view! {
        <aside
            class="properties-sidebar inspector"
            class:inspector-tab-styles=move || s.inspector_tab.get() == "Styles"
        >
            <div
                class="sidebar-tabs inspector-tabs"
                role="tablist"
                aria-label=move || s.t("Properties panel")
            >
                <Button
                    label="Properties"
                    active=Signal::derive(move || s.inspector_tab.get() == "Properties")
                    on_press=move |_| s.inspector_tab.set("Properties".into())
                />
                <Button
                    label="Styles"
                    active=Signal::derive(move || s.inspector_tab.get() == "Styles")
                    on_press=move |_| s.inspector_tab.set("Styles".into())
                />
            </div>
            {move || {
                let band = selected_band();
                let report = s.project.get()["report"].clone();
                let locked = read_only(&report, &text(&band, "id"));
                let mut unlocked = report.clone();
                if let Some(b) = band_mut(&mut unlocked, &text(&band, "id")) {
                    b["readOnly"] = json!(false);
                }
                let inherited = read_only(&unlocked, &text(&band, "id"));
                let selected_element = s.selected_element();
                let element_locked = selected_element.as_ref().is_some_and(|e| e["locked"] == true);
                let options = bands(&report)
                    .iter()
                    .map(|b| (text(b, "id"), s.t(&text(b, "name"))))
                    .collect();
                let _ = s.scope.get();
                view! {
                    <section class="inspector-section section-selector">
                        <h3>{s.t("Section")}</h3>
                        <SelectField
                            show_label=false
                            label="Section"
                            value=text(&band, "id")
                            options
                            on_change=move |id: String| {
                                s.band.set(id);
                                s.selected.set(vec![]);
                            }
                        />
                    </section>
                    <section class="inspector-section section-read-only">
                        <CheckField
                            label="Read-only section"
                            toggle=false
                            checked=band["readOnly"] == true
                            disabled=inherited
                            on_change=move |v: bool| s.patch_band("readOnly", json!(v))
                        />
                        {locked
                            .then(|| {
                                view! {
                                    <p class="helper">
                                        {s
                                            .t(
                                                "This section and its subsections are read-only. Unlock it to edit.",
                                            )}
                                    </p>
                                }
                            })}
                    </section>
                    {selected_element.map(|element| view! {
                        <section class="inspector-section element-protection">
                            <CheckField label="Lock element" checked=element_locked disabled=locked
                                on_change=move |v: bool| s.command("element-flags", json!({"locked":v})) />
                            <CheckField label="Element visible" checked=element["visible"] != false disabled=locked || element_locked
                                on_change=move |v: bool| s.command("element-flags", json!({"visible":v})) />
                        </section>
                    })}
                    <fieldset class="inspector-contents" disabled=locked || element_locked>
                        {if let Some(element) = s.selected_element() {
                            if element["table"].is_object() {
                                view! { <tables::TableProperties element /> }.into_any()
                            } else {
                                view! { <elements::ElementProperties element /> }.into_any()
                            }
                        } else {
                            view! { <sections::SectionProperties band /> }.into_any()
                        }}
                    </fieldset>
                }
                    .into_any()
            }}
        </aside>
    }.into_any()
}
