use super::fields::*;
use crate::{domain::*, shared::controls::Button, state::studio};
use leptos::prelude::*;
use serde_json::{json, Value};
fn patch(value: Value, draft: bool) {
    let s = studio();
    if draft {
        let mut chart: Value = serde_json::from_str(&s.draft.get_untracked()).unwrap_or_default();
        for (k, v) in value.as_object().into_iter().flatten() {
            if v.is_null() {
                if let Some(map) = chart.as_object_mut() {
                    map.remove(k);
                }
            } else {
                chart[k] = v.clone();
            }
        }
        s.draft.set(chart.to_string());
    } else {
        s.command("chart-settings", value);
    }
}
#[component]
pub fn ChartProperties(chart: Value) -> impl IntoView {
    let s = studio();
    let copy = chart.clone();
    view! {
        <ChartFields chart=chart.clone() />
        <CategoryColors chart />
        <Button
            label="Edit chart details"
            primary=true
            // The editor snapshots the chart. Wait until pending property edits
            // have been committed so that it cannot reopen an older snapshot.
            disabled=Signal::derive(move || s.busy.get())
            on_press=move |_| {
                let chart = s
                    .selected_element()
                    .map(|e| e["chart"].clone())
                    .unwrap_or_else(|| copy.clone());
                s.show_json("Chart", chart);
            }
        />
    }
    .into_any()
}
#[component]
pub fn ChartFields(chart: Value, #[prop(optional)] detailed: bool) -> impl IntoView {
    let sources = array(&studio().project.get()["datasets"]);
    let source = sources
        .iter()
        .find(|d| d["id"] == chart["dataset"])
        .cloned()
        .unwrap_or_default();
    let fields = array(&source["schema"]["fields"]);
    let mut categories = vec![(String::new(), studio().t("Select a field"))];
    categories.extend(fields.iter().map(|f| (text(f, "name"), text(f, "name"))));
    let mut values = vec![(String::new(), studio().t("Select a field"))];
    values.extend(
        fields
            .iter()
            .filter(|f| f["type"] == "number")
            .map(|f| (text(f, "name"), text(f, "name"))),
    );
    view! {
        <div class="chart-fields">
            <TextField
                label="Chart title"
                value=text(&chart, "title")
                on_change=move |v: String| patch(json!({"title":v}), detailed)
            />
            <SelectField
                label="Chart type"
                value=text(&chart, "kind")
                options=options(
                    &[
                        ("column", "Columns"),
                        ("bar", "Bars"),
                        ("line", "Lines"),
                        ("area", "Area"),
                        ("pie", "Pie"),
                        ("donut", "Donut"),
                    ],
                )
                on_change=move |v: String| patch(json!({"kind":v}), detailed)
            />
            <SelectField
                label="Chart table"
                value=text(&chart, "dataset")
                options=sources.iter().map(|d| (text(d, "id"), text(d, "name"))).collect()
                on_change=move |id: String| {
                    let source = array(&studio().project.get_untracked()["datasets"])
                        .into_iter()
                        .find(|d| d["id"] == id)
                        .unwrap_or_default();
                    let fields = array(&source["schema"]["fields"]);
                    let category = fields
                        .iter()
                        .find(|f| f["type"] != "number")
                        .or(fields.first())
                        .map(|f| text(f, "name"))
                        .unwrap_or_default();
                    let value = fields
                        .iter()
                        .find(|f| {
                            let name = text(f, "name");
                            f["type"] == "number" && name != "id" && !name.ends_with("Id") && !name.ends_with("_id")
                        })
                        .or_else(|| fields.iter().find(|f| f["type"] == "number"))
                        .map(|f| text(f, "name"))
                        .unwrap_or_default();
                    patch(json!({"dataset":id,"category":category,"value":value}), detailed);
                }
            />
            <SelectField
                label="Category field"
                value=text(&chart, "category")
                options=categories
                on_change=move |v: String| patch(json!({"category":v}), detailed)
            />
            <SelectField
                label="Value field"
                value=text(&chart, "value")
                options=values
                on_change=move |v: String| patch(json!({"value":v}), detailed)
            />
            <SelectField
                label="Aggregation"
                value=text(&chart, "aggregation")
                options=options(
                    &[
                        ("sum", "Sum"),
                        ("average", "Average"),
                        ("count", "Count"),
                        ("min", "Minimum"),
                        ("max", "Maximum"),
                    ],
                )
                on_change=move |v: String| patch(json!({"aggregation":v}), detailed)
            />
            <ColorField
                plain=true
                label="Chart color"
                value=text(&chart, "color")
                on_change=move |v: String| patch(json!({"color":v}), detailed)
            />
            <CheckField
                label="Show values"
                checked=chart["showLabels"] == true
                on_change=move |v: bool| patch(json!({"showLabels":v}), detailed)
            />
            {detailed
                .then(|| {
                    view! {
                        <ColorField
                            plain=true
                            label="Chart background"
                            value=text(&chart, "background")
                            on_change=move |v: String| patch(json!({"background":v}), true)
                        />
                        <MetricField
                            label="Maximum categories"
                            value=chart["limit"].as_f64().unwrap_or(20.0)
                            min=1.0
                            max=200.0
                            step=1.0
                            on_change=move |v: f64| patch(json!({"limit":v.round()}), true)
                        />
                        <SelectField
                            label="Chart order"
                            value=text(&chart, "sort")
                            options=options(
                                &[
                                    ("source", "Source order"),
                                    ("ascending", "Ascending"),
                                    ("descending", "Descending"),
                                ],
                            )
                            on_change=move |v: String| patch(json!({"sort":v}), true)
                        />
                        <CheckField
                            label="Show legend"
                            checked=chart["showLegend"] == true
                            on_change=move |v: bool| patch(json!({"showLegend":v}), true)
                        />
                        <CheckField
                            label="Show grid"
                            checked=chart["showGrid"] == true
                            on_change=move |v: bool| patch(json!({"showGrid":v}), true)
                        />
                    }
                })}
        </div>
    }
    .into_any()
}
#[component]
pub fn CategoryColors(chart: Value, #[prop(optional)] detailed: bool) -> impl IntoView {
    let s = studio();
    let points = RwSignal::new(Vec::<Value>::new());
    #[cfg(feature = "csr")]
    {
        let fallback = chart.clone();
        let revision = RwSignal::new(0_u64);
        Effect::new(move |_| {
            let project = s.project.get();
            let settings = if detailed {
                serde_json::from_str::<Value>(&s.draft.get()).unwrap_or_else(|_| fallback.clone())
            } else {
                s.selected_element().map(|element| element["chart"].clone()).unwrap_or_else(|| fallback.clone())
            };
            let version = revision.get_untracked().wrapping_add(1);
            revision.set(version);
            let request = json!({"action":"chart-points","project":project,"args":{"chart":settings}});
            leptos::task::spawn_local(async move {
                if let Ok(result) = crate::platform::call(request).await {
                    if revision.try_get_untracked() == Some(version) {
                        points.try_set(array(&result["points"]));
                    }
                }
            });
        });
    }
    let custom = chart["categoryColors"].clone();
    view! {
        <section class="chart-category-colors">
            <div class="chart-colors-heading">
                <h4>{s.t("Colors by category")}</h4>
                <Button
                    label="Reset category colors"
                    disabled=Signal::derive({
                        let custom = custom.clone();
                        move || custom.as_object().is_none_or(|m| m.is_empty())
                    })
                    on_press=move |_| patch(json!({"categoryColors":Value::Null}), detailed)
                />
            </div>
            {move || {
                points
                    .get()
                    .into_iter()
                    .map(|point| {
                        let key = text(&point, "label");
                        let label = if key.is_empty() {
                            s.t("Empty category")
                        } else {
                            key.clone()
                        };
                        let reset = key.clone();
                        let colors = custom.clone();
                        let reset_colors = custom.clone();
                        let disabled = custom.get(&key).is_none();
                        view! {
                            <div class="chart-category-color">
                                <label>
                                    <span>{label.clone()}</span>
                                    <small>{number(&point, "value")}</small>
                                    <input
                                        type="color"
                                        aria-label=s.t("Color for {0}").replace("{0}", &label)
                                        value=text(&point, "color")
                                        on:change=move |e| {
                                            let mut colors = colors.clone();
                                            if !colors.is_object() {
                                                colors = json!({});
                                            }
                                            colors[&key] = json!(event_target_value(&e));
                                            patch(json!({"categoryColors":colors}), detailed);
                                        }
                                    />
                                </label>
                                <Button
                                    label="Reset color"
                                    icon="undo"
                                    compact=true
                                    disabled=Signal::derive(move || disabled)
                                    on_press=move |_| {
                                        let mut colors = reset_colors.clone();
                                        if let Some(m) = colors.as_object_mut() {
                                            m.remove(&reset);
                                        }
                                        patch(json!({"categoryColors":colors}), detailed);
                                    }
                                />
                            </div>
                        }
                    })
                    .collect_view()
            }}
        </section>
    }
    .into_any()
}
