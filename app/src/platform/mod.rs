pub mod editor_windows;
pub mod layout_styles;
#[cfg(feature = "csr")]
pub mod preferences;
#[cfg(feature = "csr")]
use wasm_bindgen::prelude::*;
#[cfg(feature = "csr")]
#[wasm_bindgen(
    inline_js = "export async function studioCall(payload) { try { const runtime = await import('/vendor/reportstudio-runtime.js'); return await runtime.call(payload); } catch (error) { throw String(error?.message ?? error); } } export function eventPayload(event) { return JSON.stringify(event.detail ?? null); } export async function confirmDiscard(message) { const api = globalThis.__TAURI__?.core; return api ? await api.invoke('confirm_discard_changes', {message}) : window.confirm(message); } export function syncFileMenu(labels) { globalThis.__TAURI__?.core?.invoke('set_file_menu_labels', {labels: JSON.parse(labels)}).catch(console.error); } export function syncDocumentDirty(dirty, message) { globalThis.__TAURI__?.core?.invoke('set_document_dirty', {dirty, message}).catch(console.error); }"
)]
extern "C" {
    #[wasm_bindgen(catch)]
    async fn studioCall(payload: String) -> Result<JsValue, JsValue>;
    #[wasm_bindgen(js_name = syncFileMenu)]
    pub fn sync_file_menu(labels: &str);
    #[wasm_bindgen(js_name = syncDocumentDirty)]
    pub fn sync_document_dirty(dirty: bool, message: &str);
    #[wasm_bindgen(catch, js_name = confirmDiscard)]
    async fn confirm_discard_native(message: &str) -> Result<JsValue, JsValue>;
    #[wasm_bindgen(js_name = eventPayload)]
    fn event_payload(event: &web_sys::Event) -> String;
}

/// A failed native prompt never authorizes discarding the current document.
#[cfg(feature = "csr")]
pub async fn confirm_discard(message: &str) -> Result<bool, String> {
    let value = confirm_discard_native(message).await
        .map_err(|error| error.as_string().unwrap_or_else(|| format!("{error:?}")))?;
    value.as_bool().ok_or_else(|| "Invalid confirmation response.".into())
}

/// Host applications may bind API records without persisting records or credentials.
#[cfg(feature = "csr")]
pub fn install_host_events() {
    use leptos::prelude::*;
    use serde_json::{json, Value};
    let studio = crate::state::studio();
    let parameters = window_event_listener(
        leptos::ev::Custom::new("reportstudio:parameters"),
        move |event| {
            let Ok(Value::Object(values)) = serde_json::from_str(&event_payload(&event)) else {
                return;
            };
            studio.mutate(|project| {
                for parameter in project["parameters"].as_array_mut().into_iter().flatten() {
                    let Some(value) = parameter["id"].as_str().and_then(|id| values.get(id)) else {
                        continue;
                    };
                    if value.is_array() || value.is_object() {
                        continue;
                    }
                    let value = if value.is_null() {
                        String::new()
                    } else {
                        value
                            .as_str()
                            .map(str::to_owned)
                            .unwrap_or_else(|| value.to_string())
                    };
                    if value.len() <= 200 {
                        parameter["value"] = json!(value);
                    }
                }
            });
        },
    );
    let menu = window_event_listener(
        leptos::ev::Custom::new("reportstudio:file-menu"),
        move |event| {
            if let Ok(value) = serde_json::from_str::<Value>(&event_payload(&event)) {
                if let Some(action) = value["action"].as_str() {
                    // Native menu actions must not modify selected report elements while editing text.
                    if matches!(action, "cut" | "copy" | "paste" | "delete")
                        && document().active_element().is_some_and(|element|
                            element.closest("input,textarea,select,[contenteditable]:not([contenteditable=false])")
                                .ok().flatten().is_some())
                    {
                        return;
                    }
                    match action {
                        "undo" => studio.undo(),
                        "redo" => studio.redo(),
                        "view-design" => studio.tab.set("Design".into()),
                        "view-data" => studio.tab.set("Data".into()),
                        "view-preview" => {
                            studio.tab.set("Preview".into());
                            studio.command("preview", Value::Null);
                        }
                        _ => studio.command(action, value["args"].clone()),
                    }
                }
            }
        },
    );
    let tables = window_event_listener(
        leptos::ev::Custom::new("reportstudio:tables"),
        move |event| {
            if let Ok(value) = serde_json::from_str::<Value>(&event_payload(&event)) {
                studio.command("replace-tables", value);
            }
        },
    );
    on_cleanup(move || {
        parameters.remove();
        menu.remove();
        tables.remove();
    });
}

#[cfg(not(feature = "csr"))]
pub fn install_host_events() {}
#[cfg(feature = "csr")]
pub async fn call(value: serde_json::Value) -> Result<serde_json::Value, String> {
    let result = studioCall(value.to_string())
        .await
        .map_err(|e| e.as_string().unwrap_or_else(|| format!("{e:?}")))?;
    serde_json::from_str(&result.as_string().unwrap_or_default()).map_err(|e| e.to_string())
}
