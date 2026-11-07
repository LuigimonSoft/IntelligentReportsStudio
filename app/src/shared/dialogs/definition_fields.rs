use crate::{domain::*, state::studio};
use leptos::prelude::*;
use serde_json::{json, Value};
pub(super) fn draft() -> Value {
    serde_json::from_str(&studio().draft.get()).unwrap_or_default()
}
fn value_at(value: &Value, path: &str) -> Value {
    value
        .pointer(&format!("/{}", path.replace('.', "/")))
        .cloned()
        .unwrap_or_default()
}
fn update(path: &str, value: Value) {
    let s = studio();
    let mut d = draft();
    let mut node = &mut d;
    let keys = path.split('.').collect::<Vec<_>>();
    for key in &keys[..keys.len() - 1] {
        if !node[*key].is_object() {
            node[*key] = json!({});
        }
        node = &mut node[*key];
    }
    node[keys[keys.len() - 1]] = value;
    s.draft
        .set(serde_json::to_string_pretty(&d).unwrap_or_default());
}
#[component]
pub fn TextDefinitionField(label: &'static str, path: &'static str) -> impl IntoView {
    let s = studio();
    view! {
        <label class="property">
            {move || s.t(label)}
            <input
                readonly=move || {
                    label == "Formula name" && !text(&draft(), "editingName").is_empty()
                }
                prop:value=move || {
                    let v = value_at(&draft(), path);
                    v.as_str().map(str::to_owned).unwrap_or_default()
                }
                on:input=move |e| update(path, json!(event_target_value(&e)))
            />
        </label>
    }
}
#[component]
pub fn SelectDefinitionField(
    label: &'static str,
    path: &'static str,
    options: Vec<(String, String)>,
) -> impl IntoView {
    let s = studio();
    view! {
        <label class="property">
            {move || s.t(label)}
            <select
                aria-label=label
                prop:value=move || value_at(&draft(), path).as_str().unwrap_or("").to_owned()
                on:change=move |e| update(path, json!(event_target_value(&e)))
            >
                {options
                    .into_iter()
                    .map(|(value, label)| view! { <option value=value>{label}</option> })
                    .collect_view()}
            </select>
        </label>
    }
}
#[component]
pub fn SourceField(label: &'static str, path: &'static str) -> impl IntoView {
    let s = studio();
    let options = array(&s.project.get_untracked()["datasets"])
        .iter()
        .map(|t| (text(t, "id"), text(t, "name")))
        .collect();
    view! { <SelectDefinitionField label path options /> }
}
#[component]
pub fn ParameterEditor() -> impl IntoView {
    let s = studio();
    view! {
        <div class="definition-grid">
            <div>
                <TextDefinitionField label="ID" path="id" />
                <TextDefinitionField label="Label" path="label" />
                <SourceField label="Table" path="dataset" />
                <TextDefinitionField label="Field" path="field" />
            </div>
            <div>
                <SelectDefinitionField
                    label="Type"
                    path="type"
                    options=["text", "number", "date", "select", "boolean"]
                        .iter()
                        .map(|v| (v.to_string(), s.t(v)))
                        .collect()
                />
                <SelectDefinitionField
                    label="Operator"
                    path="operator"
                    options=["contains", "eq", "gte", "lte"]
                        .iter()
                        .map(|v| (v.to_string(), s.t(v)))
                        .collect()
                />
                <TextDefinitionField label="Default value" path="defaultValue" />
                <label class="check">
                    <input type="checkbox" prop:checked=move || draft()["required"] == true
                        on:change=move |e| update("required", json!(event_target_checked(&e))) />
                    {move || s.t("Required parameter")}
                </label>
                <label class="check">
                    <input
                        type="checkbox"
                        prop:checked=move || draft()["saveValue"] != false
                        on:change=move |e| update("saveValue", json!(event_target_checked(&e)))
                    />
                    {move || s.t("Save value in JSON")}
                </label>
            </div>
        </div>
    }
}
fn insert_token(token: &str) {
    let mut expression = text(&draft(), "expression");
    let insertion = format!(" {token} ");
    #[cfg(feature = "csr")]
    {
        use wasm_bindgen::JsCast;
        if let Some(editor) = web_sys::window()
            .and_then(|w| w.document())
            .and_then(|d| {
                d.query_selector("textarea[aria-label='Formula expression']")
                    .ok()
                    .flatten()
            })
            .and_then(|e| e.dyn_into::<web_sys::HtmlTextAreaElement>().ok())
        {
            let start = editor
                .selection_start()
                .ok()
                .flatten()
                .unwrap_or(expression.encode_utf16().count() as u32)
                as usize;
            let end = editor
                .selection_end()
                .ok()
                .flatten()
                .unwrap_or(start as u32) as usize;
            let units = expression.encode_utf16().collect::<Vec<_>>();
            expression = String::from_utf16_lossy(&units[..start])
                + &insertion
                + &String::from_utf16_lossy(&units[end..]);
            editor.set_value(&expression);
            let _ = editor.focus();
            let position = (start + insertion.encode_utf16().count()) as u32;
            let _ = editor.set_selection_range(position, position);
            update("expression", json!(expression));
            return;
        }
    }
    expression.push_str(&insertion);
    update("expression", json!(expression));
}
#[component]
pub fn FormulaEditor() -> impl IntoView {
    let s = studio();
    let result = RwSignal::new(String::new());
    let search = RwSignal::new(String::new());
    let validation = RwSignal::new(String::new());
    #[cfg(feature = "csr")]
    let revision = RwSignal::new(0_u64);
    let dataset = RwSignal::new(
        array(&s.project.get_untracked()["report"]["details"])
            .last()
            .map(|d| text(d, "dataset"))
            .unwrap_or_default(),
    );
    let record = RwSignal::new(1_u32);
    #[cfg(feature = "csr")]
    Effect::new(move |_| {
        let d = draft();
        let project = s.project.get();
        let dataset = dataset.get();
        let record = record.get();
        let current = revision.get_untracked() + 1;
        revision.set(current);
        s.formula_valid.set(false);
        leptos::task::spawn_local(async move {
            match crate::platform::call(json!({"action":"formula-preview","project":project,"args":{"expression":d["expression"],"name":d["name"],"editingName":d["editingName"],"dataset":dataset,"record":record}})).await {
                Ok(value) => {
                    if revision.get_untracked() != current { return; }
                    s.formula_valid.set(value["valid"] == true);
                    validation.set(if text(&d,"name").is_empty(){String::new()}else{text(&value,"validation")});
                    let error=text(&value,"error");
                    result.set(if !error.is_empty(){error}else if value["result"].is_string(){text(&value,"result")}else{value["result"].to_string()});
                }, Err(error)=>result.set(error)
            }
        });
    });
    view! {
        <div class="formula-editor-layout">
            <aside class="formula-editor-fields">
                <input
                    aria-label="Search formula fields"
                    placeholder=move || s.t("Search fields")
                    on:input=move |event| search.set(event_target_value(&event).to_lowercase())
                />
                <h3>{move || s.t("Available fields")}</h3>
                {array(&s.project.get_untracked()["datasets"])
                    .into_iter()
                    .map(|table| {
                        let id = text(&table, "id");
                        view! {
                            <details>
                                <summary>{text(&table, "name")}</summary>
                                {array(&table["schema"]["fields"])
                                    .into_iter()
                                    .map(|field| {
                                        let token = if id
                                            .chars()
                                            .enumerate()
                                            .all(|(i, c)| {
                                                c == '_' || c.is_ascii_alphabetic()
                                                    || (i > 0 && c.is_ascii_digit())
                                            })
                                        {
                                            format!("{}.{}", id, text(&field, "name"))
                                        } else {
                                            format!(
                                                "FIELD({}, {})",
                                                serde_json::to_string(&id).unwrap_or_default(),
                                                serde_json::to_string(&text(&field, "name"))
                                                    .unwrap_or_default(),
                                            )
                                        };
                                        let name = text(&field, "name");
                                        let filter = format!("{}.{}", id, name).to_lowercase();
                                        view! {
                                            <button
                                                class="formula-token"
                                                hidden=move || !filter.contains(&search.get())
                                                on:click=move |_| insert_token(&token)
                                            >
                                                {name}
                                            </button>
                                        }
                                    })
                                    .collect_view()}
                            </details>
                        }
                    })
                    .collect_view()}
                <details>
                    <summary>{move || s.t("Formula fields")}</summary>
                    {array(&s.project.get_untracked()["report"]["formulas"])
                        .into_iter()
                        .map(|f| {
                            let name = text(&f, "name");
                            let token = name.clone();
                            let filter = name.to_lowercase();

                            view! {
                                <button
                                    class="formula-token"
                                    hidden=move || !filter.contains(&search.get())
                                    on:click=move |_| insert_token(&token)
                                >
                                    {name}
                                </button>
                            }
                        })
                        .collect_view()}
                </details>
                {array(&s.project.get_untracked()["report"]["formulas"])
                    .into_iter()
                    .map(|formula| {
                        let name = text(&formula, "name");
                        let expression = text(&formula, "expression");
                        let filter = name.to_lowercase();
                        let label = format!("{} {}", s.t("Edit formula"), name);
                        view! {
                            <button
                                class="formula-token"
                                hidden=move || !filter.contains(&search.get())
                                on:click=move |_| {
                                    update("name", json!(name));
                                    update("expression", json!(expression));
                                    update("editingName", json!(name));
                                }
                            >
                                {label}
                            </button>
                        }
                    })
                    .collect_view()}
                <details>
                    <summary>{move || s.t("Special fields")}</summary>
                    {[
                        "ROW_NUMBER",
                        "ROW_COUNT",
                        "TABLE_ROW_NUMBER",
                        "COLUMN_NUMBER",
                        "IS_ODD_ROW",
                        "PAGE_NUMBER",
                        "PAGE_COUNT",
                    ]
                        .into_iter()
                        .map(|token| {
                            view! {
                                <button
                                    class="formula-token"
                                    hidden=move || !token.to_lowercase().contains(&search.get())
                                    on:click=move |_| insert_token(token)
                                >
                                    {token}
                                </button>
                            }
                        })
                        .collect_view()}
                </details>
            </aside>
            <div class="formula-center formula-editor-center">
                <TextDefinitionField label="Formula name" path="name" />
                <textarea
                    aria-label="Formula expression"
                    spellcheck="false"
                    prop:value=move || text(&draft(), "expression")
                    on:input=move |e| update("expression", json!(event_target_value(&e)))
                ></textarea>
                <h3>{move || s.t("Result preview")}</h3>
                <div class="formula-preview-controls">
                    <select
                        aria-label="Preview data source"
                        prop:value=move || dataset.get()
                        on:change=move |event| {
                            dataset.set(event_target_value(&event));
                            record.set(1);
                        }
                    >
                        {array(&s.project.get_untracked()["datasets"])
                            .into_iter()
                            .map(|source| {
                                view! {
                                    <option value=text(
                                        &source,
                                        "id",
                                    )>{text(&source, "name")}</option>
                                }
                            })
                            .collect_view()}
                    </select>
                    <label>
                        {move || s.t("Record")}
                        <input
                            aria-label="Preview record"
                            type="number"
                            min="1"
                            prop:value=move || record.get().to_string()
                            on:input=move |event| {
                                record
                                    .set(
                                        event_target_value(&event)
                                            .parse::<u32>()
                                            .unwrap_or(1)
                                            .max(1),
                                    )
                            }
                        />
                    </label>
                </div>
                <output aria-label="Formula result">
                    {move || {
                        if text(&draft(), "expression").trim().is_empty() {
                            s.t("Enter a formula to see its result.")
                        } else {
                            result.get()
                        }
                    }}
                </output>
                <Show when=move || !validation.get().is_empty()>
                    <p role="alert">{move || s.t(&validation.get())}</p>
                </Show>
            </div>
            <aside>
                <h3>{move || s.t("Operators")}</h3>
                {[
                    ("Arithmetic", vec![" + ", " - ", " * ", " / "]),
                    ("Comparisons", vec![" = ", " != ", " > ", " < ", " >= ", " <= "]),
                    ("Boolean", vec![" && ", " || ", " ! "]),
                    ("Grouping", vec!["(", ")"]),
                    ("Constants", vec!["true", "false", "null"]),
                ]
                    .into_iter()
                    .map(|(name, tokens)| {
                        view! {
                            <details>
                                <summary>{s.t(name)}</summary>
                                {tokens
                                    .into_iter()
                                    .map(|token| {
                                        view! {
                                            <button on:click=move |_| insert_token(
                                                token,
                                            )>{token}</button>
                                        }
                                    })
                                    .collect_view()}
                            </details>
                        }
                    })
                    .collect_view()}
                <h3>{move || s.t("Functions")}</h3>
                {[
                    ("Control structures", vec!["IF(true, 1, 0)", "IIF(true, 1, 0)"]),
                    ("Boolean", vec!["AND(true, true)", "OR(true, false)", "NOT(false)"]),
                    ("Aggregates", vec!["SUM(0)"]),
                    ("Math", vec!["MOD(ROW_NUMBER, 2)"]),
                    ("Date and time", vec!["DATE()"]),
                    ("Conversion", vec!["FORMAT(DATE(), 'dd/mm/yyyy')"]),
                    ("Data fields", vec!["FIELD('table', 'field')"]),
                ]
                    .into_iter()
                    .map(|(name, tokens)| {
                        view! {
                            <details>
                                <summary>{s.t(name)}</summary>
                                {tokens
                                    .into_iter()
                                    .map(|token| {
                                        view! {
                                            <button on:click=move |_| insert_token(
                                                token,
                                            )>{token.split('(').next().unwrap_or(token)}</button>
                                        }
                                    })
                                    .collect_view()}
                            </details>
                        }
                    })
                    .collect_view()}
            </aside>
        </div>
    }
}
#[component]
pub fn ChartEditor() -> impl IntoView {
    super::chart_editor::ChartEditor()
}
