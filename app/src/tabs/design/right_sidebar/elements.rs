use super::{fields::*, selected_band};
use crate::{domain::*, shared::controls::Button, state::studio};
use leptos::prelude::*;
use serde_json::{json, Value};
#[component]
pub fn ElementProperties(element: Value) -> impl IntoView {
    let s = studio();
    let kind = match text(&element, "type").as_str() {
        "text" => "text",
        "image" => "image",
        "chart" => "chart",
        "shape" => "shape",
        "box" => "box",
        _ => "line",
    };
    let style = element["style"].clone();
    let is_shape = kind == "shape" || kind == "box";
    let e = element.clone();
    let page = s.project.get()["report"]["page"].clone();
    let maximum_width = number(&page, "width")
        - number(&page["margins"], "left")
        - number(&page["margins"], "right");
    view! {
        <InspectorSection title=match kind {
            "text" => "Content",
            "image" => "Image",
            "chart" => "Chart",
            "shape" | "box" => "Shape",
            _ => "Element",
        }>
            {match kind {
                "text" => {
                    view! {
                        <TextField
                            label="Text or expression"
                            value=text(&e, "text")
                            multiline=true
                            on_change=move |v: String| s.command("cell-text", json!({"text":v}))
                        />
                        <p class="helper">
                            {s
                                .t(
                                    "Fields: [name] · Formula: [=quantity * unitPrice] · Total: [SUM(quantity * unitPrice)]",
                                )}
                        </p>
                    }
                        .into_any()
                }
                "shape" | "box" => {
                    view! {
                        <SelectField
                            label="Shape type"
                            value=if e["shape"].is_string() {
                                text(&e, "shape")
                            } else {
                                "rectangle".into()
                            }
                            options=options(
                                &[
                                    ("circle", "Circle"),
                                    ("triangle", "Triangle"),
                                    ("diamond", "Diamond"),
                                    ("rectangle", "Rectangle"),
                                ],
                            )
                            on_change=move |v: String| {
                                s.command("element-settings", json!({"type":"shape","shape":v}))
                            }
                        />
                    }
                        .into_any()
                }
                "image" => {
                    view! {
                        <div class="image-upload">
                            <Button
                                class="image-upload-trigger"
                                label=if text(&e, "src").is_empty() {
                                    "Choose image"
                                } else {
                                    "Change image"
                                }
                                icon="upload"
                                on_press=move |_| s.command("change-image", Value::Null)
                            />
                            <small>{s.t("PNG or JPEG · Up to 2 MB")}</small>
                        </div>
                    }
                        .into_any()
                }
                "chart" => {
                    view! { <super::charts::ChartProperties chart=e["chart"].clone() /> }.into_any()
                }
                _ => ().into_any(),
            }}
        </InspectorSection>
        <InspectorSection title="Position and size" hint="inches">
            <div class="field-grid">
                {[("X", "x"), ("Y", "y"), ("Width", "width"), ("Height", "height")]
                    .into_iter()
                    .map(|(label, key)| {
                        view! {
                            <MetricField
                                label
                                value=s.selected_metric(key)
                                max=match key {
                                    "x" => (maximum_width - s.selected_metric("width")).max(0.0),
                                    "width" => (maximum_width - s.selected_metric("x")).max(0.1),
                                    _ => 30.0,
                                }
                                min=if key == "width" {
                                    0.1
                                } else if key == "height" {
                                    0.01
                                } else {
                                    0.0
                                }
                                on_change=move |v: f64| s.patch_element(key, json!(v))
                            />
                        }
                    })
                    .collect_view()}
            </div>
        </InspectorSection>
        {(kind != "chart")
            .then(|| {
                view! {
                    <InspectorSection title=if kind == "text" {
                        "Typography"
                    } else {
                        "Appearance"
                    }>
                        {(kind == "text")
                            .then(|| {
                                view! {
                                    <FontField
                                        value=text(&style, "fontFamily")
                                        on_change=move |v: String| {
                                            s.command(
                                                "style",
                                                json!(
                                                    {"fontFamily":if v.is_empty(){Value::Null}else{json!(v)}}
                                                ),
                                            )
                                        }
                                    />
                                    <div class="field-grid">
                                        <MetricField
                                            label="Size (pt)"
                                            value=number(&style, "fontsize")
                                            min=5.0
                                            max=96.0
                                            step=1.0
                                            on_change=move |v: f64| {
                                                s.command("style", json!({"fontsize":v}))
                                            }
                                        />
                                        <SelectField
                                            label="Alignment"
                                            value=text(&style, "align")
                                            options=options(
                                                &[
                                                    ("left", "Left"),
                                                    ("center", "Center"),
                                                    ("right", "Right"),
                                                ],
                                            )
                                            on_change=move |v: String| {
                                                s.command("style", json!({"align":v}))
                                            }
                                        />
                                    </div>
                                    <div class="toggle-row">
                                        <Button
                                            label="Bold"
                                            active=Signal::derive(move || {
                                                s.selected_element()
                                                    .is_some_and(|e| e["style"]["bold"] == true)
                                            })
                                            on_press=move |_| {
                                                s.command(
                                                    "style",
                                                    json!(
                                                        {"bold":!s.selected_element().is_some_and(|e|e["style"]["bold"]==true)}
                                                    ),
                                                )
                                            }
                                        />
                                        <Button
                                            label="Italic"
                                            active=Signal::derive(move || {
                                                s.selected_element()
                                                    .is_some_and(|e| e["style"]["italic"] == true)
                                            })
                                            on_press=move |_| {
                                                s.command(
                                                    "style",
                                                    json!(
                                                        {"italic":!s.selected_element().is_some_and(|e|e["style"]["italic"]==true)}
                                                    ),
                                                )
                                            }
                                        />
                                        <CheckField
                                            label="Wrap text"
                                            checked=style["wrap"] != false
                                            on_change=move |v: bool| {
                                                s.command("style", json!({"wrap":v}))
                                            }
                                        />
                                    </div>
                                    <SelectField
                                        label="Value format"
                                        value=text(&style, "format")
                                        options=options(
                                            &[
                                                ("text", "Text"),
                                                ("number", "Number"),
                                                ("currency", "Currency"),
                                            ],
                                        )
                                        on_change=move |v: String| {
                                            s.command("style", json!({"format":v}))
                                        }
                                    />
                                }
                            })}
                        <ColorField
                            label=if is_shape { "Fill" } else { "Color" }
                            value=text(&style, "color")
                            on_change=move |v: String| s.command("style", json!({"color":v}))
                        />
                    </InspectorSection>
                }
            })}
        {is_shape
            .then(|| {
                view! {
                    <InspectorSection title="Border">
                        <ColorField
                            show_code=false
                            label="Border color"
                            value=text(&element, "borderColor")
                            on_change=move |v: String| s.patch_element("borderColor", json!(v))
                        />
                        <MetricField
                            label="Border width (pt)"
                            value=element["borderWidth"].as_f64().unwrap_or(1.0)
                            max=12.0
                            on_change=move |v: f64| s.patch_element("borderWidth", json!(v))
                        />
                    </InspectorSection>
                    <LayerOrder />
                }
            })}
        <section class="inspector-section element-actions">
            <Button
                label="Duplicate"
                icon="copy"
                on_press=move |_| s.command("duplicate", Value::Null)
            />
            <Button
                label="Delete"
                icon="trash"
                on_press=move |_| s.command("delete", Value::Null)
            />
        </section>
    }.into_any()
}
#[component]
fn LayerOrder() -> impl IntoView {
    let s = studio();
    let band = selected_band();
    let elements = array(&band["elements"]);
    let index = elements
        .iter()
        .position(|e| s.selected.get().contains(&text(e, "id")))
        .unwrap_or(0);
    let count = elements.len();
    view! {
        <InspectorSection title="Layer order">
            <div class="element-order-controls">
                {[
                    ("Bring to front", "front", "bring-front"),
                    ("Bring forward", "forward", "layer-up"),
                    ("Send backward", "backward", "layer-down"),
                    ("Send to back", "back", "send-back"),
                ]
                    .into_iter()
                    .map(|(label, position, icon)| {
                        view! {
                            <Button
                                label
                                icon
                                disabled=Signal::derive(move || {
                                    if position == "front" || position == "forward" {
                                        index + 1 >= count
                                    } else {
                                        index == 0
                                    }
                                })
                                on_press=move |_| s.command("layer", json!({"position":position}))
                            />
                        }
                    })
                    .collect_view()}
            </div>
            <p class="helper">
                {s.t("Layer order applies within this section and is saved with the report.")}
            </p>
        </InspectorSection>
    }
    .into_any()
}
