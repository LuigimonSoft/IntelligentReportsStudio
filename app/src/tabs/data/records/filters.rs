use crate::{domain::*, shared::controls::*, state::studio};
use leptos::prelude::*;
use serde_json::json;

/// Columns within one group match with OR; groups combine with the selected AND/OR rule.
#[component]
pub fn RecordFilters() -> impl IntoView {
    let s = studio();
    view! {
        <details class="record-filter-panel" open=move || s.filters_open.get()>
            <summary on:click=move |e| {
                e.prevent_default();
                s.filters_open.update(|v| *v = !*v);
            }>{move || s.t("Filters")}</summary>
            <div class="button-row">
                <Button
                    label="Add filter group"
                    on_press=move |_| {
                        s.filter_groups
                            .update(|groups| {
                                groups
                                    .push(
                                        json!(
                                            {"id":format!("filter-{}",groups.len()+1),"columns":[],"operator":"contains","word":""}
                                        ),
                                    )
                            })
                    }
                />
                <select
                    aria-label="Combine filter groups"
                    on:change=move |event| s.filter_combination.set(event_target_value(&event))
                >
                    <option value="and">{move || s.t("Match all groups")}</option>
                    <option value="or">{move || s.t("Match any group")}</option>
                </select>
                <Button
                    label="Clear filters"
                    on_press=move |_| {
                        s.filter_groups.set(vec![]);
                        s.record_filters.set(Default::default());
                        s.search.set(String::new());
                    }
                />
            </div>
            {move || {
                s.filter_groups
                    .get()
                    .into_iter()
                    .enumerate()
                    .map(|(index, group)| {

                        view! {
                            <div class="record-filter-group">
                                <div class="filter-columns">
                                    {s.record_columns.get()
                                        .into_iter()
                                        .map(|field| {
                                            let name = text(&field, "key");
                                            let label = text(&field, "label");
                                            let key = name.clone();
                                            let checked = array(&group["columns"])
                                                .contains(&json!(name));
                                            view! {
                                                <label class="check">
                                                    <input
                                                        type="checkbox"
                                                        checked=checked
                                                        on:change=move |event| {
                                                            s.filter_groups
                                                                .update(|groups| {
                                                                    if let Some(group) = groups.get_mut(index) {
                                                                        let mut columns = array(&group["columns"]);
                                                                        columns.retain(|column| column != &json!(key));
                                                                        if event_target_checked(&event) {
                                                                            columns.push(json!(key));
                                                                        }
                                                                        group["columns"] = json!(columns);
                                                                    }
                                                                })
                                                        }
                                                    />
                                                    {label}
                                                </label>
                                            }
                                        })
                                        .collect_view()}
                                </div>
                                <select
                                    aria-label="Filter operator"
                                    on:change=move |event| {
                                        s.filter_groups
                                            .update(|groups| {
                                                if let Some(group) = groups.get_mut(index) {
                                                    group["operator"] = json!(event_target_value(&event));
                                                }
                                            })
                                    }
                                >
                                    {[
                                        ("contains", "Contains"),
                                        ("eq", "Equals"),
                                        ("gte", "Greater than or equal"),
                                        ("lte", "Less than or equal"),
                                        ("empty", "Is empty"),
                                        ("notEmpty", "Is not empty"),
                                    ]
                                        .into_iter()
                                        .map(|(value, label)| {
                                            view! {
                                                <option selected=group["operator"] == value value=value>
                                                    {s.t(label)}
                                                </option>
                                            }
                                        })
                                        .collect_view()}
                                </select>
                                <input
                                    aria-label="Filter value"
                                    value=text(&group, "word")
                                    on:change=move |event| {
                                        s.filter_groups
                                            .update(|groups| {
                                                if let Some(group) = groups.get_mut(index) {
                                                    group["word"] = json!(event_target_value(&event));
                                                }
                                            })
                                    }
                                />
                                <Button
                                    label="Remove filter group"
                                    on_press=move |_| {
                                        s.filter_groups
                                            .update(|groups| {
                                                groups.remove(index);
                                            })
                                    }
                                />
                            </div>
                        }
                    })
                    .collect_view()
            }}
        </details>
    }
}
