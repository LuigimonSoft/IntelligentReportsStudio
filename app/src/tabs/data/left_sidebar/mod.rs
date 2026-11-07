use crate::{domain::*, state::studio};
use leptos::prelude::*;
#[component]
pub fn DataSourcesSidebar() -> impl IntoView {
    let s = studio();
    let search = RwSignal::new(String::new());
    view! {
        <aside class="data-sources">
            <h3>{move || s.t("Data sources")}</h3>
            <p>
                "▤ "
                {move || {
                    s.project
                        .get()["dataSource"]["name"]
                        .as_str()
                        .unwrap_or("No data source")
                        .to_owned()
                }}
            </p>
            <input
                placeholder=move || s.t("Search tables...")
                on:input=move |e| search.set(event_target_value(&e).to_lowercase())
            />
            {move || {
                array(&s.project.get()["datasets"])
                    .into_iter()
                    .map(|table| {
                        let id = text(&table, "id");
                        let active = id.clone();
                        let expanded = id.clone();
                        let name = text(&table, "name");
                        let fields = array(&table["schema"]["fields"]);
                        view! {
                            <details
                                open=move || s.table.get() == expanded
                                hidden=!name.to_lowercase().contains(&search.get())
                            >
                                <summary
                                    class:active=move || s.table.get() == active
                                    on:click=move |_| s.table.set(id.clone())
                                >
                                    <crate::shared::icons::Icon name="table" />
                                    {name.clone()}
                                </summary>
                                {fields
                                    .into_iter()
                                    .map(|f| {
                                        view! {
                                            <div class="schema-field">
                                                <span>
                                                    {if f["type"] == "number" { "#" } else { "Aa" }}
                                                </span>
                                                {text(&f, "name")}
                                            </div>
                                        }
                                    })
                                    .collect_view()}
                            </details>
                        }
                    })
                    .collect_view()
            }}
        </aside>
    }
}
