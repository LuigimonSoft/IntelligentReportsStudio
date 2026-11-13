mod drag_geometry;
pub mod elements;
mod resize_handle;
pub mod rulers;
use crate::{domain::*, state::studio};
use leptos::prelude::*;
use serde_json::json;
#[component]
pub fn ReportArea() -> impl IntoView {
    let s = studio();
    let resizing = RwSignal::new(None::<(String, f64, f64)>);
    let resize_delta = RwSignal::new(0.0);
    let editing = RwSignal::new(String::new());
    let edit_value = RwSignal::new(String::new());
    let drag = RwSignal::new(None::<drag_geometry::DragGesture>);
    let drop_target = RwSignal::new(String::new());
    let delta = RwSignal::new((0.0, 0.0));
    let frame = NodeRef::<leptos::html::Div>::new();
    let canvas = NodeRef::<leptos::html::Div>::new();
    let scroll_position = RwSignal::new((0, 0));
    #[cfg(feature = "csr")]
    Effect::new(move |_| {
        if canvas.get().is_some() && !s.design_fit_initialized.get_untracked() {
            s.design_fit_initialized.set(true);
            s.fit_design();
        }
    });
    let paper = NodeRef::<leptos::html::Div>::new();
    #[cfg(feature = "csr")]
    {
        let listener = window_event_listener(leptos::ev::resize, move |_| {
            if s.zoom_auto.get_untracked() {
                s.fit_design();
            }
        });
        on_cleanup(move || listener.remove());
    }
    view! {
        <div class="canvas-frame" node_ref=frame>
            <div
                class="canvas-scroll"
                node_ref=canvas
                on:scroll=move |_| {
                    if let Some(c) = canvas.get() {
                        scroll_position.set((c.scroll_left(), c.scroll_top()));
                    }
                }
            >
                <div class="design-ruler-space"></div>
                <div class="paper-wrap">
                    <div
                        node_ref=paper
                        class="report-paper"
                        data-guides=move || s.guides.get()
                        data-layout={
                            let layout = crate::platform::layout_styles::LayoutStyle::new();
                            move || {
                                layout
                                    .apply({
                                        let p = s.project.get();
                                        let z = DESIGN_PIXELS_PER_INCH * s.zoom.get();
                                        let spacing = s.spacing.get();
                                        format!(
                                            "width:{}px;min-height:{}px;--guide-size:{}px;background-color:{}",
                                            number(&p["report"]["page"], "width") * z,
                                            design_height(&p["report"]) * z,
                                            spacing * z,
                                            p["report"]["page"]["background"].as_str().unwrap_or("#ffffff"),
                                        )
                                    })
                            }
                        }
                        on:pointermove=move |e| {
                            if let Some((_, _, start)) = resizing.get_untracked() {
                                resize_delta
                                    .set(
                                        (e.client_y() as f64 - start)
                                            / (DESIGN_PIXELS_PER_INCH * s.zoom.get_untracked()),
                                    );
                                return;
                            }
                            if let (Some(gesture), Some(p)) = (drag.get_untracked(), paper.get()) {
                                if gesture.pointer != e.pointer_id() { return; }
                                let point = (e.client_x() as f64, e.client_y() as f64);
                                if gesture.crossed_threshold(point) {
                                    let _ = p.set_pointer_capture(e.pointer_id());
                                    let rect = p.get_bounding_client_rect();
                                    delta.set(gesture.delta(point, (rect.left(), rect.top())));
                                }
                            }
                        }
                        on:pointerup=move |e| {
                            if let Some((band, height, _)) = resizing.get_untracked() {
                                s.command(
                                    "resize-section",
                                    json!(
                                        {"band":band,"height":height+resize_delta.get_untracked()}
                                    ),
                                );
                                resizing.set(None);
                                resize_delta.set(0.0);
                                return;
                            }
                            if let (Some(gesture), Some(p)) = (drag.get_untracked(), paper.get()) {
                                if gesture.pointer != e.pointer_id() { return; }
                                let point = (e.client_x() as f64, e.client_y() as f64);
                                let rect = p.get_bounding_client_rect();
                                let (dx, dy) = gesture.delta(point, (rect.left(), rect.top()));
                                if gesture.crossed_threshold(point) && drag_geometry::contains_point((rect.left(), rect.top(), rect.right(), rect.bottom()), point) {
                                    let target = design_bands(&s.project.get_untracked()["report"])
                                        .into_iter()
                                        .filter_map(|band| document().get_element_by_id(&format!("report-section-{}", text(&band, "id"))))
                                        .find(|band| {
                                            let rect = band.get_bounding_client_rect();
                                            drag_geometry::contains_point((rect.left(), rect.top(), rect.right(), rect.bottom()), point)
                                        })
                                        .and_then(|band| band.get_attribute("data-band"));
                                    if let Some(target) = target {
                                        let scale = DESIGN_PIXELS_PER_INCH * s.zoom.get_untracked();
                                        let target_top = document().get_element_by_id(&format!("report-section-{target}"))
                                            .map(|element| (element.get_bounding_client_rect().top() - rect.top()) / scale).unwrap_or(0.0);
                                        let margin = number(&s.project.get_untracked()["report"]["page"]["margins"], "left");
                                        s.command("move", json!({"dx":dx,"dy":dy,"targetBand":target,
                                            "snapSpacing":if s.snap_grid.get_untracked() {s.spacing.get_untracked()} else {0.0},
                                            "snapOffsetX":margin,"snapOffsetY":target_top}));
                                    }
                                }
                                drag.set(None);
                                delta.set((0.0, 0.0));
                                let _ = p.release_pointer_capture(e.pointer_id());
                            }
                        }
                        on:pointercancel=move |_| {
                            drag.set(None);
                            delta.set((0.0, 0.0));
                        }
                        on:dragover=move |e| {
                            e.prevent_default();
                            #[cfg(feature = "csr")]
                            {
                                use wasm_bindgen::JsCast;
                                let band = e.target().and_then(|target| target.dyn_into::<web_sys::Element>().ok()).and_then(|element| element.closest(".report-band").ok().flatten());
                                drop_target.set(band.and_then(|element| element.get_attribute("data-band")).unwrap_or_default());
                            }
                        }
                        on:dragleave=move |_e| {
                            #[cfg(feature = "csr")]
                            if let (Some(paper), Some(target)) = (paper.get_untracked(), _e.related_target()) {
                                use wasm_bindgen::JsCast;
                                if target.dyn_into::<web_sys::Node>().ok().is_some_and(|node| paper.contains(Some(&node))) { return; }
                            }
                            drop_target.set(String::new());
                        }
                        on:drop=move |e| {
                            e.prevent_default();
                            drop_target.set(String::new());
                            #[cfg(feature = "csr")]
                            {
                                use wasm_bindgen::JsCast;
                                let target = e.target().and_then(|target| target.dyn_into::<web_sys::Element>().ok()).and_then(|element| element.closest(".report-band").ok().flatten()).or_else(|| {
                                    design_bands(&s.project.get_untracked()["report"]).into_iter().filter_map(|band| document().get_element_by_id(&format!("report-section-{}", text(&band, "id")))).find(|band| {
                                        let rect = band.get_bounding_client_rect();
                                        let y = e.client_y() as f64;
                                        y >= rect.top() && y <= rect.bottom()
                                    })
                                });
                                if let (Some(data), Some(p), Some(band)) = (e.data_transfer(), paper.get(), target) {
                                    if let (Some(id), Ok(token)) = (band.get_attribute("data-band"), data.get_data("text/plain")) {
                                        let z = DESIGN_PIXELS_PER_INCH * s.zoom.get_untracked();
                                        let paper_rect = p.get_bounding_client_rect();
                                        let band_rect = band.get_bounding_client_rect();
                                        let margin = number(&s.project.get_untracked()["report"]["page"]["margins"], "left");
                                        let mut x = ((e.client_x() as f64 - paper_rect.left()) / z - margin).max(0.0);
                                        let mut y = ((e.client_y() as f64 - band_rect.top()) / z).max(0.0);
                                        if s.snap_grid.get_untracked() {
                                            let step = s.spacing.get_untracked().max(0.001);
                                            let top = (band_rect.top() - paper_rect.top()) / z;
                                            x = (((x + margin) / step).round() * step - margin).max(0.0);
                                            y = (((y + top) / step).round() * step - top).max(0.0);
                                        }
                                        s.band.set(id);
                                        if let Some(action) = token.strip_prefix("reportstudio-tool:") {
                                            s.command(action, json!({"x":x,"y":y}));
                                        } else if let Some(field) = serde_json::from_str::<serde_json::Value>(&data.get_data("application/x-reportstudio-field").unwrap_or_default()).ok().or_else(|| {
                                            // Some WebKit ports omit custom MIME types during native drags.
                                            // Match the plain-text token so external text cannot reuse stale state.
                                            s.dragged_field.get_untracked().filter(|field| field["text"].as_str() == Some(token.as_str()))
                                        }) {
                                            let target_at_point = document().element_from_point(e.client_x() as f32, e.client_y() as f32)
                                                .and_then(|element| element.closest(".report-element").ok().flatten());
                                            let event_target = e.target().and_then(|target| target.dyn_into::<web_sys::Element>().ok())
                                                .and_then(|element| element.closest(".report-element").ok().flatten());
                                            let hit = target_at_point.or(event_target).and_then(|element| element.get_attribute("data-element"));
                                            let project = s.project.get_untracked();
                                            let item = hit.as_ref().and_then(|id| bands(&project["report"]).into_iter().flat_map(|band| array(&band["elements"])).find(|element| text(element, "id") == *id));
                                            if let Some(element) = item.filter(|element| element["cell"].is_object() && element["table"].is_object()) {
                                                s.selected.set(vec![text(&element, "id")]);
                                                s.command("table-content", json!({"operation":"drop-field","field":field}));
                                            } else {
                                                s.command("add-field", json!({"field":field,"x":x,"y":y}));
                                            }
                                        } else if !token.is_empty() {
                                            s.command("add-text", json!({"text":token,"x":x,"y":y}));
                                        }
                                    }
                                }
                            }
                        }
                    >
                        <Show when=move || s.show_margins.get()>
                            <div class="page-margin-outline" aria-hidden="true" data-layout={
                                let layout = crate::platform::layout_styles::LayoutStyle::new();
                                move || {
                                    let project = s.project.get();
                                    let page = &project["report"]["page"];
                                    let margins = &page["margins"];
                                    let scale = DESIGN_PIXELS_PER_INCH * s.zoom.get();
                                    let left = number(margins, "left");
                                    let top = number(margins, "top");
                                    let width = (number(page, "width") - left - number(margins, "right")).max(0.0);
                                    let height = (number(page, "height") - top - number(margins, "bottom")).max(0.0);
                                    layout.apply(format!("left:{}px;top:{}px;width:{}px;height:{}px", left*scale, top*scale, width*scale, height*scale))
                                }
                            }></div>
                        </Show>
                        {move || {
                            design_bands(&s.project.get()["report"])
                                .into_iter()
                                .enumerate()
                                .map(|(index, band)| {
                                    let id = text(&band, "id");
                                    let choose = id.clone();
                                    let resize = id.clone();
                                    let resize_line = id.clone();
                                    let resized_style = id.clone();
                                    let readonly = read_only(
                                        &s.project.get_untracked()["report"],
                                        &id,
                                    );
                                    let elements = array(&band["elements"]);
                                    let height = number(&band, "height");
                                    let background = text(&band, "background");
                                    view! {
                                        <section
                                            class="report-band"
                                            class:compact-band=move || height * DESIGN_PIXELS_PER_INCH * s.zoom.get() < 50.0
                                            id=format!("report-section-{}",id)
                                            data-band-tone=(index % 7).to_string()
                                            data-band=id.clone()
                                            class:hidden-band=band["visible"] == false
                                            class:field-drop-target=move || drop_target.get() == id
                                            data-layout={
                                                let layout = crate::platform::layout_styles::LayoutStyle::new();
                                                move || {
                                                    layout
                                                        .apply({
                                                            format!(
                                                                "height:{}px;background-color:{}",
                                                                (height
                                                                    + if resizing
                                                                        .get()
                                                                        .is_some_and(|(id, _, _)| id == resized_style)
                                                                    {
                                                                        resize_delta.get()
                                                                    } else {
                                                                        0.0
                                                                    })
                                                                    .max(0.05) * DESIGN_PIXELS_PER_INCH * s.zoom.get(),
                                                                background,
                                                            )
                                                        })
                                                }
                                            }
                                            on:click=move |_| {
                                                s.band.set(choose.clone());
                                                s.selected.set(vec![]);
                                            }
                                        >
                                            <div class="band-label">
                                                {s.t(&text(&band, "name"))}
                                                <small>
                                                    {move || {
                                                        format!(
                                                            "{:.2} {}",
                                                            height * s.measurement_scale(),
                                                            s.units.get(),
                                                        )
                                                    }}
                                                </small>
                                            </div>
                                            {elements
                                                .into_iter()
                                                .map(|element| {
                                                    let eid = text(&element, "id");
                                                    let select = eid.clone();
                                                    let active = eid.clone();
                                                    let band_id = id.clone();
                                                    let text_value = text(&element, "text");
                                                    let edit = element.clone();
                                                    let editor_id = eid.clone();
                                                    let blur_id = StoredValue::new(eid.clone());
                                                    let elstyle = element.clone();
                                                    let elmove = element.clone();
                                                    let element_locked = element["locked"] == true;
                                                    view! {
                                                        <div
                                                            class="report-element"
                                                            class:hidden-element=element["visible"] == false
                                                            class:locked-element=element["locked"] == true
                                                            data-vertical-align=element["style"]["verticalAlign"].as_str().unwrap_or("top").to_owned()
                                                            class:underlined=element["type"] == "text" && element["style"]["underline"] == true
                                                            data-element=eid.clone()
                                                            class:selected=move || s.selected.get().contains(&active)
                                                            data-layout={
                                                                let layout = crate::platform::layout_styles::LayoutStyle::new();
                                                                move || {
                                                                    layout
                                                                        .apply({
                                                                            let z = DESIGN_PIXELS_PER_INCH * s.zoom.get();
                                                                            let selected = s
                                                                                .selected
                                                                                .get()
                                                                                .contains(&text(&elmove, "id"))
                                                                                || elmove["groupId"]
                                                                                    .as_str()
                                                                                    .is_some_and(|group| {
                                                                                        bands(&s.project.get()["report"])
                                                                                            .iter()
                                                                                            .flat_map(|b| array(&b["elements"]))
                                                                                            .any(|e| {
                                                                                                e["groupId"].as_str() == Some(group)
                                                                                                    && s.selected.get().contains(&text(&e, "id"))
                                                                                            })
                                                                                    });
                                                                            let (dx, dy) = if selected {
                                                                                delta.get()
                                                                            } else {
                                                                                (0.0, 0.0)
                                                                            };
                                                                            format!(
                                                                                "left:{}px;top:{}px;width:{}px;height:{}px;font-size:{}px;font-family:{};color:{};font-weight:{};font-style:{};text-align:{};transform:translate({}px,{}px);",
                                                                                (number(&elstyle, "x")
                                                                                    + number(
                                                                                        &s.project.get()["report"]["page"]["margins"],
                                                                                        "left",
                                                                                    )) * z,
                                                                                number(&elstyle, "y") * z,
                                                                                number(&elstyle, "width") * z,
                                                                                number(&elstyle, "height") * z,
                                                                                number(&elstyle["style"], "fontsize") * z / 72.0,
                                                                                font_stack(&text(&elstyle["style"], "fontFamily")),
                                                                                text(&elstyle["style"], "color"),
                                                                                if elstyle["style"]["bold"] == true {
                                                                                    "700"
                                                                                } else {
                                                                                    "400"
                                                                                },
                                                                                if elstyle["style"]["italic"] == true {
                                                                                    "italic"
                                                                                } else {
                                                                                    "normal"
                                                                                },
                                                                                text(&elstyle["style"], "align"),
                                                                                dx * z,
                                                                                dy * z,
                                                                            )
                                                                        })
                                                                }
                                                            }
                                                            on:click=move |e| e.stop_propagation()
                                                            on:pointerdown=move |e| {
                                                                e.stop_propagation();
                                                                s.band.set(band_id.clone());
                                                                if e.shift_key() || e.ctrl_key() || e.meta_key() {
                                                                    s.selected
                                                                        .update(|v| {
                                                                            if v.contains(&select) {
                                                                                v.retain(|id| id != &select)
                                                                            } else {
                                                                                v.push(select.clone())
                                                                            }
                                                                        });
                                                                } else if !s.selected.get_untracked().contains(&select) {
                                                                    s.selected.set(vec![select.clone()]);
                                                                }
                                                                if let (false, 0, Some(p)) = (readonly || element_locked, e.button(), paper.get_untracked()) {
                                                                    let rect = p.get_bounding_client_rect();
                                                                    drag.set(Some(drag_geometry::DragGesture::new(e.pointer_id(), (e.client_x() as f64, e.client_y() as f64), (rect.left(), rect.top()), DESIGN_PIXELS_PER_INCH * s.zoom.get_untracked())));
                                                                }
                                                            }
                                                            on:dblclick=move |_| {
                                                                if !readonly && !element_locked && edit["type"] == "text" {
                                                                    editing.set(text(&edit, "id"));
                                                                    edit_value.set(text(&edit, "text"));
                                                                }
                                                            }
                                                        >
                                                            <elements::ReportElementView element=element.clone() />
                                                            {(!readonly && !element_locked).then(|| view! { <resize_handle::ResizeHandle element=element.clone() /> })}
                                                            <span class="element-accessible">{text_value}</span>
                                                            <Show when=move || editing.get() == editor_id>
                                                                <textarea
                                                                    autofocus=true
                                                                    class="inline-text-editor"
                                                                    aria-label="Edit text"
                                                                    prop:value=move || edit_value.get()
                                                                    on:pointerdown=move |e| e.stop_propagation()
                                                                    on:input=move |e| edit_value.set(event_target_value(&e))
                                                                    on:blur=move |_| {
                                                                        if editing.get_untracked() == blur_id.get_value() {
                                                                            s.command(
                                                                                "cell-text",
                                                                                json!({"text":edit_value.get_untracked()}),
                                                                            );
                                                                            editing.set(String::new());
                                                                        }
                                                                    }
                                                                    on:keydown=move |e| {
                                                                        e.stop_propagation();
                                                                        if e.key() == "Enter" && !e.shift_key() {
                                                                            e.prevent_default();
                                                                            s.command(
                                                                                "cell-text",
                                                                                json!({"text":edit_value.get_untracked()}),
                                                                            );
                                                                            editing.set(String::new());
                                                                        } else if e.key() == "Escape" {
                                                                            editing.set(String::new());
                                                                        }
                                                                    }
                                                                ></textarea>
                                                            </Show>
                                                        </div>
                                                    }
                                                })
                                                .collect_view()}
                                            <div
                                                class="band-resize"
                                                on:pointerdown=move |e| {
                                                    e.stop_propagation();
                                                    if !readonly {
                                                        resizing
                                                            .set(
                                                                Some((resize_line.clone(), height, e.client_y() as f64)),
                                                            );
                                                        if let Some(p) = paper.get() {
                                                            let _ = p.set_pointer_capture(e.pointer_id());
                                                        }
                                                    }
                                                }
                                            >
                                                <input
                                                    aria-label="Section height"
                                                    type="number"
                                                    min="0.05"
                                                    step="0.05"
                                                    value=number(&band, "height")
                                                    on:change=move |e| {
                                                        s.band.set(resize.clone());
                                                        if let Ok(height) = event_target_value(&e).parse::<f64>() {
                                                            s.patch_band("height", json!(height.max(0.05)));
                                                        }
                                                    }
                                                />
                                            </div>
                                        </section>
                                    }
                                })
                                .collect_view()
                        }}
                    </div>
                </div>
            </div>
            <rulers::fixed_rulers::FixedRulers paper canvas frame scroll_position />
        </div>
    }
}
