use crate::{domain::text, state::studio};
use leptos::prelude::*;
use serde_json::{json, Value};
#[cfg(feature = "csr")]
use wasm_bindgen::prelude::*;

#[cfg(feature = "csr")]
#[wasm_bindgen(
    inline_js = "export async function readImportFile(input) { const file = input.files?.[0]; if (!file) return null; if (file.size > 16 * 1024 * 1024) throw new Error('The document exceeds the 16 MiB limit.'); return await file.text(); }"
)]
extern "C" {
    #[wasm_bindgen(catch, js_name = readImportFile)]
    async fn read_import_file(
        input: wasm_bindgen::JsValue,
    ) -> Result<wasm_bindgen::JsValue, wasm_bindgen::JsValue>;
}

const EXAMPLE: &str = r#"{
  "tables": [
    {
      "name": "Customers",
      "schema": { "fields": [
        { "name": "id", "type": "number" },
        { "name": "name", "type": "text" },
        { "name": "active", "type": "boolean" }
      ] },
      "data": [ { "id": 1, "name": "Ana", "active": true } ]
    },
    {
      "name": "Orders",
      "schema": { "fields": [
        { "name": "id", "type": "number" },
        { "name": "customerId", "type": "number" }
      ] }
    }
  ]
}"#;
#[component]
pub fn ImportTables(valid: RwSignal<bool>) -> impl IntoView {
    let s = studio();
    let result = RwSignal::new(String::new());
    #[cfg(feature = "csr")]
    let version = RwSignal::new(0usize);
    #[cfg(not(feature = "csr"))]
    let _ = valid;
    let file_version = RwSignal::new(0usize);
    #[cfg(feature = "csr")]
    Effect::new(move |_| {
        let project = s.project.get();
        let draft = serde_json::from_str::<Value>(&s.draft.get()).unwrap_or_default();
        let contents = text(&draft, "json");
        let current = version.get_untracked() + 1;
        version.set(current);
        valid.set(false);
        if contents.trim().is_empty() {
            result.set(String::new());
            return;
        }
        leptos::task::spawn_local(async move {
            match crate::platform::call(json!({"action":"import-tables-preview","project":project,"args":{"json":contents}})).await {
                Ok(check) if version.get_untracked() == current => {
                    if check["valid"] == true {
                        valid.set(true);
                        result.set(format!("{}: {}", s.t("Tables ready to import"), check["count"].as_u64().unwrap_or(0)));
                    } else { result.set(s.t(check["error"].as_str().unwrap_or("Invalid JSON file."))); }
                },
                Err(error) if version.get_untracked() == current => result.set(error),
                _ => {}
            }
        });
    });
    view! {
      <div class="import-tables-editor">
        <p>{move || s.t("Import one or more tables without replacing the existing model.")}</p>
        <label class="property">
          {move || s.t("Choose JSON file")}
          <input type="file" accept=".json,application/json" aria-label="Import JSON file"
            on:change=move |_event| {
                #[cfg(feature = "csr")]
                if let Some(input) = _event.target() {
                    let current_file = file_version.get_untracked() + 1;
                    file_version.set(current_file);
                    valid.set(false);
                    s.draft.set(json!({"json":""}).to_string());
                    leptos::task::spawn_local(async move {
                        let file = read_import_file(input.into()).await;
                        if file_version.get_untracked() != current_file { return; }
                        match file {
                            Ok(value) => if let Some(content) = value.as_string() { s.draft.set(json!({"json":content}).to_string()); },
                            Err(error) => { valid.set(false); result.set(error.as_string().unwrap_or_else(|| "Unable to read the file.".into())); }
                        }
                    });
                }
            }
          />
        </label>
        <label class="property">
          {move || s.t("JSON contents")}
          <textarea aria-label="Import JSON contents" rows="8" spellcheck="false"
            prop:value=move || text(&serde_json::from_str::<Value>(&s.draft.get()).unwrap_or_default(), "json")
            on:input=move |event| { file_version.update(|v| *v += 1); s.draft.set(json!({"json":event_target_value(&event)}).to_string()); } />
        </label>
        <p role="status">{move || result.get()}</p>
        <details open>
          <summary>{move || s.t("JSON example")}</summary>
          <pre class="import-json-example">{EXAMPLE}</pre>
        </details>
        <p>{move || s.t("Data is optional. Imported rows are available in this session but are not saved in the report template.")}</p>
      </div>
    }
}
