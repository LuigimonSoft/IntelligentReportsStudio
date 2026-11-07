use super::fields::*;
use crate::{domain::*, shared::controls::Button, state::studio};
use leptos::prelude::*;
use serde_json::{json, Value};
fn fields(kind: &str) -> Vec<(String, String)> {
    let s = studio();
    array(&s.project.get()["datasets"])
        .iter()
        .flat_map(|d| {
            array(&d["schema"]["fields"])
                .into_iter()
                .filter(|f| f["type"] == kind)
                .map(|f| {
                    (
                        format!("{}.{}", text(d, "id"), text(&f, "name")),
                        format!("{} · {}", text(d, "name"), text(&f, "name")),
                    )
                })
                .collect::<Vec<_>>()
        })
        .collect()
}
#[component]
pub fn SectionProperties(band: Value) -> impl IntoView {
    let s = studio();
    let report = s.project.get()["report"].clone();
    let b = band.clone();
    let name_band_id = text(&band, "id");
    let page = report["page"].clone();
    let detail = array(&report["details"]).into_iter().find(|d| {
        ["band", "groupHeader", "groupFooter"]
            .iter()
            .any(|k| d[k]["id"] == band["id"])
    });
    let choices = array(&s.project.get()["datasets"]);
    let unit = s.measurement_scale();
    view! {
        <InspectorSection title="Selected section">
            <TextField
                label="Section name"
                value=text(&band, "name")
                on_change=move |v: String| s.patch_band_by_id(&name_band_id, "name", json!(v))
            />
            <MetricField
                label=if unit == 1.0 { "Section height (inches)" } else { "Section height (cm)" }
                value=number(&band, "height") * unit
                min=0.1
                max=25.4
                on_change=move |v: f64| s.patch_band("height", json!(v/unit))
            />
            {detail
                .map(|detail| {
                    let mut source_options = vec![(String::new(), s.t("No data source"))];
                    source_options.extend(choices.iter().map(|d| (text(d, "id"), text(d, "name"))));
                    let dataset = text(&detail, "dataset");
                    let mut grouping = vec![(String::new(), s.t("No grouping"))];
                    if let Some(ds) = choices.iter().find(|d| d["id"] == dataset) {
                        grouping
                            .extend(
                                array(&ds["schema"]["fields"])
                                    .iter()
                                    .map(|f| (text(f, "name"), text(f, "name"))),
                            );
                    }
                    let id = text(&detail, "id");
                    let group_id = id.clone();
                    view! {
                        <SelectField
                            label="Data source"
                            value=dataset
                            options=source_options
                            on_change=move |v: String| {
                                s.command("detail-settings", json!({"id":id,"dataset":v}))
                            }
                        />
                        <SelectField
                            label="Group by"
                            value=text(&detail, "groupBy")
                            options=grouping
                            on_change=move |v: String| {
                                s.command("detail-settings", json!({"id":group_id,"groupBy":v}))
                            }
                        />
                    }
                })}
        </InspectorSection>
        <SectionAppearance band=b />
        <InspectorSection title="Report">
            <TextField
                label="Name"
                value=text(&report, "title")
                on_change=move |v: String| s.command("report-settings", json!({"title":v}))
            />
            <SelectField
                label="Currency"
                value=text(&report, "currency")
                options=options(&[("USD", "USD"), ("CAD", "CAD"), ("EUR", "EUR"), ("MXN", "MXN")])
                on_change=move |v: String| s.command("report-settings", json!({"currency":v}))
            />
            <SelectField
                label="Regional format"
                value=text(&report, "locale")
                options=options(
                    &[
                        ("es-MX", "Spanish · Mexico"),
                        ("es-ES", "Spanish · Spain"),
                        ("fr-FR", "French · France"),
                        ("en-US", "English · US"),
                    ],
                )
                on_change=move |v: String| s.command("report-settings", json!({"locale":v}))
            />
        </InspectorSection>
        <InspectorSection title="Page">
            <SelectField
                label="Paper"
                value=if (number(&page, "width") - 8.5).abs() < 0.01 {
                    "letter".into()
                } else {
                    "a4".into()
                }
                options=options(
                    &[("letter", "Letter · 8.5 × 11″"), ("a4", "A4 · 210 × 297 mm")],
                )
                on_change=move |v: String| s.command("page-settings", json!({"paper":v}))
            />
            <MetricField
                label="Uniform margins"
                value=number(&page["margins"], "left")
                max=2.0
                on_change=move |v: f64| s.command("page-settings", json!({"margin":v}))
            />
        </InspectorSection>
        <p class="inspector-hint">
            {s.t("Select an element on the page to edit its content and position.")}
        </p>
    }
    .into_any()
}
#[component]
fn SectionAppearance(band: Value) -> impl IntoView {
    let s = studio();
    let booleans = fields("boolean");
    let colors = fields("text");
    let visibility = text(&band, "visibilityExpression");
    let background = text(&band, "backgroundExpression");
    let visibility_mode = if visibility.is_empty() {
        "fixed"
    } else if booleans.iter().any(|(v, _)| v == &visibility) {
        "field"
    } else {
        "formula"
    };
    let bg_mode = if !background.is_empty() {
        if colors.iter().any(|(v, _)| v == &background) {
            "field"
        } else {
            "formula"
        }
    } else if text(&band, "background").is_empty() {
        "none"
    } else {
        "fixed"
    };
    let first_bool = booleans
        .first()
        .map(|v| v.0.clone())
        .unwrap_or_else(|| "true".into());
    let first_color = colors
        .first()
        .map(|v| v.0.clone())
        .unwrap_or_else(|| "'#ffffff'".into());
    view! {
        <InspectorSection title="Visibility and background">
            <CheckField
                label="Section visible"
                checked=band["visible"] != false
                on_change=move |v: bool| s.patch_band("visible", json!(v))
            />
            <SelectField
                label="Visibility based on"
                value=visibility_mode.into()
                options=options(
                    &[("fixed", "Fixed value"), ("field", "Boolean field"), ("formula", "Formula")],
                )
                on_change=move |v: String| {
                    s.patch_band(
                        "visibilityExpression",
                        if v == "fixed" {
                            Value::Null
                        } else if v == "field" {
                            json!(first_bool)
                        } else {
                            json!("true")
                        },
                    )
                }
            />
            {if visibility_mode == "field" {
                view! {
                    <SelectField
                        label="Visibility field"
                        value=visibility
                        options=booleans
                        on_change=move |v: String| s.patch_band("visibilityExpression", json!(v))
                    />
                }
                    .into_any()
            } else if visibility_mode == "formula" {
                view! {
                    <TextField
                        label="Visibility formula"
                        value=visibility
                        multiline=true
                        on_change=move |v: String| s.patch_band("visibilityExpression", json!(v))
                    />
                }
                    .into_any()
            } else {
                ().into_any()
            }}
            <p class="helper">
                {s
                    .t(
                        "The condition must return true or false. A hidden section also hides its subsections.",
                    )}
            </p>
            <SelectField
                label="Background based on"
                value=bg_mode.into()
                options=options(
                    &[
                        ("none", "No background"),
                        ("fixed", "Fixed value"),
                        ("field", "Color field"),
                        ("formula", "Formula"),
                    ],
                )
                on_change=move |v: String| {
                    s.mutate(|p| {
                        if let Some(b) = band_mut(&mut p["report"], &s.band.get_untracked()) {
                            b["backgroundExpression"] = match v.as_str() {
                                "field" => json!(first_color),
                                "formula" => json!("IF(true, '#ffffff', '#e8f2ff')"),
                                _ => Value::Null,
                            };
                            if v == "none" {
                                b["background"] = Value::Null;
                            } else if v == "fixed" && b["background"].is_null() {
                                b["background"] = json!("#ffffff");
                            }
                            for key in ["background", "backgroundExpression"] {
                                if b[key].is_null() {
                                    b.as_object_mut().unwrap().remove(key);
                                }
                            }
                        }
                    });
                }
            />
            <div class="color-control section-background-control">
                <input
                    type="color"
                    aria-label=s.t("Section background color")
                    value=band["background"].as_str().unwrap_or("#ffffff").to_owned()
                    disabled=bg_mode != "fixed"
                    on:change=move |e| s.patch_band("background", json!(event_target_value(&e)))
                />
                <span>
                    {band["background"]
                        .as_str()
                        .map(str::to_owned)
                        .unwrap_or_else(|| s.t("No background"))}
                </span>
                <Button
                    class="text-button"
                    label="Remove background"
                    on_press=move |_| {
                        s.patch_band("background", Value::Null);
                        s.patch_band("backgroundExpression", Value::Null);
                    }
                />
            </div>
            {if bg_mode == "field" {
                view! {
                    <SelectField
                        label="Background field"
                        value=background
                        options=colors
                        on_change=move |v: String| s.patch_band("backgroundExpression", json!(v))
                    />
                }
                    .into_any()
            } else if bg_mode == "formula" {
                view! {
                    <TextField
                        label="Background formula"
                        value=background
                        multiline=true
                        on_change=move |v: String| s.patch_band("backgroundExpression", json!(v))
                    />
                }
                    .into_any()
            } else {
                ().into_any()
            }}
            <p class="helper">
                {s
                    .t(
                        "The calculated background must return a #RRGGBB color. Example: IF(quantity > 10, '#e8f2ff', '#ffffff').",
                    )}
            </p>
            <Button
                label="Add subsection"
                icon="plus"
                on_press=move |_| {
                    let id = s.band.get_untracked();
                    let parent = bands(&s.project.get_untracked()["report"]).into_iter().find(|b| text(b,"id") == id);
                    let name = parent.map(|b| s.t(&text(&b,"name"))).unwrap_or_default();
                    s.command("add-subsection", json!({"band":id,"parentName":name}));
                }
            />
        </InspectorSection>
    }.into_any()
}
