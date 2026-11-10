use crate::{domain::*, state::studio};
use leptos::prelude::*;
use serde_json::{json, Value};

/// Resize a selected object from its lower-right corner, including whole tables.
#[component]
pub(super) fn ResizeHandle(element: Value) -> impl IntoView {
    let s = studio();
    let start = RwSignal::new(None::<(i32, f64, f64, f64, f64)>);
    let id = text(&element, "id");
    let x = number(&element, "x");
    let y = number(&element, "y");
    view! {
        <Show when=move || s.selected.get().len() == 1 && s.selected.get().contains(&id)>
            <button type="button" class="object-resize-handle" aria-label=move || s.t("Resize element")
                data-layout={let layout=crate::platform::layout_styles::LayoutStyle::new(); move || {
                    let scale=DESIGN_PIXELS_PER_INCH*s.zoom.get();
                    layout.apply(format!("left:{}px;top:{}px",(s.selected_metric("x")-x+s.selected_metric("width"))*scale,(s.selected_metric("y")-y+s.selected_metric("height"))*scale))
                }}
                on:pointerdown=move |event| {
                    if event.button()!=0 {return;}
                    event.stop_propagation(); event.prevent_default();
                    #[cfg(feature="csr")]
                    {
                        use wasm_bindgen::JsCast;
                        if let Some(target)=event.current_target().and_then(|value|value.dyn_into::<web_sys::Element>().ok()) {
                            let _=target.set_pointer_capture(event.pointer_id());
                            start.set(Some((event.pointer_id(),event.client_x() as f64,event.client_y() as f64,s.selected_metric("width"),s.selected_metric("height"))));
                        }
                    }
                }
                on:pointerup=move |event| {
                    event.stop_propagation();
                    if let Some((pointer,x0,y0,width,height))=start.get_untracked() {
                        if pointer==event.pointer_id() {
                            let scale=DESIGN_PIXELS_PER_INCH*s.zoom.get_untracked();
                            let mut w=(width+(event.client_x() as f64-x0)/scale).max(0.1);
                            let mut h=(height+(event.client_y() as f64-y0)/scale).max(0.05);
                            if s.snap_grid.get_untracked() {
                                let step=s.spacing.get_untracked().max(0.001);
                                let origin_x=s.selected_metric("x"); let origin_y=s.selected_metric("y");
                                w=(((origin_x+w)/step).round()*step-origin_x).max(0.1);
                                h=(((origin_y+h)/step).round()*step-origin_y).max(0.05);
                            }
                            s.command("resize-element",json!({"width":w,"height":h}));
                        }
                    }
                    start.set(None);
                }
                on:pointercancel=move |_| start.set(None)
            />
        </Show>
    }
}
