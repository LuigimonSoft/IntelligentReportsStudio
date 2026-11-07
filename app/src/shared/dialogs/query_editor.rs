use crate::{
    domain::{array, text},
    state::studio,
};
use leptos::prelude::*;
use serde_json::{json, Value};
#[component]
pub fn QueryEditor() -> impl IntoView {
    let s = studio();
    let sql = RwSignal::new(String::new());
    #[cfg(feature = "csr")]
    let version = RwSignal::new(0usize);
    #[cfg(feature = "csr")]
    Effect::new(move |_| {
        let project = s.project.get();
        let value = serde_json::from_str::<Value>(&s.draft.get()).unwrap_or_default();
        let current = version.get_untracked() + 1;
        version.set(current);
        leptos::task::spawn_local(async move {
            match crate::platform::call(
                json!({"action":"records-query-plan", "project":project, "args":value}),
            )
            .await
            {
                Ok(result) if version.get_untracked() == current => sql.set(text(&result, "sql")),
                Err(error) if version.get_untracked() == current => sql.set(error.to_string()),
                _ => {}
            }
        });
    });
    let draft = move || serde_json::from_str::<Value>(&s.draft.get()).unwrap_or_default();
    view! {
        <label class="property">
            {move || s.t("Table")}
            <select
                aria-label="Query table"
                prop:value=move || text(&draft(), "table")
                on:change=move |e| {
                    let mut v = draft();
                    v["table"] = json!(event_target_value(&e));
                    s.draft.set(v.to_string());
                }
            >
                {move || {
                    array(&s.project.get()["datasets"])
                        .into_iter()
                        .map(|t| view! { <option value=text(&t, "id")>{text(&t, "name")}</option> })
                        .collect_view()
                }}
            </select>
        </label>
        <label class="property">
            {move || s.t("Record limit")}
            <input
                aria-label="Query limit"
                type="number"
                min="1"
                prop:value=move || draft()["limit"].as_u64().unwrap_or(200)
                on:input=move |e| {
                    let mut v = draft();
                    v["limit"] = json!(
                        event_target_value(&e).parse::<usize>().unwrap_or(200).max(1)
                    );
                    s.draft.set(v.to_string());
                }
            />
        </label>
        <label class="property">
            {move || s.t("SQL generated from data model")}
            <textarea aria-label="Generated SQL" readonly=true rows="12" prop:value=move || sql.get() />
        </label>
        <p>{move || s.t("SQL describes the loaded data model. Record filters and search are applied to the result.")}</p>
    }
}
