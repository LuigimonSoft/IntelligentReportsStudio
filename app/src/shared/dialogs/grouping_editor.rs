use crate::{
    domain::{array, text},
    shared::controls::Button,
    state::studio,
};
use leptos::prelude::*;
use serde_json::{json, Value};

fn draft() -> Value {
    serde_json::from_str(&studio().draft.get()).unwrap_or_default()
}
fn selected_detail(project: &Value, id: &str) -> Value {
    array(&project["report"]["details"])
        .into_iter()
        .find(|d| text(d, "id") == id)
        .unwrap_or_default()
}
fn update_group(index: usize, key: &str, value: Value) {
    let s = studio();
    let mut v = draft();
    if let Some(group) = v["groups"]
        .as_array_mut()
        .and_then(|groups| groups.get_mut(index))
    {
        group[key] = value;
        s.draft.set(v.to_string());
    }
}
#[component]
pub(super) fn GroupingEditor(valid: RwSignal<bool>) -> impl IntoView {
    let s = studio();
    Effect::new(move |_| {
        let project = s.project.get();
        let value = draft();
        let detail = selected_detail(&project, &text(&value, "detailId"));
        let table = array(&project["datasets"])
            .into_iter()
            .find(|table| table["id"] == detail["dataset"])
            .unwrap_or_default();
        let fields = array(&table["schema"]["fields"])
            .into_iter()
            .map(|field| text(&field, "name"))
            .collect::<Vec<_>>();
        let groups = array(&value["groups"]);
        let mut used = std::collections::HashSet::new();
        let legacy = text(&value, "legacyField");
        if !legacy.is_empty() {
            used.insert(legacy.clone());
        }
        valid.set(
            !table.is_null()
                && (legacy.is_empty() || fields.contains(&legacy))
                && groups.len() + usize::from(!legacy.is_empty()) <= 10
                && groups.iter().all(|group| {
                    let field = text(group, "field");
                    fields.contains(&field)
                        && used.insert(field)
                        && ["asc", "desc"].contains(&text(group, "direction").as_str())
                }),
        );
    });
    view! {
      <div class="grouping-editor">
        <p>{move || s.t("Choose a detail and add grouping levels in order.")}</p>
        <label class="property">{move || s.t("Detail section")}
          <select aria-label="Grouping detail" prop:value=move || text(&draft(),"detailId") on:change=move |event| {
            let project=s.project.get_untracked();let id=event_target_value(&event);let detail=selected_detail(&project,&id);
            s.draft.set(json!({"detailId":id,"legacyField":text(&detail,"groupBy"),"legacyDirection":detail["sortDirection"].as_str().unwrap_or("asc"),"groups":array(&detail["groups"])}).to_string());
          }>
            {move || array(&s.project.get()["report"]["details"]).into_iter().map(|detail| {
              let id=text(&detail,"id");let name=text(&detail["band"],"name");let dataset=text(&detail,"dataset");
              view!{<option value=id>{format!("{} · {}",s.t(&name),dataset)}</option>}
            }).collect_view()}
          </select>
        </label>
        {move || {
          let project=s.project.get();let value=draft();let detail=selected_detail(&project,&text(&value,"detailId"));
          let table=array(&project["datasets"]).into_iter().find(|table|table["id"]==detail["dataset"]).unwrap_or_default();
          let fields=array(&table["schema"]["fields"]);
          if table.is_null() { return view!{<p role="alert">{s.t("Select a detail with a data source.")}</p>}.into_any(); }
          let legacy=text(&detail,"groupBy");
          view! {
            {(!legacy.is_empty()).then(|| view! {
              <label class="property">{s.t("Existing grouping")}
                <select aria-label="Existing grouping" prop:value=move || text(&draft(),"legacyField") on:change=move |event| {let mut v=draft();v["legacyField"]=json!(event_target_value(&event));s.draft.set(v.to_string());}>
                  <option value="">{s.t("No grouping")}</option>
                  {fields.clone().into_iter().map(|field|view!{<option value=text(&field,"name")>{text(&field,"name")}</option>}).collect_view()}
                </select>
              </label>
              <label class="property">{s.t("Existing group order")}
                <select aria-label="Existing group order" prop:value=move || text(&draft(),"legacyDirection") on:change=move |event| {let mut v=draft();v["legacyDirection"]=json!(event_target_value(&event));s.draft.set(v.to_string());}>
                  <option value="asc">{s.t("Ascending")}</option><option value="desc">{s.t("Descending")}</option>
                </select>
              </label>
            })}
            <div class="grouping-levels">
              {array(&value["groups"]).into_iter().enumerate().map(|(index,group)| {
                let options=fields.clone();let current=text(&group,"field");let direction=text(&group,"direction");
                view!{
                  <fieldset class="grouping-level">
                    <legend>{format!("{} {}",s.t("Grouping level"),index+1)}</legend>
                    <label class="property">{s.t("Group by")}
                      <select aria-label=format!("Grouping field {}",index+1) prop:value=current on:change=move |event| update_group(index,"field",json!(event_target_value(&event)))>
                        {options.into_iter().map(|field|view!{<option value=text(&field,"name")>{text(&field,"name")}</option>}).collect_view()}
                      </select>
                    </label>
                    <label class="property">{s.t("Sort order")}
                      <select aria-label=format!("Grouping order {}",index+1) prop:value=direction on:change=move |event| update_group(index,"direction",json!(event_target_value(&event)))>
                        <option value="asc">{s.t("Ascending")}</option><option value="desc">{s.t("Descending")}</option>
                      </select>
                    </label>
                    <div class="grouping-actions">
                      <button type="button" aria-label=format!("{} {}", s.t("Move group up"), index + 1) disabled=index == 0 on:click=move |_| { let mut v=draft(); if let Some(groups)=v["groups"].as_array_mut() { if index>0 && index<groups.len() { groups.swap(index,index-1); } } s.draft.set(v.to_string()); }>"↑"</button>
                      <button type="button" aria-label=format!("{} {}", s.t("Move group down"), index + 1) disabled=index + 1 == array(&value["groups"]).len() on:click=move |_| { let mut v=draft(); if let Some(groups)=v["groups"].as_array_mut() { if index+1<groups.len() { groups.swap(index,index+1); } } s.draft.set(v.to_string()); }>"↓"</button>
                    </div>
                    <Button label="Remove group" on_press=move |_| {let mut v=draft();if let Some(groups)=v["groups"].as_array_mut(){if index<groups.len(){groups.remove(index);}}s.draft.set(v.to_string());} />
                  </fieldset>
                }
              }).collect_view()}
            </div>
            <Button label="Add group" disabled=Signal::derive(move || {
              let v=draft();let d=selected_detail(&s.project.get(),&text(&v,"detailId"));let t=array(&s.project.get()["datasets"]).into_iter().find(|t|t["id"]==d["dataset"]).unwrap_or_default();
              array(&v["groups"]).len() + usize::from(!text(&v,"legacyField").is_empty()) >= array(&t["schema"]["fields"]).len() || array(&v["groups"]).len() + usize::from(!text(&v,"legacyField").is_empty()) >= 10
            }) on_press=move |_| {
              let mut v=draft();let d=selected_detail(&s.project.get_untracked(),&text(&v,"detailId"));let t=array(&s.project.get_untracked()["datasets"]).into_iter().find(|t|t["id"]==d["dataset"]).unwrap_or_default();
              let used=array(&v["groups"]).iter().map(|g|text(g,"field")).chain([text(&v,"legacyField")]).collect::<Vec<_>>();
              if let Some(field)=array(&t["schema"]["fields"]).iter().map(|f|text(f,"name")).find(|name|!used.contains(name)) {if let Some(groups)=v["groups"].as_array_mut(){groups.push(json!({"field":field,"direction":"asc"}));}s.draft.set(v.to_string());}
            } />
            <p class="helper">{s.t("Each group adds an editable header and footer. Group levels are applied from top to bottom.")}</p>
            <p role="alert">{move || (!valid.get()).then(||s.t("Select a different field for each group."))}</p>
          }.into_any()
        }}
      </div>
    }
}
