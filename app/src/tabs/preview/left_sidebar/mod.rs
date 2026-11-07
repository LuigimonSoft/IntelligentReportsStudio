use crate::{domain::*, state::studio};
use leptos::prelude::*;
#[component]
pub fn PagesSidebar() -> impl IntoView {
    let s = studio();
    view! {
        <aside class="pages-sidebar">
            <h3>{move || s.t("Pages")}</h3>
            {move || {
                array(&s.preview.get()["pages"])
                    .into_iter()
                    .map(|page| {
                        let n = page["number"].as_u64().unwrap_or(1);
                        view! {
                            <a
                                class="page-thumbnail"
                                class:active=move || s.preview_page.get() == n as usize
                                href=format!("#pdf-page-{n}")
                                on:click=move |event| {
                                    event.prevent_default();
                                    s.go_to_page(n as usize);
                                }
                            >
                                <canvas id=format!("pdf-thumbnail-{n}")></canvas>
                                <span>{n}</span>
                            </a>
                        }
                    })
                    .collect_view()
            }}
        </aside>
    }
}
