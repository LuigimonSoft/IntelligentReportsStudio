mod filters;
pub mod grid;
pub mod right_sidebar;
pub mod toolbar;
use crate::{shared::controls::*, state::studio};
use leptos::prelude::*;
#[component]
pub fn RecordsTab() -> impl IntoView {
    let s = studio();
    view! {
        <div class="records-workspace">
            <div class="records-main">
                <toolbar::RecordsToolbar />
                <filters::RecordFilters />
                <grid::RecordsGrid />
                <footer class="records-pagination">
                    <span>{move || format!("{} {}", s.record_count.get(), s.t("Records"))}</span>
                    <label>
                        {move || s.t("Rows per page")}
                        <select
                            aria-label="Rows per page"
                            on:change=move |event| {
                                s.page_size.set(event_target_value(&event).parse().unwrap_or(100));
                                s.record_page.set(1);
                            }
                        >
                            {[25, 50, 100, 200]
                                .into_iter()
                                .map(|size| {
                                    view! {
                                        <option selected=size == 100 value=size.to_string()>
                                            {size}
                                        </option>
                                    }
                                })
                                .collect_view()}
                        </select>
                    </label>
                    <Button
                        label="Previous page"
                        on_press=move |_| {
                            s.record_page.update(|page| *page = page.saturating_sub(1).max(1))
                        }
                    />
                    <span>
                        {move || {
                            format!(
                                "{} / {}",
                                s.record_page.get(),
                                s.record_count.get().div_ceil(s.page_size.get()).max(1),
                            )
                        }}
                    </span>
                    <Button
                        label="Next page"
                        on_press=move |_| {
                            let maximum = s
                                .record_count
                                .get_untracked()
                                .div_ceil(s.page_size.get_untracked())
                                .max(1);
                            s.record_page.update(|page| *page = (*page + 1).min(maximum));
                        }
                    />

                </footer>
            </div>
            <right_sidebar::RecordsSidebar />
        </div>
    }
    .into_any()
}
