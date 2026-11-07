use wasm_bindgen::prelude::*;

#[wasm_bindgen(
    inline_js = "export function markReady() { globalThis.reportstudio = { setParameterValues(values) { dispatchEvent(new CustomEvent('reportstudio:parameters', {detail: values})); }, setTables(tables, name = 'API') { dispatchEvent(new CustomEvent('reportstudio:tables', {detail: {tables, name}})); } }; globalThis.reportstudioRenderMode = 'csr'; globalThis.reportstudioReady = true; globalThis.reportstudioHydrated = true; }"
)]
extern "C" {
    fn markReady();
}

pub fn mount() {
    _ = console_log::init_with_level(log::Level::Debug);
    console_error_panic_hook::set_once();
    leptos::mount::mount_to_body(app::App);
    markReady();
    acknowledge_native_ready();
}

#[wasm_bindgen(
    inline_js = "export function acknowledgeNativeReady() { if (new URLSearchParams(location.search).has('editor')) return; const invoke = globalThis.__TAURI__?.core?.invoke; if (invoke) invoke('frontend_ready').then(() => { globalThis.reportstudioNativeReady = true; }).catch(error => console.error('Native readiness acknowledgement failed', error)); }"
)]
extern "C" {
    #[wasm_bindgen(js_name = acknowledgeNativeReady)]
    fn acknowledge_native_ready();
}
