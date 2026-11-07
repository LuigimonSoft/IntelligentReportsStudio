pub mod left_sidebar;
pub mod right_sidebar;
pub mod toolbar;
use crate::{domain::*, state::studio};
use leptos::prelude::*;
#[cfg(feature = "csr")]
use serde_json::json;
#[component]
pub fn PreviewTab() -> impl IntoView {
    let s = studio();
    #[cfg(feature = "csr")]
    Effect::new(move |_| {
        let layout = s.preview.get();
        let zoom = s.preview_zoom.get();
        if !layout.is_null() {
            leptos::task::spawn_local(async move {
                if let Err(error) = crate::platform::call(
                    json!({"action":"render-preview","args":{"layout":layout,"zoom":zoom}}),
                )
                .await
                {
                    s.message.set(error);
                }
            });
        }
    });
    #[cfg(feature = "csr")]
    Effect::new(move |_| {
        let project = s.project.get();
        let page = &project["report"]["page"];
        crate::platform::layout_styles::update_print_page_size(
            number(page, "width"),
            number(page, "height"),
        );
    });
    #[cfg(feature = "csr")]
    Effect::new(move |_| s.fit_preview_page());
    #[cfg(feature = "csr")]
    {
        let resize = window_event_listener(leptos::ev::resize, move |_| {
            if s.preview_fit_width.get_untracked() {
                s.fit_preview();
            }
        });
        on_cleanup(move || resize.remove());
    }
    view! {
        <div class="preview-tab">
            <toolbar::PreviewToolbar />
            <div class="preview-workspace">
                <left_sidebar::PagesSidebar />
                <div class="preview-scroll">
                    <div id="pdf-pages">
                        {move || {
                            array(&s.preview.get()["pages"])
                                .into_iter()
                                .map(|page| {
                                    view! {
                                        <article class="preview-page">
                                            <canvas id=format!("pdf-page-{}", page["number"])></canvas>
                                        </article>
                                    }
                                })
                                .collect_view()
                        }}
                    </div>
                    <Show when=move || s.preview.get().is_null()>
                        <p>{move || s.t("Generating preview...")}</p>
                    </Show>
                </div>
                <right_sidebar::PreviewSidebar />
            </div>
        </div>
    }.into_any()
}
