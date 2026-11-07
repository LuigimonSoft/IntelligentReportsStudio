//! Fixed-position menus follow their own trigger without being clipped by the dock.
use leptos::prelude::*;
#[component]
pub(super) fn SectionMenu(#[prop(default = false)] add: bool, children: Children) -> impl IntoView {
    let s = crate::state::studio();
    let menu = NodeRef::<leptos::html::Details>::new();
    let position = RwSignal::new((8.0, 96.0));
    #[cfg(feature = "csr")]
    {
        use wasm_bindgen::JsCast;
        let outside = window_event_listener(leptos::ev::click, move |event| {
            let target = event
                .target()
                .and_then(|target| target.dyn_into::<web_sys::Node>().ok());
            if let Some(menu) = menu.get_untracked() {
                if menu.has_attribute("open") && !menu.contains(target.as_ref()) {
                    let _ = menu.remove_attribute("open");
                }
            }
        });
        on_cleanup(move || outside.remove());
    }
    view! {
        <details class=if add {"add-section-menu"} else {"section-menu"} node_ref=menu
            on:keydown=move |event| {
                if event.key() == "Escape" {
                    if let Some(menu) = menu.get_untracked().filter(|menu| menu.has_attribute("open")) {
                        event.prevent_default();
                        let _ = menu.remove_attribute("open");
                    }
                }
            }
            on:toggle=move |_| {
                if let Some(menu)=menu.get().filter(|menu| menu.has_attribute("open")) {
                    if let Some(trigger)=menu.first_element_child() {
                        let rect=trigger.get_bounding_client_rect();
                        let width=window().inner_width().ok().and_then(|v|v.as_f64()).unwrap_or(1024.0);
                        let height=window().inner_height().ok().and_then(|v|v.as_f64()).unwrap_or(768.0);
                        position.set(((rect.right()-208.0).clamp(8.0,(width-216.0).max(8.0)),height-rect.top()+6.0));
                    }
                }
            }
        >
            <summary class=if add {"button"} else {""} aria-label=move || s.t(if add {"Add section"} else {"Section options"})>
                <crate::shared::icons::Icon name=if add {"plus"} else {"more"} size=16 />
                {add.then(||view! { <span>{move || s.t("Add section")}</span> })}
            </summary>
            <div class="section-popover"
                data-layout={let layout=crate::platform::layout_styles::LayoutStyle::new();move || {let (left,bottom)=position.get();layout.apply(format!("left:{left}px;bottom:{bottom}px;right:auto"))}}
                on:click=move |_| {if let Some(menu)=menu.get() {let _=menu.remove_attribute("open");}}
            >{children()}</div>
        </details>
    }
}
