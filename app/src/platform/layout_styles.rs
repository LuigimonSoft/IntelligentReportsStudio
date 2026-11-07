//! Dynamic document values live in the external report-layout.css stylesheet.
//! Each mounted view owns one CSS rule, updated in place and removed on cleanup.
use std::sync::atomic::{AtomicUsize, Ordering};
static NEXT_RULE: AtomicUsize = AtomicUsize::new(1);
#[derive(Clone, Copy)]
pub struct LayoutStyle(usize);
impl Default for LayoutStyle {
    fn default() -> Self {
        Self::new()
    }
}
impl LayoutStyle {
    pub fn new() -> Self {
        let id = NEXT_RULE.fetch_add(1, Ordering::Relaxed);
        #[cfg(feature = "csr")]
        leptos::prelude::on_cleanup(move || remove_rule(id as u32));
        Self(id)
    }
    pub fn apply(self, declarations: String) -> String {
        #[cfg(feature = "csr")]
        update_rule(self.0 as u32, &declarations);
        #[cfg(not(feature = "csr"))]
        let _ = declarations;
        format!("layout-{}", self.0)
    }
}
#[cfg(feature = "csr")]
use wasm_bindgen::prelude::*;
#[cfg(feature = "csr")]
#[wasm_bindgen(
    inline_js = "export { updateLayoutRule, removeLayoutRule, updatePrintPageSize } from '/layout-styles.js';"
)]
extern "C" {
    #[wasm_bindgen(js_name = updateLayoutRule)]
    fn update_rule(id: u32, declarations: &str);
    #[wasm_bindgen(js_name = removeLayoutRule)]
    fn remove_rule(id: u32);
    #[wasm_bindgen(js_name = updatePrintPageSize)]
    pub fn update_print_page_size(width: f64, height: f64);
}
