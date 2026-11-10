use crate::{domain::*, shared::icons::Icon, state::studio};
use leptos::prelude::*;
use serde_json::Value;
use std::collections::HashSet;

/// List the actual report sections, preserving subsection nesting and table groups.
#[component]
pub fn ElementTree() -> impl IntoView {
    let s = studio();
    view! {
        <section class="element-tree" aria-label=move || s.t("Report elements")>
            <h2>{move || s.t("Report elements")}</h2>
            <p class="element-tree-help">{move || s.t("Select an element to edit its properties. Use Shift or Ctrl to select more than one.")}</p>
            {move || {
                let all = bands(&s.project.get()["report"]);
                let child_ids: HashSet<String> = all.iter().flat_map(|section|
                    array(&section["sections"]).iter().map(|child| text(child, "id")).collect::<Vec<_>>()
                ).collect();
                all.into_iter().filter(|section| !child_ids.contains(&text(section, "id")))
                    .map(|section| view! { <SectionNode section /> }).collect_view()
            }}
        </section>
    }
}

#[component]
fn SectionNode(section: Value) -> impl IntoView {
    let s = studio();
    let section_id = text(&section, "id");
    let section_active = section_id.clone();
    let section_select = section_id.clone();
    let mut groups = HashSet::new();
    let elements = array(&section["elements"]).into_iter().filter(|element| {
        let group = text(element, "groupId");
        group.is_empty() || groups.insert(group)
    }).collect::<Vec<_>>();
    let children = array(&section["sections"]);
    view! {
        <details class="element-tree-section" open>
            <summary>
                <span class="field-chevron">"›"</span>
                <span>{s.t(&text(&section, "name"))}</span>
                <span class="element-tree-count">{elements.len()}</span>
            </summary>
            <button type="button" class="element-tree-select-section"
                class:active=move || s.band.get() == section_active && s.selected.get().is_empty()
                on:click=move |_| { s.band.set(section_select.clone()); s.selected.set(vec![]); }>
                {move || s.t("Select section")}
            </button>
            {elements.into_iter().map(|element| {
                let id = text(&element, "id");
                let group = text(&element, "groupId");
                let selected_ids = if group.is_empty() { vec![id.clone()] } else {
                    array(&section["elements"]).iter()
                        .filter(|candidate| text(candidate, "groupId") == group)
                        .map(|candidate| text(candidate, "id")).collect::<Vec<_>>()
                };
                let pressed_ids = selected_ids.clone();
                let band = section_id.clone();
                let kind = text(&element, "type");
                let icon = if !group.is_empty() { "table" } else { match kind.as_str() {
                    "text" => "text", "image" => "image", "line" => "line", "chart" => "chart", _ => "shape",
                }};
                let fallback = if !group.is_empty() { "Table" } else { match kind.as_str() {
                    "text" => "Text", "image" => "Image", "line" => "Line", "chart" => "Chart", _ => "Shape",
                }};
                let content = text(&element, "text");
                let label = if group.is_empty() && kind == "text" && !content.trim().is_empty() {
                    content.lines().next().unwrap_or("").chars().take(65).collect::<String>()
                } else { s.t(fallback) };
                let hidden = element["visible"] == false;
                let locked = element["locked"] == true;
                view! {
                    <button type="button" class="element-tree-item"
                        class:active=move || selected_ids.iter().any(|id| s.selected.get().contains(id))
                        aria-pressed=move || pressed_ids.iter().any(|id| s.selected.get().contains(id))
                        on:click=move |event| {
                            s.band.set(band.clone());
                            if event.shift_key() || event.ctrl_key() || event.meta_key() {
                                s.selected.update(|selection| {
                                    if selection.contains(&id) { selection.retain(|entry| entry != &id); }
                                    else { selection.push(id.clone()); }
                                });
                            } else { s.selected.set(vec![id.clone()]); }
                        }>
                        <Icon name=icon size=14 /><span class="element-tree-label" title=label.clone()>{label.clone()}</span>
                        {hidden.then(|| view! { <span class="element-tree-status" title=s.t("Hidden") aria-label=s.t("Hidden")>"◌"</span> })}
                        {locked.then(|| view! { <span class="element-tree-status" title=s.t("Locked") aria-label=s.t("Locked")>"🔒"</span> })}
                    </button>
                }
            }).collect_view()}
            <div class="element-tree-children">
                {children.into_iter().map(|section| view! { <SectionNode section /> }).collect_view()}
            </div>
        </details>
    }.into_any()
}
