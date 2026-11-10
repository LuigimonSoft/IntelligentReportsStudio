use crate::{
    shared::{controls::Button, icons::Icon},
    state::studio,
};
use leptos::prelude::*;
use serde_json::json;

#[component]
pub(super) fn ArrangeMenu() -> impl IntoView {
    let s = studio();
    let menu = NodeRef::<leptos::html::Details>::new();
    let position = RwSignal::new((8.0, 8.0));
    #[cfg(feature = "csr")]
    {
        use wasm_bindgen::JsCast;
        let outside = window_event_listener(leptos::ev::click, move |event| {
            let target = event
                .target()
                .and_then(|target| target.dyn_into::<web_sys::Node>().ok());
            if let Some(element) = menu.get_untracked() {
                if element.has_attribute("open") && !element.contains(target.as_ref()) {
                    let _ = element.remove_attribute("open");
                }
            }
        });
        let escape = window_event_listener(leptos::ev::keydown, move |event| {
            if event.key() == "Escape" {
                if let Some(element) = menu
                    .get_untracked()
                    .filter(|element| element.has_attribute("open"))
                {
                    let _ = element.remove_attribute("open");
                }
            }
        });
        on_cleanup(move || {
            outside.remove();
            escape.remove();
        });
    }
    view! {
        <details class="arrange-menu" node_ref=menu on:toggle=move |_| {
            if let Some(element) = menu.get().filter(|element| element.has_attribute("open")) {
                if let Some(trigger) = element.first_element_child() {
                    let rect = trigger.get_bounding_client_rect();
                    let width = window().inner_width().ok().and_then(|v| v.as_f64()).unwrap_or(1024.0);
                    position.set((rect.left().clamp(8.0, (width - 244.0).max(8.0)), rect.bottom() + 5.0));
                }
            }
        }>
            <summary class="arrange-trigger" aria-label=move || s.t("Arrange elements")>
                <Icon name="arrange" size=16 />
                <span>{move || s.t("Arrange elements")}</span>
                <Icon name="chevron-down" size=13 />
            </summary>
            <div class="arrange-popover" data-layout={let layout=crate::platform::layout_styles::LayoutStyle::new(); move || {let (left,top)=position.get(); layout.apply(format!("left:{left}px;top:{top}px"))}}>
                <div class="arrange-heading">{move || s.t("Align")}</div>
                {[ ("Align left", "left", "align-left"), ("Align center", "center", "align-center"),
                   ("Align right", "right", "align-right"), ("Align top", "top", "align-top"),
                   ("Align middle", "middle", "align-middle"), ("Align bottom", "bottom", "align-bottom") ]
                    .into_iter().map(|(label, operation, icon)| view! {
                        <Button label icon disabled=Signal::derive(move || s.selected.get().len() < 2)
                            on_press=move |_| { s.command("align-elements", json!({"operation":operation})); if let Some(element)=menu.get_untracked() {let _=element.remove_attribute("open");} } />
                    }).collect_view()}
                <div class="arrange-heading arrange-divider">{move || s.t("Distribute")}</div>
                {[ ("Distribute horizontally", "distribute-horizontal", "distribute-horizontal"),
                   ("Distribute vertically", "distribute-vertical", "distribute-vertical") ]
                    .into_iter().map(|(label, operation, icon)| view! {
                        <Button label icon disabled=Signal::derive(move || s.selected.get().len() < 3)
                            on_press=move |_| { s.command("align-elements", json!({"operation":operation})); if let Some(element)=menu.get_untracked() {let _=element.remove_attribute("open");} } />
                    }).collect_view()}
            </div>
        </details>
    }
}
