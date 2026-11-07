//! Compact SQL table editor. Column components retain focus while drafts change.
use crate::{domain::*, shared::controls::*, state::studio};
use leptos::prelude::*;
use serde_json::{json, Value};

fn definition() -> Value {
    serde_json::from_str(&studio().draft.get()).unwrap_or_default()
}
fn edit_field(index: usize, edit: impl FnOnce(&mut Value)) {
    let s = studio();
    let mut value = definition();
    if let Some(field) = value["schema"]["fields"]
        .as_array_mut()
        .and_then(|fields| fields.get_mut(index))
    {
        edit(field);
        s.draft.set(value.to_string());
    }
}
/// Move a complete field definition so names, SQL metadata and _sourceName
/// stay together until the draft is applied.
fn move_column(from: usize, to: usize) {
    let s = studio();
    let mut value = definition();
    if let Some(fields) = value["schema"]["fields"].as_array_mut() {
        if from < fields.len() && to < fields.len() && from != to {
            let field = fields.remove(from);
            fields.insert(to, field);
            s.draft.set(value.to_string());
        }
    }
}
#[cfg(feature = "csr")]
fn focus_handle(index: usize) {
    use wasm_bindgen::JsCast;
    request_animation_frame(move || {
        if let Ok(Some(handle)) = document().query_selector(&format!(
            ".new-table-field[data-column-index='{index}'] .column-drag-handle"
        )) {
            if let Ok(handle) = handle.dyn_into::<web_sys::HtmlElement>() {
                let _ = handle.focus();
            }
        }
    });
}
fn default_type(field: &Value, dialect: &str) -> &'static str {
    match field["type"].as_str() {
        Some("number") => "INT",
        Some("boolean") if dialect == "mssql" => "BIT",
        Some("boolean") => "BOOLEAN",
        _ => "VARCHAR",
    }
}
#[derive(Clone, Copy)]
struct ColumnDrag {
    pointer: i32,
    index: usize,
    original_index: usize,
    start_y: f64,
    grab_offset: f64,
    center_y: f64,
    translation: f64,
    moved: bool,
}

