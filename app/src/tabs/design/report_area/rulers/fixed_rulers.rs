use super::{HorizontalRuler, VerticalRuler};
use crate::{
    domain::{design_height, DESIGN_PIXELS_PER_INCH},
    state::studio,
};
use leptos::prelude::*;

#[component]
pub fn FixedRulers(
    paper: NodeRef<leptos::html::Div>,
    canvas: NodeRef<leptos::html::Div>,
    frame: NodeRef<leptos::html::Div>,
    scroll_position: RwSignal<(i32, i32)>,
) -> impl IntoView {
    let s = studio();
    let geometry = RwSignal::new((130.0, 54.0, 130.0, 0.0, 0.0));
    let measure = move || {
        if let (Some(paper), Some(canvas), Some(frame)) = (paper.get(), canvas.get(), frame.get()) {
            let p = paper.get_bounding_client_rect();
            let f = frame.get_bounding_client_rect();
            geometry.set((
                p.left() - f.left(),
                p.top() - f.top(),
                p.left() - f.left() + canvas.scroll_left() as f64,
                (canvas.offset_width() - canvas.client_width()) as f64,
                (canvas.offset_height() - canvas.client_height()) as f64,
            ));
        }
    };
    #[cfg(feature = "csr")]
    {
        Effect::new(move |_| {
            let _ = (s.zoom.get(), s.project.get(), scroll_position.get());
            measure();
        });
        let resize = window_event_listener(leptos::ev::resize, move |_| measure());
        on_cleanup(move || resize.remove());
    }
    #[cfg(not(feature = "csr"))]
    let _ = (measure, scroll_position);
    view! {
        <div class="design-rulers-overlay" aria-hidden="true">
            <div class="ruler-header-mask"></div>
            <div
                class="horizontal-ruler-mask"
                data-layout={
                    let layout = crate::platform::layout_styles::LayoutStyle::new();
                    move || {
                        layout
                            .apply({
                                let (_, _, origin, bar, _) = geometry.get();
                                format!("left:{}px;right:{}px", origin.max(40.0), bar)
                            })
                    }
                }
            >
                <div
                    class="ruler-track"
                    data-layout={
                        let layout = crate::platform::layout_styles::LayoutStyle::new();
                        move || {
                            layout
                                .apply({
                                    let (x, _, origin, _, _) = geometry.get();
                                    format!("transform:translateX({}px)", x - origin.max(40.0))
                                })
                        }
                    }
                >
                    <HorizontalRuler />
                </div>
            </div>
            <div
                class="vertical-ruler-mask"
                data-layout={
                    let layout = crate::platform::layout_styles::LayoutStyle::new();
                    move || {
                        layout
                            .apply({
                                let (_, _, origin, _, bar) = geometry.get();
                                format!("left:{}px;bottom:{}px", (origin - 40.0).max(0.0), bar)
                            })
                    }
                }
            >
                <div
                    class="ruler-track"
                    data-layout={
                        let layout = crate::platform::layout_styles::LayoutStyle::new();
                        move || {
                            layout
                                .apply({
                                    let (_, y, _, _, _) = geometry.get();
                                    format!(
                                        "height:{}px;transform:translateY({}px)",
                                        design_height(&s.project.get()["report"])
                                            * DESIGN_PIXELS_PER_INCH * s.zoom.get(),
                                        y - 54.0,
                                    )
                                })
                        }
                    }
                >
                    <VerticalRuler />
                </div>
            </div>
        </div>
    }
}
