mod field_button;
use crate::{
    domain::*,
    shared::{controls::base_button::BaseButton, icons::Icon},
    state::studio,
};
use field_button::FieldButton;
use leptos::prelude::*;
use serde_json::{json, Value};

/// The same token contract is used by clicks, drag-and-drop and saved report expressions.
fn field_groups() -> Vec<(String, String, &'static str, Vec<Value>)> {
    let s = studio();
    let mut groups = array(&s.project.get()["datasets"]).into_iter().map(|dataset| {
        let id = text(&dataset, "id");
        let name = s.t(&text(&dataset, "name"));
        let tokens = array(&dataset["schema"]["fields"]).into_iter().map(|field| {
            let field_name = text(&field, "name");
            json!({"label":format!("{name} · {field_name}"),"text":format!("[{field_name}]"),"kind":field["type"],"dataset":id})
        }).collect();
        (id, name, "data", tokens)
    }).collect::<Vec<_>>();
    let mut formulas = array(&s.project.get()["report"]["formulas"])
        .into_iter()
        .map(|formula| {
            let name = text(&formula, "name");
            json!({"label":name,"text":format!("[{name}]"),"kind":"formula"})
        })
        .collect::<Vec<_>>();
    for (name, expression) in [
        ("Subtotal", "[=quantity * unitPrice]"),
        ("Total", "[SUM(quantity * unitPrice)]"),
    ] {
        formulas.push(json!({"label":s.t(name),"text":expression,"kind":"formula"}));
    }
    groups.push(("formulas".into(), s.t("Formulas"), "text", formulas));
    let special = [
        ("Print date", "[=FORMAT(DATE(), 'dd/mm/yyyy')]"),
        ("Page number", "[PAGE_NUMBER]"),
        ("Page count", "[PAGE_COUNT]"),
        ("Row number", "[ROW_NUMBER]"),
        ("Row count", "[ROW_COUNT]"),
    ]
    .into_iter()
    .map(|(name, expression)| json!({"label":s.t(name),"text":expression,"kind":"special"}))
    .collect();
    groups.push(("special".into(), s.t("Special fields"), "settings", special));
    groups
}

#[component]
pub fn FieldsSidebar() -> impl IntoView {
    let s = studio();
    let search = RwSignal::new(String::new());
    view! {
        <aside class="fields-sidebar palette shrink-0 border-r">
            <section class="field-deck" aria-label=move || s.t("Available fields")>
                <div class="field-deck-heading">
                    <h2>
                        <Icon name="data" size=15 />
                        {move || s.t("Available fields")}
                    </h2>
                    <input
                        aria-label=move || s.t("Search fields")
                        placeholder=move || s.t("Search fields…")
                        on:input=move |event| search.set(event_target_value(&event))
                    />
                </div>
                <div class="field-groups">
                    <div class="source-tree-label">
                        <Icon name="data" size=15 />
                        <span>{move || s.t("Report data")}</span>
                    </div>
                    {move || {
                        let query = search.get().trim().to_lowercase();
                        let groups = field_groups()
                            .into_iter()
                            .filter_map(|(id, label, icon, tokens)| {
                                let tokens = tokens
                                    .into_iter()
                                    .filter(|token| {
                                        text(token, "label").to_lowercase().contains(&query)
                                    })
                                    .collect::<Vec<_>>();
                                (!tokens.is_empty()).then_some((id, label, icon, tokens))
                            })
                            .collect::<Vec<_>>();
                        if groups.is_empty() {
                            return view! { <p class="helper">{s.t("No matching fields.")}</p> }
                                .into_any();
                        }
                        groups
                            .into_iter()
                            .map(|(_, label, icon, tokens)| {
                                view! {
                                    <details class="field-group" open=!query.is_empty()>
                                        <summary>
                                            <span class="field-chevron">"›"</span>
                                            <Icon name=icon size=13 />
                                            <span>{label}</span>
                                        </summary>
                                        <div class="field-chips">
                                            {tokens
                                                .into_iter()
                                                .map(|token| view! { <FieldButton token /> })
                                                .collect_view()}
                                        </div>
                                    </details>
                                }
                            })
                            .collect_view()
                            .into_any()
                    }}
                </div>
            </section>
            <div class="palette-bottom">
                <span class="library-dot" />
                {move || s.t("Mini Reports engine")}
                <span>"1.0"</span>
                <BaseButton
                    label="Restore example"
                    class="text-button"
                    on_press=move |_| s.command("restore-example", json!({}))
                />
            </div>
        </aside>
    }
    .into_any()
}
