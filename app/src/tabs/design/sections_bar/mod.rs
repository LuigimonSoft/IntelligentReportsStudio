mod menu;
use crate::{domain::*, shared::controls::Button, state::studio};
use leptos::prelude::*;
use serde_json::json;
#[component]
pub fn SectionsBar() -> impl IntoView {
    let s = studio();
    view! {
        <footer class="sections-bar">
            <strong>{move || s.t("Report sections")}</strong>
            <div>
                {move || {
                    bands(&s.project.get()["report"])
                        .into_iter()
                        .map(|b| {
                            let id = text(&b, "id");
                            let dom_id = format!("section-tab-{id}");
                            let active = id.clone();
                            let menu_id = id.clone();
                            let child = id.clone();
                            let child_lock = id.clone();
                            let child_name = s.t(&text(&b, "name"));
                            let visible = id.clone();
                            let remove = id.clone();
                            let edit_group = id.clone();
                            let edit_group_menu = id.clone();
                            let p = s.project.get_untracked();
                            let r = &p["report"];
                            let d = &r["details"][0];
                            let grouping_section = array(&r["details"]).iter().any(|detail| {
                                (!text(detail, "groupBy").is_empty() && ["groupHeader", "groupFooter"].iter().any(|key| text(&detail[*key], "id") == id))
                                    || array(&detail["groups"]).iter().any(|group| ["header", "footer"].iter().any(|key| text(&group[*key], "id") == id))
                            });
                            let default = grouping_section || [
                                &r["header"],
                                &r["pageHeader"],
                                &r["pageFooter"],
                                &r["footer"],
                                &d["groupHeader"],
                                &d["band"],
                                &d["groupFooter"],
                            ]
                                .iter()
                                .any(|band| text(band, "id") == id);
                            view! {
                                <div
                                    class="section-card"
                                    id=dom_id
                                    class:selected=move || s.band.get() == menu_id
                                >
                                    <button
                                        class="section-select"
                                        class:active=move || s.band.get() == active
                                        on:click=move |_| {
                                            s.band.set(id.clone());
                                            s.selected.set(vec![]);
                                        }
                                    >
                                        <span
                                            class="section-color-dot"
                                            data-section-name=text(&b, "name")
                                        ></span>
                                        {s.t(&text(&b, "name"))}
                                    </button>
                                    {grouping_section.then(|| view! {
                                        <Button label="Edit group" icon="edit" compact=true class="edit-group-button"
                                            on_press=move |_| s.show_grouping_for_section(&edit_group) />
                                    })}
                                    <menu::SectionMenu>
                                            {grouping_section.then(|| view! {
                                                <Button label="Edit group" icon="edit"
                                                    on_press=move |_| s.show_grouping_for_section(&edit_group_menu) />
                                            })}
                                            <Button
                                                label="Add subsection"
                                                disabled=Signal::derive(move || read_only(&s.project.get()["report"],&child_lock))
                                                on_press=move |_| {
                                                    s.band.set(child.clone());
                                                    s.command("add-subsection", json!({"band":child.clone(),"parentName":child_name.clone()}));
                                                }
                                            />
                                            <label class="check">
                                                <input
                                                    type="checkbox"
                                                    checked=b["visible"] != false
                                                    on:change=move |e| {
                                                        s.band.set(visible.clone());
                                                        s.patch_band("visible", json!(event_target_checked(&e)));
                                                    }
                                                />
                                                {s.t("Section visible")}
                                            </label>
                                            {(!default)
                                                .then(|| {
                                                    view! {
                                                        <Button
                                                            label="Delete section"
                                                            on_press=move |_| {
                                                                s.band.set(remove.clone());
                                                                s.command("remove-section", json!({}));
                                                            }
                                                        />
                                                    }
                                                })}
                                    </menu::SectionMenu>
                                </div>
                            }
                        })
                        .collect_view()
                }} <menu::SectionMenu add=true>
                        {move || {
                            array(&s.project.get()["datasets"])
                                .into_iter()
                                .map(|table| {
                                    let id = text(&table, "id");
                                    view! {
                                        <button
                                            type="button"
                                            class="button"
                                            on:click=move |_| {
                                                s.command("add-detail-section", json!({"dataset":id,"labels":{"detail":s.t("Details"),"header":s.t("Details header"),"footer":s.t("Details footer")}}))
                                            }
                                        >
                                            {format!("{} {}", s.t("Details"), text(&table, "name"))}
                                        </button>
                                    }
                                })
                                .collect_view()
                        }}
                    <Show when=move || array(&s.project.get()["datasets"]).is_empty()>
                        <Button label="Details" on_press=move |_| s.command("add-detail-section",json!({"dataset":"","labels":{"detail":s.t("Details"),"header":s.t("Details header"),"footer":s.t("Details footer")}})) />
                    </Show>
                </menu::SectionMenu>
            </div>
        </footer>
    }
}
