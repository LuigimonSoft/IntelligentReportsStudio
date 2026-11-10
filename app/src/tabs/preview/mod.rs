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
            let revision = s.preview_render_revision.get_untracked().wrapping_add(1);
            s.preview_render_revision.set(revision);
            s.preview_loading.set(true);
            s.preview_error.set(String::new());
            leptos::task::spawn_local(async move {
                let result = crate::platform::call(
                    json!({"action":"render-preview","args":{"layout":layout,"zoom":zoom}}),
                ).await;
                if s.preview_render_revision.get_untracked() == revision {
                    s.preview_loading.set(false);
                    if let Err(error) = result {
                        let message = s.describe_error(&error);
                        s.preview_error.set(message.clone());
                        s.message.set(message);
                    }
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
            <div class="preview-workspace" data-layout={ let layout = crate::platform::layout_styles::LayoutStyle::new(); move || layout.apply(format!("--panel-left:{}px;--panel-right:{}px",s.preview_left_width.get(),s.preview_right_width.get())) }>
                <left_sidebar::PagesSidebar />
                <crate::shared::controls::panel_splitter::PanelSplitter width=s.preview_left_width label="Resize pages panel" min=140.0 max=360.0 default_width=190.0 />
                <div class="preview-scroll">
                    <div id="pdf-pages" hidden=move || !s.preview_error.get().is_empty()>
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
                    <Show when=move || s.preview_loading.get()>
                        <div class="preview-state preview-loading" role="status" aria-live="polite">
                            <span class="preview-spinner" aria-hidden="true"></span>
                            <span>{move || s.t("Generating preview...")}</span>
                        </div>
                    </Show>
                    <Show when=move || !s.preview_loading.get() && !s.preview_error.get().is_empty()>
                        <div class="preview-state preview-error" role="alert">
                            <strong>{move || s.t("Unable to generate the preview")}</strong>
                            <p>{move || s.preview_error.get()}</p>
                            <crate::shared::controls::Button label="Retry preview" primary=true
                                on_press=move |_| s.command("preview", serde_json::Value::Null) />
                        </div>
                    </Show>
                    <Show when=move || s.preview.get().is_null() && !s.preview_loading.get() && s.preview_error.get().is_empty()>
                        <div class="preview-state" role="status">{move || s.t("Refresh the preview to display the report.")}</div>
                    </Show>
                </div>
                <crate::shared::controls::panel_splitter::PanelSplitter width=s.preview_right_width label="Resize preview options panel" right=true />
                <right_sidebar::PreviewSidebar />
            </div>
        </div>
    }.into_any()
}
