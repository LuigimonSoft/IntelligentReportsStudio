//! A keyboard-accessible splitter for a sidebar adjacent to the workspace.
use crate::state::studio;
use leptos::prelude::*;

#[component]
pub fn PanelSplitter(
    width: RwSignal<f64>,
    label: &'static str,
    #[prop(optional)] right: bool,
    #[prop(default = 180.0)] min: f64,
    #[prop(default = 500.0)] max: f64,
    #[prop(default = 292.0)] default_width: f64,
) -> impl IntoView {
    let s = studio();
    let start = RwSignal::new(None::<(i32, f64, f64)>);
    let set_width = move |value: f64| {
        width.set(value.clamp(min, max));
        #[cfg(feature = "csr")]
        request_animation_frame(move || {
            if s.tab.get_untracked() == "Design" && s.zoom_auto.get_untracked() { s.fit_design(); }
            if s.tab.get_untracked() == "Preview" && s.preview_fit_width.get_untracked() { s.fit_preview(); }
        });
    };
    view! {
        <div class="panel-splitter" role="separator" tabindex="0" aria-orientation="vertical"
            aria-label=move || s.t(label) aria-valuemin=min aria-valuemax=max
            aria-valuenow=move || width.get().round()
            on:pointerdown=move |event| {
                if event.button() != 0 { return; }
                event.prevent_default();
                #[cfg(feature="csr")]
                {
                    use wasm_bindgen::JsCast;
                    if let Some(target) = event.current_target().and_then(|v| v.dyn_into::<web_sys::Element>().ok()) {
                        if target.set_pointer_capture(event.pointer_id()).is_ok() {
                            start.set(Some((event.pointer_id(), event.client_x() as f64, width.get_untracked())));
                        }
                    }
                }
            }
            on:pointermove=move |event| {
                if let Some((pointer, x, initial)) = start.get_untracked() {
                    if pointer == event.pointer_id() {
                        let delta = event.client_x() as f64 - x;
                        set_width(initial + if right { -delta } else { delta });
                    }
                }
            }
            on:pointerup=move |_| start.set(None)
            on:pointercancel=move |_| start.set(None)
            on:lostpointercapture=move |_| start.set(None)
            on:dblclick=move |_| set_width(default_width)
            on:keydown=move |event| {
                let delta = if event.shift_key() { 25.0 } else { 10.0 };
                let value = match event.key().as_str() {
                    "ArrowLeft" => Some(width.get_untracked() + if right { delta } else { -delta }),
                    "ArrowRight" => Some(width.get_untracked() + if right { -delta } else { delta }),
                    "Home" => Some(min), "End" => Some(max), _ => None,
                };
                if let Some(value) = value { event.prevent_default(); set_width(value); }
            }
        ><span aria-hidden="true"></span></div>
    }
}
