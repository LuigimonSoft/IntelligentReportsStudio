pub mod left_sidebar;
pub mod model;
pub mod records;
use crate::state::studio;
use leptos::prelude::*;
#[component]
pub fn DataTab() -> impl IntoView {
    let s = studio();
    view! {
        <div class="data-workspace">
            <left_sidebar::DataSourcesSidebar />
            <div class="data-main">
                <nav class="data-tabs">
                    {["Data model", "Records"]
                        .into_iter()
                        .map(|tab| {
                            view! {
                                <button
                                    class:active=move || s.data_tab.get() == tab
                                    on:click=move |_| {
                                        if tab == "Records" {
                                            if let Some(root) = s.project.get_untracked()["dataModel"]["rootDataset"].as_str() { s.table.set(root.to_owned()); }
                                        }
                                        s.data_tab.set(tab.into());
                                    }
                                >
                                    <crate::shared::icons::Icon name=if tab == "Records" {
                                        "table"
                                    } else {
                                        "model"
                                    } />
                                    {move || s.t(tab)}
                                </button>
                            }
                        })
                        .collect_view()}
                </nav>
                <Show
                    when=move || s.data_tab.get() == "Data model"
                    fallback=|| view! { <records::RecordsTab /> }
                >
                    <model::DataModelTab />
                </Show>
            </div>
        </div>
    }
    .into_any()
}
