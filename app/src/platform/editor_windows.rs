//! The web preview keeps inline dialogs; the desktop uses native child windows.
#[cfg(feature = "csr")]
use serde_json::Value;
#[cfg(feature = "csr")]
use wasm_bindgen::prelude::*;
#[cfg(feature = "csr")]
#[wasm_bindgen(
    inline_js = "export function nativeDesktop() { return !!globalThis.__TAURI_INTERNALS__; } export function editorWindow() { return !!globalThis.__TAURI_INTERNALS__ && new URLSearchParams(location.search).has('editor'); } export async function editorInvoke(command, args) { return JSON.stringify(await globalThis.__TAURI_INTERNALS__.invoke(command, JSON.parse(args))); }"
)]
extern "C" {
    #[wasm_bindgen(js_name = nativeDesktop)]
    pub fn native_desktop() -> bool;
    #[wasm_bindgen(js_name = editorWindow)]
    pub fn editor_window() -> bool;
    #[wasm_bindgen(catch, js_name = editorInvoke)]
    async fn invoke(command: &str, args: String) -> Result<JsValue, JsValue>;
}
#[cfg(not(feature = "csr"))]
pub fn native_desktop() -> bool {
    false
}
#[cfg(not(feature = "csr"))]
pub fn editor_window() -> bool {
    false
}
#[cfg(feature = "csr")]
pub async fn call(command: &str, args: Value) -> Result<Value, String> {
    let result = invoke(command, args.to_string())
        .await
        .map_err(|e| e.as_string().unwrap_or_else(|| format!("{e:?}")))?;
    serde_json::from_str(&result.as_string().unwrap_or_default()).map_err(|e| e.to_string())
}
