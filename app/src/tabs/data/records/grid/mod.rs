use crate::{domain::*, state::studio, shared::controls::{Button, empty_state::EmptyState}};
use leptos::prelude::*;
use serde_json::json;
use serde_json::Value;
#[component]
pub fn RecordsGrid() -> impl IntoView {
    let s = studio();
    let rows = RwSignal::new(Vec::<Value>::new());
    let loading = RwSignal::new(true);
    let query_error = RwSignal::new(String::new());
    let filters = s.record_filters;
    #[cfg(feature = "csr")]
    let request_version = RwSignal::new(0usize);
    #[cfg(feature = "csr")]
    Effect::new(move |_| {
        let _refresh = s.record_refresh.get();
        loading.set(true);
        query_error.set(String::new());
        let version = request_version.get_untracked() + 1;
        request_version.set(version);
        let project = s.project.get();
        let table = s.table.get();
        let filter = filters.get();
        let search = s.search.get();
        let limit = s.limit.get();
        let groups = s.filter_groups.get();
        let combination = s.filter_combination.get();
        let sort = s.record_sort.get();
        let locale = s.language.get();
        leptos::task::spawn_local(async move {
            match crate::platform::call(json!({"action":"records-query","project":project,"args":{"table":table,"filters":filter,"search":search,"limit":limit,"groups":groups,"combination":combination,"sort":sort,"locale":locale}})).await {
                Ok(result) if request_version.get_untracked() == version => {
                    let values = array(&result["rows"]); s.record_columns.set(array(&result["columns"]));
                    s.record_count.set(values.len()); s.record_page.set(1); rows.set(values); loading.set(false);
                },
                Err(error) if request_version.get_untracked() == version => {
                    s.message.set(error.clone()); query_error.set(error); s.record_columns.set(vec![]);
                    s.record_count.set(0); rows.set(vec![]); loading.set(false);
                }, _ => {}
            }
        });
    });
    view! {
        <div class="records-grid-scroll">
            <table class="records-grid">
                <thead>
                    <tr>
                        <th>"#"</th>
                        {move || {
                            s.record_columns.get()
                                .into_iter()
                                .filter(|f| !s.hidden_columns.get().contains(&text(f, "key")))
                                .map(|f| {
                                    let name = text(&f, "key");
                                    let label = text(&f, "label");
                                    let key = name.clone();
                                    let filter_value = name.clone();
                                    let sort_key = name.clone();
                                    view! {
                                        <th>
                                            <button
                                                class="column-sort"
                                                on:click=move |_| {
                                                    let current = s.record_sort.get_untracked();
                                                    s.record_sort
                                                        .set(
                                                            json!(
                                                                {"column":sort_key,"direction":if current["column"]==sort_key&&current["direction"]=="asc"{"desc"}else{"asc"}}
                                                            ),
                                                        );
                                                }
                                            >
                                                {label}
                                            </button>
                                            <input
                                                aria-label="Column filter"
                                                placeholder="⌕"
                                                prop:value=move || filters.get().get(&filter_value).cloned().unwrap_or_default()
                                                on:input=move |e| {
                                                    filters
                                                        .update(|f| {
                                                            f.insert(key.clone(), event_target_value(&e));
                                                        })
                                                }
                                            />
                                        </th>
                                    }
                                })
                                .collect_view()
                        }}
                    </tr>
                </thead>
                <tbody>
                    {move || {
                        let fields = s.record_columns.get();
                        rows.get()
                            .into_iter()
                            .enumerate()
                            .skip(s.record_page.get().saturating_sub(1) * s.page_size.get())
                            .take(s.page_size.get())
                            .map(|(i, row)| {
                                let edit = row.clone();
                                let cells = fields
                                    .iter()
                                    .filter(|f| !s.hidden_columns.get().contains(&text(f, "key")))
                                    .map(|f| {
                                        let v = &row[text(f, "key")];
                                        view! {
                                            <td>
                                                {v
                                                    .as_str()
                                                    .map(str::to_owned)
                                                    .unwrap_or_else(|| {
                                                        if v.is_null() { String::new() } else { v.to_string() }
                                                    })}
                                            </td>
                                        }
                                    })
                                    .collect_view();
                                view! {
                                    <tr on:dblclick=move |_| {
                                        s.original_record.set(edit.clone());
                                        s.show_json("Record", edit.clone());
                                    }>
                                        <td>{i + 1}</td>
                                        {cells}
                                    </tr>
                                }
                            })
                            .collect_view()
                    }}
                </tbody>
            </table>
            <Show when=move || loading.get()>
                <p class="records-query-status" role="status">{move || s.t("Loading records...")}</p>
            </Show>
            <Show when=move || !loading.get() && !query_error.get().is_empty()>
                <div class="records-query-error" role="alert">
                    <strong>{move || s.t("Unable to load records")}</strong>
                    <p>{move || query_error.get()}</p>
                    <Button label="Run query" on_press=move |_| s.record_refresh.update(|v| *v += 1) />
                </div>
            </Show>
            <Show when=move || !loading.get() && query_error.get().is_empty() && rows.get().is_empty()>
                {move || {
                    let project = s.project.get();
                    let tables = array(&project["datasets"]);
                    if tables.is_empty() {
                        view! { <EmptyState title="No data tables yet" description="Create or import a table to view records." icon="table">
                            <Button label="Data model" on_press=move |_| s.data_tab.set("Data model".into()) />
                        </EmptyState> }.into_any()
                    } else if let Some(table) = tables.iter().find(|table| text(table,"id") == s.table.get()) {
                        if array(&table["data"]).is_empty() {
                            view! { <EmptyState title="This table has no records" description="Load JSON data or add records to use this table in your report." icon="table">
                                <Button label="Load JSON data" icon="upload" on_press=move |_| s.command("load-table-data", Value::Null) />
                            </EmptyState> }.into_any()
                        } else {
                            view! { <EmptyState title="No matching records" description="Check the filters, search text and table relationships." icon="search">
                                <Button label="Clear filters" on_press=move |_| { s.record_filters.set(Default::default()); s.filter_groups.set(vec![]); s.search.set(String::new()); } />
                            </EmptyState> }.into_any()
                        }
                    } else {
                        view! { <EmptyState title="Select a data table" description="Choose a table in the data sources panel to view its records." icon="table"><span></span></EmptyState> }.into_any()
                    }
                }}
            </Show>
        </div>
    }
}
