#[cfg(feature = "csr")]
use crate::{
    domain::{array, bands, text},
    state::studio,
};
#[cfg(feature = "csr")]
use leptos::prelude::*;
#[cfg(feature = "csr")]
use serde_json::Value;

/// Text inputs keep the operating system's normal editing shortcuts.
#[cfg(feature = "csr")]
pub fn install_shortcuts() {
    use wasm_bindgen::JsCast;
    let s = studio();
    let listener = window_event_listener(leptos::ev::keydown, move |event| {
        if event.default_prevented() || event.is_composing() || !s.dialog.get_untracked().is_empty() {
            return;
        }
        if let Some(element) = event
            .target()
            .and_then(|t| t.dyn_into::<web_sys::Element>().ok())
        {
            if element
                .closest("input,textarea,select,[contenteditable]:not([contenteditable=false])")
                .ok()
                .flatten()
                .is_some()
            {
                return;
            }
        }
        let command = event.meta_key() || event.ctrl_key();
        let key = event.key().to_lowercase();
        if command {
            match key.as_str() {
                "a" if s.tab.get_untracked() == "Design" => {
                    event.prevent_default();
                    s.selected.set(
                        bands(&s.project.get_untracked()["report"])
                            .iter()
                            .flat_map(|b| array(&b["elements"]))
                            .map(|e| text(&e, "id"))
                            .collect(),
                    );
                }
                "c" | "x" | "v" if s.tab.get_untracked() == "Design" => {
                    event.prevent_default();
                    s.command(
                        match key.as_str() {
                            "c" => "copy",
                            "x" => "cut",
                            _ => "paste",
                        },
                        Value::Null,
                    );
                }
                "z" => {
                    event.prevent_default();
                    if event.shift_key() {
                        s.redo()
                    } else {
                        s.undo()
                    }
                }
                "y" => {
                    event.prevent_default();
                    s.redo();
                }
                "s" => {
                    event.prevent_default();
                    s.command("save", Value::Null);
                }
                _ => {}
            }
        } else if s.tab.get_untracked() == "Design" && (key == "delete" || key == "backspace") && !s.selected.get_untracked().is_empty()
        {
            event.prevent_default();
            s.command("delete", Value::Null);
        }
    });
    on_cleanup(move || listener.remove());
}
#[cfg(not(feature = "csr"))]
pub fn install_shortcuts() {}
