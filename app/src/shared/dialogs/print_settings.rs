use crate::{domain::number, state::studio};
use leptos::prelude::*;
use serde_json::{json, Value};

const MM_PER_INCH: f64 = 25.4;

pub fn paper_dimensions(preset: &str) -> Option<(f64, f64)> {
    match preset {
        "A4" => Some((210.0 / MM_PER_INCH, 297.0 / MM_PER_INCH)),
        "Letter" => Some((8.5, 11.0)),
        "Legal" => Some((8.5, 14.0)),
        _ => None,
    }
}

pub fn page_preset(page: &Value) -> &'static str {
    let width = number(page, "width");
    let height = number(page, "height");
    for name in ["A4", "Letter", "Legal"] {
        let (w, h) = paper_dimensions(name).unwrap();
        if ((width - w).abs() < 0.001 && (height - h).abs() < 0.001)
            || ((width - h).abs() < 0.001 && (height - w).abs() < 0.001)
        {
            return name;
        }
    }
    "Custom"
}

pub fn valid(page: &Value) -> bool {
    let Some(width) = page["width"].as_f64() else {
        return false;
    };
    let Some(height) = page["height"].as_f64() else {
        return false;
    };
    let margins = &page["margins"];
    let (Some(top), Some(bottom), Some(left), Some(right)) = (
        margins["top"].as_f64(),
        margins["bottom"].as_f64(),
        margins["left"].as_f64(),
        margins["right"].as_f64(),
    ) else {
        return false;
    };
    (3.0..=30.0).contains(&width)
        && (3.0..=40.0).contains(&height)
        && [top, bottom, left, right]
            .iter()
            .all(|v| (0.0..=10.0).contains(v))
        && width - left - right >= 0.5
        && height - top - bottom >= 0.5
}

fn draft() -> Value {
    serde_json::from_str(&studio().draft.get()).unwrap_or_default()
}
fn set_page(page: Value) {
    studio().draft.set(page.to_string());
    studio().message.set(String::new());
}
fn mm(value: f64) -> String {
    let rounded = (value * MM_PER_INCH * 100.0).round() / 100.0;
    rounded.to_string()
}

#[component]
fn Dimension(label: &'static str, key: &'static str, margin: bool) -> impl IntoView {
    let s = studio();
    view! {
        <label class="property">
            <span>{move || s.t(label)}</span>
            <input type="number" step="0.1" min="0" aria-label=move || s.t(label)
                prop:value=move || {
                    let page = draft();
                    let value = if margin { page["margins"][key].as_f64() } else { page[key].as_f64() };
                    value.map(mm).unwrap_or_default()
                }
                on:change=move |event| {
                    let value = event_target_value(&event).parse::<f64>().ok().filter(|v| v.is_finite()).map(|v| json!(v / MM_PER_INCH)).unwrap_or(Value::Null);
                    let mut page = draft();
                    if margin { page["margins"][key] = value; } else { page[key] = value; }
                    set_page(page);
                }
            />
        </label>
    }
}

#[component]
pub fn PrintSettings() -> impl IntoView {
    let s = studio();
    view! {
        <div class="print-settings">
            <div class="print-settings-grid">
                <label class="property">
                    <span>{move || s.t("Paper size")}</span>
                    <select aria-label=move || s.t("Paper size") prop:value=move || page_preset(&draft()).to_string()
                        on:change=move |event| {
                            let preset = event_target_value(&event);
                            if let Some((w, h)) = paper_dimensions(&preset) {
                                let mut page = draft();
                                let landscape = number(&page, "width") > number(&page, "height");
                                page["width"] = json!(if landscape { h } else { w });
                                page["height"] = json!(if landscape { w } else { h });
                                set_page(page);
                            }
                        }>
                        <option value="A4">"A4 (210 × 297 mm)"</option>
                        <option value="Letter">{move || format!("{} (216 × 279 mm)", s.t("Letter"))}</option>
                        <option value="Legal">{move || format!("{} (216 × 356 mm)", s.t("Legal"))}</option>
                        <option value="Custom">{move || s.t("Custom")}</option>
                    </select>
                </label>
                <label class="property">
                    <span>{move || s.t("Orientation")}</span>
                    <select aria-label=move || s.t("Orientation")
                        prop:value=move || { if number(&draft(), "width") > number(&draft(), "height") { "landscape" } else { "portrait" } }
                        on:change=move |event| {
                            let landscape = event_target_value(&event) == "landscape";
                            let mut page = draft();
                            let width = number(&page, "width");
                            let height = number(&page, "height");
                            if (landscape && width < height) || (!landscape && width > height) {
                                page["width"] = json!(height); page["height"] = json!(width); set_page(page);
                            }
                        }>
                        <option value="portrait">{move || s.t("Portrait")}</option>
                        <option value="landscape">{move || s.t("Landscape")}</option>
                    </select>
                </label>
                <Dimension label="Width (mm)" key="width" margin=false />
                <Dimension label="Height (mm)" key="height" margin=false />
            </div>
            <h3>{move || s.t("Margins (mm)")}</h3>
            <p class="print-settings-hint">{move || s.t("Content outside the printable area will be clipped.")}</p>
            <div class="print-settings-grid">
                <Dimension label="Top margin (mm)" key="top" margin=true />
                <Dimension label="Bottom margin (mm)" key="bottom" margin=true />
                <Dimension label="Left margin (mm)" key="left" margin=true />
                <Dimension label="Right margin (mm)" key="right" margin=true />
            </div>
        </div>
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn validates_page_and_each_margin() {
        let mut page = json!({"width":8.5,"height":11.0,"margins":{"top":0.5,"bottom":0.5,"left":0.5,"right":0.5}});
        assert!(valid(&page));
        assert_eq!(page_preset(&page), "Letter");
        page["margins"]["left"] = json!(8.1);
        assert!(!valid(&page));
        page["margins"]["left"] = Value::Null;
        assert!(!valid(&page));
    }
}
