use crate::{domain::*, state::studio};
use leptos::prelude::*;
use serde_json::json;
use serde_json::Value;
#[component]
pub fn RecordsGrid() -> impl IntoView {
    let s = studio();
    let rows = RwSignal::new(Vec::<Value>::new());
    let filters = s.record_filters;
    #[cfg(feature = "csr")]
    let request_version = RwSignal::new(0usize);
    #[cfg(feature = "csr")]
    Effect::new(move |_| {
        let _refresh = s.record_refresh.get();
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
            match crate::platform::call(json!({"action":"records-query","project":project,"args":{"table":table,"filters":filter,"search":search,"limit":limit,"groups":groups,"combination":combination,"sort":sort,"locale":locale}})).await { Ok(result) if request_version.get_untracked() == version => { let values = array(&result["rows"]); s.record_columns.set(array(&result["columns"])); s.record_count.set(values.len()); s.record_page.set(1); rows.set(values); }, Err(error) if request_version.get_untracked() == version => { s.message.set(error.to_string()); s.record_columns.set(vec![]); s.record_count.set(0); rows.set(vec![]); }, _ => {} }
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
        </div>
    }
}