#[component]
fn ColumnEditor(
    index: usize,
    dialect: RwSignal<String>,
    catalog: RwSignal<Value>,
    drag: RwSignal<Option<ColumnDrag>>,
) -> impl IntoView {
    let s = studio();
    let field = move || definition()["schema"]["fields"][index].clone();
    let handle = NodeRef::<leptos::html::Button>::new();
    let layout = crate::platform::layout_styles::LayoutStyle::new();
    view! {
     <div class="new-table-field" data-column-index=index.to_string()
      class:column-dragging=move || drag.get().is_some_and(|active| active.index == index && active.moved)
      data-layout=move || {
       let active = drag.get();
       let transform = active.filter(|active| active.index == index && active.moved)
        .map(|active| format!("transform:translateY({}px)", active.translation)).unwrap_or_default();
       layout.apply(transform)
      }
     >
      <button type="button" class="column-drag-handle" node_ref=handle draggable="false"
       aria-label=move || s.t("Move column {0}").replace("{0}", &text(&field(), "name"))
       title=move || s.t("Drag to reorder or use arrow keys")
       disabled=move || array(&definition()["schema"]["fields"]).len() <= 1
       on:pointerdown=move |event| {
        if event.button() != 0 { return; }
        if let Some(handle) = handle.get_untracked() {
         if let Some(row) = handle.parent_element() {
          if handle.set_pointer_capture(event.pointer_id()).is_ok() {
           let rect = row.get_bounding_client_rect();
           let center_y = rect.top() + rect.height() / 2.0;
           let y = event.client_y() as f64;
           drag.set(Some(ColumnDrag { pointer:event.pointer_id(), index, original_index:index, start_y:y, grab_offset:y-center_y, center_y, translation:0.0, moved:false }));
           let _ = handle.focus();
           event.prevent_default();
          }
         }
        }
       }
       on:keydown=move |event| {
        let count = array(&definition()["schema"]["fields"]).len();
        let target = match event.key().as_str() {
         "ArrowUp" if index > 0 => Some(index - 1),
         "ArrowDown" if index + 1 < count => Some(index + 1),
         _ => None,
        };
        if let Some(target) = target {
         event.prevent_default(); move_column(index, target);
         #[cfg(feature = "csr")]
         focus_handle(target);
        }
       }
      >
       <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="3" r="1.2"/><circle cx="11" cy="3" r="1.2"/>
        <circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/>
        <circle cx="5" cy="13" r="1.2"/><circle cx="11" cy="13" r="1.2"/>
       </svg>
      </button>
      <input aria-label=move || s.t("Column {0} name").replace("{0}",&(index+1).to_string()) maxlength="100"
       prop:value=move || text(&field(),"name") on:input=move |event| edit_field(index,|field| field["name"]=json!(event_target_value(&event))) />
      <select aria-label=move || s.t("Column {0} type").replace("{0}",&(index+1).to_string())
       prop:value=move || text(&field()["sqlType"],"name")
       on:change=move |event| {
        let name=event_target_value(&event);let provider=dialect.get_untracked();
        let kind=array(&catalog.get_untracked()[&provider]).into_iter().find(|option| option["name"]==name).map(|option| text(&option,"valueType")).unwrap_or("text".into());
        edit_field(index,|field| {field["type"]=json!(kind);field["sqlType"]=json!({"dialect":provider,"name":name});});
       }>
       {move || {
        let options=array(&catalog.get()[&dialect.get()]);
        let mut groups=Vec::new();for option in &options { let group=text(option,"group");if !groups.contains(&group) {groups.push(group);} }
        groups.into_iter().map(|group| {let members=options.iter().filter(|option| option["group"]==group).cloned().collect::<Vec<_>>();view! {
         <optgroup label=s.t(&group)>{members.into_iter().map(|option| {let name=text(&option,"name");view! {
          <option value=text(&option,"name") selected=move || field()["sqlType"]["name"]==name>{text(&option,"name")}</option>
         }}).collect_view()}</optgroup>
        }}).collect_view()
       }}
      </select>
      <input aria-label=move || s.t("Column {0} type arguments").replace("{0}",&(index+1).to_string())
       placeholder=move || s.t("Length, precision or enum values") maxlength="1000"
       prop:value=move || text(&field()["sqlType"],"arguments")
       on:input=move |event| edit_field(index,|field| field["sqlType"]["arguments"]=json!(event_target_value(&event))) />
      <Button label="Remove column" icon="trash" compact=true class="delete-table-column"
       disabled=Signal::derive(move || array(&definition()["schema"]["fields"]).len()<=1)
       on_press=move |_| {
        let mut value=definition();if let Some(fields)=value["schema"]["fields"].as_array_mut() {fields.remove(index);}
        s.draft.set(value.to_string());
       } />
     </div>
    }
}
#[component]
pub fn DataTableEditor(valid: RwSignal<bool>) -> impl IntoView {
    valid.set(false);
    let s = studio();
    let editing = s.dialog.get_untracked() == "Data table";
    let mut value = definition();
    let provider = value["schema"]["fields"][0]["sqlType"]["dialect"]
        .as_str()
        .unwrap_or("mssql")
        .to_owned();
    if let Some(fields) = value["schema"]["fields"].as_array_mut() {
        for field in fields {
            if editing {
                field["_sourceName"] = field["name"].clone();
            }
            if !field["sqlType"].is_object() {
                field["sqlType"] = json!({"dialect":provider,"name":default_type(field,&provider)});
            }
        }
    }
    s.draft.set(value.to_string());
    let dialect = RwSignal::new(provider);
    let catalog = RwSignal::new(Value::Null);
    let error = RwSignal::new(String::new());
    let drag = RwSignal::new(None::<ColumnDrag>);
    #[cfg(feature = "csr")]
    leptos::task::spawn_local(async move {
        if let Ok(value) = crate::platform::call(json!({"action":"sql-types"})).await {
            catalog.set(value);
        }
    });
    #[cfg(feature = "csr")]
    Effect::new(move |_| {
        let value = definition();
        let snapshot = s.draft.get();
        let project = s.project.get();
        valid.set(false);
        leptos::task::spawn_local(async move {
            match crate::platform::call(json!({"action":"table-definition-preview","project":project,"args":{"value":value,"editing":editing}})).await {
    Ok(result) if s.draft.get_untracked()==snapshot=>{let message=text(&result,"error");valid.set(message.is_empty());error.set(message);}
    Err(message)=>{error.set(message);}
    _=>{}
   }
        });
    });
    view! {
     <div class="data-table-editor"
      on:pointermove=move |event| {
       if let Some(mut active) = drag.get_untracked().filter(|active| active.pointer == event.pointer_id()) {
        let y = event.client_y() as f64;
        if !active.moved && (y - active.start_y).abs() < 4.0 { return; }
        active.moved = true;
        if let Some(row) = document().element_from_point(event.client_x() as f32, event.client_y() as f32)
          .and_then(|element| element.closest(".new-table-field").ok().flatten()) {
         if let Some(target) = row.get_attribute("data-column-index").and_then(|value| value.parse::<usize>().ok()) {
          if target != active.index {
           let rect = row.get_bounding_client_rect();
           move_column(active.index, target);
           active.index = target;
           active.center_y = rect.top() + rect.height() / 2.0;
          }
         }
        }
        active.translation = y - active.center_y - active.grab_offset;
        drag.set(Some(active));
       }
      }
      on:pointerup=move |event| {
       if drag.get_untracked().is_some_and(|active| active.pointer == event.pointer_id()) { drag.set(None); }
      }
      on:pointercancel=move |event| {
       if let Some(active) = drag.get_untracked().filter(|active| active.pointer == event.pointer_id()) {
        move_column(active.index, active.original_index); drag.set(None);
       }
      }
     >
      <label class="property">{move || s.t("Table name")}
       <input aria-label="Table name" maxlength="100" autofocus=true prop:value=move || text(&definition(),"name") on:input=move |event| {
        let mut value=definition();value["name"]=json!(event_target_value(&event));s.draft.set(value.to_string());
       } />
      </label>
      <label class="property">{move || s.t("Database engine")}
       <select aria-label="Database engine" prop:value=move || dialect.get() on:change=move |event| {
        let provider=event_target_value(&event);let options=array(&catalog.get_untracked()[&provider]);let mut value=definition();
        if let Some(fields)=value["schema"]["fields"].as_array_mut() {for field in fields {
         let previous=text(&field["sqlType"],"name");let name=if options.iter().any(|option| option["name"]==previous) {previous} else {default_type(field,&provider).to_owned()};
         let kind=options.iter().find(|option| option["name"]==name).map(|option| text(option,"valueType")).unwrap_or("text".into());
         field["sqlType"]=json!({"dialect":provider,"name":name});field["type"]=json!(kind);
        }}
        dialect.set(provider);s.draft.set(value.to_string());
       }>
        <option value="mssql">"Microsoft SQL Server"</option><option value="postgresql">"PostgreSQL"</option><option value="mysql">"MySQL"</option>
       </select>
      </label>
      <h3>{move || s.t("Columns")}</h3>
      <For each=move || 0..array(&definition()["schema"]["fields"]).len() key=|index| *index children=move |index| view! { <ColumnEditor index dialect catalog drag /> } />
      <Button label="Add column" icon="plus" class="add-table-column" disabled=Signal::derive(move || array(&definition()["schema"]["fields"]).len()>=100)
       on_press=move |_| {
        let mut value=definition();if let Some(fields)=value["schema"]["fields"].as_array_mut() {fields.push(json!({"name":"","type":"text","sqlType":{"dialect":dialect.get_untracked(),"name":"VARCHAR"}}));}
        s.draft.set(value.to_string());
       } />
      <Show when=move || !editing><p class="model-help">{move || s.t("The table starts empty. Fill it in Data or from your API.")}</p></Show>
      <p class="model-help">{move || s.t("Complex SQL values use text serialization in the report. Type arguments depend on the database version.")}</p>
      <Show when=move || !text(&definition(),"name").is_empty() && !error.get().is_empty()><p role="alert">{move || s.t(&error.get())}</p></Show>
     </div>
    }
}
