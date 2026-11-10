use crate::{domain::{array, text}, state::studio};
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
    let expand_nested = move || serde_json::from_str::<Value>(&s.draft.get()).unwrap_or_default()["expandNested"] == true;
    let recognize_dates = move || serde_json::from_str::<Value>(&s.draft.get()).unwrap_or_default()["recognizeDates"] == true;
    let has_error = RwSignal::new(false);
    let preview_tables = RwSignal::new(Vec::<Value>::new());
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
        has_error.set(false);
        preview_tables.set(vec![]);
        if contents.trim().is_empty() {
            result.set(String::new());
            return;
        }
        leptos::task::spawn_local(async move {
            match crate::platform::call(json!({"action":"import-tables-preview","project":project,"args":{"json":contents,"recognizeDates":draft["recognizeDates"] == true,"expandNested":draft["expandNested"] == true}})).await {
                Ok(check) if version.get_untracked() == current => {
                    if check["valid"] == true {
                        valid.set(true);
                        preview_tables.set(array(&check["tables"]));
                        result.set(format!("{}: {}", s.t("Tables ready to import"), check["count"].as_u64().unwrap_or(0)));
                    } else {
                        has_error.set(true);
                        let error = check["error"].as_str().unwrap_or("Invalid JSON file.");
                        let message = if check["syntaxError"] == true {
                            let location = match (check["line"].as_u64(), check["column"].as_u64()) {
                                (Some(line), Some(column)) => format!(" {} {} · {} {}.", s.t("Line"), line, s.t("Column"), column),
                                _ => String::new(),
                            };
                            format!("{}{} {}", s.t("Invalid JSON file."), location, s.t("Check commas, quotation marks, and brackets."))
                        } else {
                            error.strip_prefix("Column has mixed data types: ")
                                .map(|field| format!("{}: {}", s.t("Column has mixed data types"), field))
                                .unwrap_or_else(|| s.t(error))
                        };
                        result.set(message);
                    }
                },
                Err(error) if version.get_untracked() == current => { has_error.set(true); result.set(error); },
                _ => {}
            }
        });
    });
    view! {
      <div class="import-tables-editor">
        <p>{move || s.t("Import one or more tables without replacing the existing model.")}</p>
        <p>{move || s.t("You can also import a flat array of records; column types are inferred from non-null values.")}</p>
        <label class="property">
          {move || s.t("Choose JSON file")}
          <input type="file" accept=".json,application/json" aria-label="Import JSON file"
            on:change=move |_event| {
                #[cfg(feature = "csr")]
                if let Some(input) = _event.target() {
                    let current_file = file_version.get_untracked() + 1;
                    file_version.set(current_file);
                    valid.set(false);
                    s.draft.update(|value| {
                        let mut draft = serde_json::from_str::<Value>(value).unwrap_or_else(|_| json!({}));
                        draft["json"] = json!(""); *value = draft.to_string();
                    });
                    leptos::task::spawn_local(async move {
                        let file = read_import_file(input.into()).await;
                        if file_version.get_untracked() != current_file { return; }
                        match file {
                            Ok(value) => if let Some(content) = value.as_string() {
                                s.draft.update(|value| {
                                    let mut draft = serde_json::from_str::<Value>(value).unwrap_or_else(|_| json!({}));
                                    draft["json"] = json!(content); *value = draft.to_string();
                                });
                            },
                            Err(error) => { valid.set(false); has_error.set(true); result.set(s.t(&error.as_string().unwrap_or_else(|| "Unable to read the file.".into()))); }
                        }
                    });
                }
            }
          />
        </label>
        <label class="property">
          {move || s.t("JSON contents")}
          <textarea aria-label=move || s.t("Import JSON contents") aria-invalid=move || has_error.get() aria-describedby="import-json-status" rows="8" spellcheck="false"
            prop:value=move || text(&serde_json::from_str::<Value>(&s.draft.get()).unwrap_or_default(), "json")
            on:input=move |event| {
                file_version.update(|v| *v += 1);
                s.draft.update(|value| {
                    let mut draft = serde_json::from_str::<Value>(value).unwrap_or_else(|_| json!({}));
                    draft["json"] = json!(event_target_value(&event)); *value = draft.to_string();
                });
            } />
        </label>
        <label class="import-date-option">
          <input type="checkbox" prop:checked=expand_nested on:change=move |event| {
              s.draft.update(|value| {
                  let mut draft = serde_json::from_str::<Value>(value).unwrap_or_else(|_| json!({}));
                  draft["expandNested"] = json!(event_target_checked(&event)); *value = draft.to_string();
              });
          } />
          <span>{move || s.t("Expand nested JSON into related tables")}</span>
        </label>
        <p class="import-date-hint">{move || s.t("Nested objects become fields; arrays of objects become related tables. Arrays of scalar values are not supported.")}</p>
        <label class="import-date-option">
          <input type="checkbox"
            prop:checked=recognize_dates
            on:change=move |event| {
                s.draft.update(|value| {
                    let mut draft = serde_json::from_str::<Value>(value).unwrap_or_else(|_| json!({}));
                    draft["recognizeDates"] = json!(event_target_checked(&event)); *value = draft.to_string();
                });
            } />
          <span>{move || s.t("Recognize ISO dates (YYYY-MM-DD)")}</span>
        </label>
        <p class="import-date-hint">{move || s.t("A column is a date when every non-null value is a valid ISO date. Other text stays as text.")}</p>
        <p id="import-json-status" role="status" class:import-json-error=move || has_error.get()>{move || result.get()}</p>
        <Show when=move || !preview_tables.get().is_empty()>
          <section class="import-structure" aria-label=move || s.t("Detected structure")>
            <strong>{move || s.t("Detected structure")}</strong>
            {move || preview_tables.get().into_iter().map(|table| {
              let count = table["recordCount"].as_u64().unwrap_or(0);
              view! { <details open>
                <summary>{text(&table,"name")} <small>{format!("{} {}",count,s.t("Records"))}</small></summary>
                <ul>{array(&table["fields"]).into_iter().map(|field| {
                  let missing = field["missingCount"].as_u64().unwrap_or(0);
                  let kind = match field["type"].as_str() { Some("number") => "Number", Some("boolean") => "Boolean", _ => "Text" };
                  let sql = text(&field,"sqlType");
                  let name = text(&field,"name");
                  let path = text(&field,"sourcePath");
                  let label = if !path.is_empty() && path != name { format!("{} ({})",path,name) } else { name };
                  view! { <li><span>{label}</span>
                    <small>{if sql.is_empty() {s.t(kind)} else {sql}}</small>
                    {(missing > 0).then(|| view! { <em>{format!("{}: {}",s.t("Missing in some records"),missing)}</em> })}
                  </li> }
                }).collect_view()}</ul>
              </details> }
            }).collect_view()}
          </section>
        </Show>
        <details open>
          <summary>{move || s.t("JSON example")}</summary>
          <pre class="import-json-example">{EXAMPLE}</pre>
        </details>
        <p>{move || s.t("Data is optional. Imported rows are available in this session but are not saved in the report template.")}</p>
      </div>
    }
}
