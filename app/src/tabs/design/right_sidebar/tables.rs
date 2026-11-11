use super::fields::*;
use crate::{domain::*, shared::controls::Button, state::studio};
use leptos::prelude::*;
use serde_json::{json, Value};
fn measure_label(kind: &str, scale: f64) -> &'static str {
    match (kind, scale) {
        ("width", 25.4) => "Table width (mm)",
        ("width", 72.0) => "Table width (pt)",
        ("width", 1.0) => "Table width (inches)",
        ("width", _) => "Table width (cm)",
        ("row", 25.4) => "Row height (mm)",
        ("row", 72.0) => "Row height (pt)",
        ("row", 1.0) => "Row height (inches)",
        ("row", _) => "Row height (cm)",
        ("column", 25.4) => "Column width (mm)",
        ("column", 72.0) => "Column width (pt)",
        ("column", 1.0) => "Column width (inches)",
        ("column", _) => "Column width (cm)",
        (_, 25.4) => "Selected row height (mm)",
        (_, 72.0) => "Selected row height (pt)",
        (_, 1.0) => "Selected row height (inches)",
        _ => "Selected row height (cm)",
    }
}
fn current() -> Value {
    studio().selected_element().unwrap_or_default()
}
fn settings(patch: Value) {
    studio().command("table-settings", patch);
}
fn style(patch: Value) {
    let s = studio();
    s.command(
        "table-style",
        json!({"scope":s.scope.get_untracked(),"style":patch}),
    );
}
fn select(scope: String, row: usize, column: usize) {
    let s = studio();
    let group = current()["groupId"].clone();
    let selected = bands(&s.project.get()["report"])
        .iter()
        .flat_map(|b| array(&b["elements"]))
        .find(|e| {
            e["groupId"] == group
                && e["type"] == "text"
                && e["cell"]["row"] == row
                && e["cell"]["column"] == column
        });
    s.scope.set(scope);
    if let Some(e) = selected {
        s.selected.set(vec![text(&e, "id")]);
    }
}
fn appearance(element: &Value) -> Value {
    let row = element["cell"]["row"].as_u64().unwrap_or(0);
    let col = element["cell"]["column"].as_u64().unwrap_or(0);
    let table = &element["table"];
    let header = table["headers"] == true && row == 0;
    let mut result = json!({"background":if header{"#e9eef5"}else{"#ffffff"},"color":"#243c34","align":"left","borderColor":"#cbd5e1","borderWidth":0.5,"bold":header,"italic":false,"fontsize":10,"format":"text"});
    if element["style"]["format"].is_string() {
        result["format"] = element["style"]["format"].clone();
    }
    for key in [
        "table".into(),
        format!("column:{col}"),
        format!("row:{row}"),
        format!("cell:{row}:{col}"),
    ] {
        if let Some(style) = table["styles"][key].as_object() {
            for (k, v) in style {
                result[k] = v.clone();
            }
        }
    }
    result
}
#[component]
pub fn TableProperties(element: Value) -> impl IntoView {
    let s = studio();
    let table = element["table"].clone();
    let row = element["cell"]["row"].as_u64().unwrap_or(0) as usize;
    let col = element["cell"]["column"].as_u64().unwrap_or(0) as usize;
    let scope = s.scope.get();
    let a = appearance(&element);
    let unit = s.measurement_scale();
    let rows = number(&table, "rows") as usize;
    let columns = number(&table, "columns") as usize;
    let page = s.project.get()["report"]["page"].clone();
    let maximum_width = number(&page, "width")
        - number(&page["margins"], "left")
        - number(&page["margins"], "right");
    let column_width = table["columnWidths"][col]
        .as_f64()
        .unwrap_or(number(&table, "width") / columns.max(1) as f64);
    let source = array(&s.project.get()["datasets"])
        .into_iter()
        .find(|d| d["id"] == table["dataset"])
        .unwrap_or_default();
    // Empty-state messages belong to the repeating detail section, so every
    // table in that section shares the same behavior when its source is empty.
    let empty_detail = array(&s.project.get()["report"]["details"])
        .into_iter()
        .find(|detail| !text(detail, "dataset").is_empty()
            && array(&detail["band"]["elements"]).iter().any(|item| item["id"] == element["id"]));
    let content = table["contents"][format!("{row}:{col}")]
        .as_str()
        .unwrap_or_else(|| element["text"].as_str().unwrap_or(""))
        .to_owned();
    view! {
        <section class="inspector-section table-properties">
            <h3>{s.t("Table editing")}</h3>
            <p class="table-editing-hint">
                {s.t("Double-click to edit. Select columns using letters and rows using numbers.")}
            </p>
            <div class="table-scope-buttons">
                {[("Table", "table"), ("Row", "row"), ("Column", "column"), ("Cell", "cell")]
                    .into_iter()
                    .map(|(label, scope)| {
                        view! {
                            <Button
                                label
                                active=Signal::derive(move || s.scope.get() == scope)
                                on_press=move |_| select(scope.into(), row, col)
                            />
                        }
                    })
                    .collect_view()}
            </div>
            {(scope == "cell")
                .then(|| {
                    view! {
                        <TextField
                            caption="Text or expression"
                            label="Cell content"
                            value=content
                            on_change=move |v: String| s.command("cell-text", json!({"text":v}))
                        />
                        <Button
                            class="text-button table-use-data-field"
                            label="Use data field"
                            on_press=move |_| {
                                s.command(
                                    "table-content",
                                    json!({"operation":"reset","scope":"cell"}),
                                )
                            }
                        />
                    }
                })}
            <Button
                class="clear-table-contents"
                label="Clear selected contents"
                on_press=move |_| {
                    s.command(
                        "table-content",
                        json!({"operation":"clear","scope":s.scope.get_untracked()}),
                    )
                }
            />
            <div class="table-structure-actions">
                {["row", "column"]
                    .into_iter()
                    .map(|axis| {
                        let index = if axis == "row" { row } else { col };
                        let count = if axis == "row" { rows } else { columns };
                        let can_add = if axis == "row" {
                            rows < 20 && (rows + 1) * columns <= 80
                        } else {
                            columns < 12 && (columns + 1) * rows <= 80
                        };
                        view! {
                            <div>
                                <span>
                                    {format!(
                                        "{} {}",
                                        s.t(if axis == "row" { "Row" } else { "Column" }),
                                        index + 1,
                                    )}
                                </span>
                                <Button
                                    label=if axis == "row" { "Insert above" } else { "Insert left" }
                                    disabled=Signal::derive(move || !can_add)
                                    on_press=move |_| {
                                        s.command(
                                            "table-structure",
                                            json!({"axis":axis,"index":index,"operation":"insert"}),
                                        )
                                    }
                                />
                                <Button
                                    label=if axis == "row" {
                                        "Insert below"
                                    } else {
                                        "Insert right"
                                    }
                                    disabled=Signal::derive(move || !can_add)
                                    on_press=move |_| {
                                        s.command(
                                            "table-structure",
                                            json!({"axis":axis,"index":index+1,"operation":"insert"}),
                                        )
                                    }
                                />
                                <Button
                                    label=if axis == "row" { "Delete row" } else { "Delete column" }
                                    disabled=Signal::derive(move || count <= 1)
                                    on_press=move |_| {
                                        s.command(
                                            "table-structure",
                                            json!({"axis":axis,"index":index,"operation":"delete"}),
                                        )
                                    }
                                />
                            </div>
                        }
                    })
                    .collect_view()}
            </div>
        </section>
        <section class="inspector-section table-properties">
            <h3>{s.t("Table properties")}</h3>
            {empty_detail.map(|detail| {
                let id = text(&detail, "id");
                view! {
                    <TextField label="Message when no records" value=text(&detail, "emptyMessage") multiline=true
                        on_change=move |value: String| s.command("detail-settings", json!({"id":id,"emptyMessage":value})) />
                    <p class="helper">{s.t("Leave blank to show no message when the data source is empty.")}</p>
                }
            })}
            <CheckField
                label="Show headers"
                checked=table["headers"] == true
                disabled=table["headers"] != true && (rows >= 20 || (rows + 1) * columns > 80)
                on_change=move |v| settings(json!({"headers":v}))
            />
            <div class="field-grid">
                <MetricField
                    label="Rows"
                    value=rows as f64
                    min=1.0
                    max=20.0_f64.min((80 / columns.max(1)) as f64)
                    step=1.0
                    on_change=move |v: f64| settings(json!({"rows":v.round()}))
                />
                <MetricField
                    label="Columns"
                    value=columns as f64
                    min=1.0
                    max=12.0_f64.min((80 / rows.max(1)) as f64)
                    step=1.0
                    on_change=move |v: f64| settings(json!({"columns":v.round()}))
                />
                <MetricField
                    label=measure_label("width", unit)
                    value=number(&table, "width") * unit
                    min=0.12 * columns as f64 * unit
                    max=maximum_width * unit
                    on_change=move |v: f64| settings(json!({"width":v/unit}))
                />
                <MetricField
                    label=measure_label("row", unit)
                    value=number(&table, "rowHeight") * unit
                    min=0.15 * unit
                    max=unit
                    on_change=move |v: f64| settings(
                        json!({"rowHeight":v/unit,"rowHeights":Value::Null}),
                    )
                />
            </div>
        </section>
        <section class="inspector-section table-properties">
            <h3>{s.t("Table formatting")}</h3>
            <SelectField
                label="Apply to"
                value=scope.clone()
                options=options(
                    &[
                        ("table", "Whole table"),
                        ("column", "Column"),
                        ("row", "Row"),
                        ("cell", "Cell"),
                    ],
                )
                on_change=move |v: String| select(v, row, col)
            />
            <div class="field-grid">
                {(["row", "cell"].contains(&scope.as_str()))
                    .then(|| {
                        view! {
                            <MetricField
                                label="Row"
                                value=(row + 1) as f64
                                min=1.0
                                max=rows as f64
                                step=1.0
                                on_change=move |v: f64| select(
                                    s.scope.get_untracked(),
                                    v as usize - 1,
                                    col,
                                )
                            />
                        }
                    })}
                {(["column", "cell"].contains(&scope.as_str()))
                    .then(|| {
                        view! {
                            <MetricField
                                label="Column"
                                value=(col + 1) as f64
                                min=1.0
                                max=columns as f64
                                step=1.0
                                on_change=move |v: f64| select(
                                    s.scope.get_untracked(),
                                    row,
                                    v as usize - 1,
                                )
                            />
                        }
                    })}
            </div>
            {(["column", "cell"].contains(&scope.as_str()))
                .then(|| {
                    view! {
                        <MetricField
                            label=measure_label("column", unit)
                            value=table["columnWidths"][col]
                                .as_f64()
                                .unwrap_or(number(&table, "width") / columns.max(1) as f64) * unit
                            min=0.12 * unit
                            max=(maximum_width - (number(&table, "width") - column_width)) * unit
                            on_change=move |v: f64| {
                                s.command(
                                    "table-dimension",
                                    json!({"axis":"column","index":col,"value":v/unit}),
                                )
                            }
                        />
                    }
                })}
            {(["row", "cell"].contains(&scope.as_str()))
                .then(|| {
                    view! {
                        <MetricField
                            label=measure_label("selected-row", unit)
                            value=table["rowHeights"][row]
                                .as_f64()
                                .unwrap_or(number(&table, "rowHeight")) * unit
                            min=0.15 * unit
                            max=unit
                            on_change=move |v: f64| {
                                s.command(
                                    "table-dimension",
                                    json!({"axis":"row","index":row,"value":v/unit}),
                                )
                            }
                        />
                    }
                })}
            {(["column", "cell"].contains(&scope.as_str()))
                .then(|| {
                    let mut fields = vec![(String::new(), s.t("Select field…"))];
                    fields
                        .extend(
                            array(&source["schema"]["fields"])
                                .iter()
                                .map(|f| (text(f, "name"), text(f, "name"))),
                        );
                    view! {
                        <SelectField
                            label="Bind data field"
                            value=String::new()
                            options=fields
                            on_change=move |v: String| {
                                if !v.is_empty() {
                                    s.command(
                                        "table-content",
                                        json!(
                                            {"operation":"bind","field":v,"scope":s.scope.get_untracked()}
                                        ),
                                    );
                                }
                            }
                        />
                    }
                })}
            <SelectField label="Vertical alignment" value=if a["verticalAlign"].is_string() { text(&a,"verticalAlign") } else { "top".into() }
                options=options(&[("top", "Top"), ("middle", "Middle"), ("bottom", "Bottom")])
                on_change=move |value: String| style(json!({"verticalAlign":value})) />
            <SelectField
                label="Value format"
                value=text(&a, "format")
                options=options(&[("text", "Text"), ("number", "Number"), ("currency", "Currency"), ("percent", "Percentage"), ("date", "Date")])
                on_change=move |v: String| style(json!({"format":v}))
            />
            <div class="field-grid">
                <CheckField
                    label="Bold"
                    checked=a["bold"] == true
                    on_change=move |v: bool| style(json!({"bold":v}))
                />
                <Button label="Underline"
                    active=Signal::derive(move || s.selected_element().is_some_and(|element| appearance(&element)["underline"] == true))
                    on_press=move |_| {
                        let enabled = s.selected_element().is_some_and(|element| appearance(&element)["underline"] == true);
                        style(json!({"underline":!enabled}));
                    } />
                <CheckField
                    label="Italic"
                    checked=a["italic"] == true
                    on_change=move |v: bool| style(json!({"italic":v}))
                />
            </div>
            <FontField
                value=text(&a, "fontFamily")
                on_change=move |v: String| style(
                    json!({"fontFamily":if v.is_empty(){Value::Null}else{json!(v)}}),
                )
            />
            <MetricField
                label="Text size (pt)"
                value=number(&a, "fontsize")
                min=6.0
                max=48.0
                step=1.0
                on_change=move |v: f64| style(json!({"fontsize":v}))
            />
            <TableBackground expression=text(&a, "backgroundExpression") />
            {[
                ("Background", "background"),
                ("Text color", "color"),
                ("Border color", "borderColor"),
            ]
                .into_iter()
                .map(|(label, key)| {
                    view! {
                        <ColorField
                            label
                            value=text(&a, key)
                            on_change=move |v: String| style(json!({key:v}))
                        />
                    }
                })
                .collect_view()}
            <MetricField
                label="Border width (pt)"
                value=number(&a, "borderWidth")
                max=6.0
                step=0.25
                on_change=move |v: f64| style(json!({"borderWidth":v}))
            />
            <SelectField
                label="Alignment"
                value=text(&a, "align")
                options=options(&[("left", "Left"), ("center", "Center"), ("right", "Right")])
                on_change=move |v: String| style(json!({"align":v}))
            />
            <Button label="All borders" on_press=move |_| style(json!({"borderWidth":0.5})) />
            <Button label="No borders" on_press=move |_| style(json!({"borderWidth":0})) />
        </section>
        <section class="inspector-section element-actions">
            <Button label="Duplicate table" on_press=move |_| s.command("duplicate", Value::Null) />
            <Button label="Delete table" on_press=move |_| s.command("delete", Value::Null) />
        </section>
    }.into_any()
}
#[component]
fn TableBackground(expression: String) -> impl IntoView {
    let s = studio();
    let copy = expression.clone();
    view! {
        <SelectField
            label="Background based on"
            value=if expression.is_empty() { "fixed".into() } else { "formula".into() }
            options=options(&[("fixed", "Fixed color"), ("formula", "Formula")])
            on_change=move |v: String| style(
                json!(
                    {"backgroundExpression":if v=="formula"{"IF(MOD(ROW_NUMBER, 2) = 1, '#e5e7eb', '#ffffff')"}else{""}}
                ),
            )
        />
        {(!expression.is_empty())
            .then(|| {
                view! {
                    <TextField
                        label="Background formula"
                        value=expression
                        multiline=true
                        on_change=move |v: String| style(json!({"backgroundExpression":v}))
                    />
                    <SelectField
                        label="Insert special field"
                        value=String::new()
                        options=options(
                            &[
                                ("", "Choose a special field"),
                                ("ROW_NUMBER", "ROW_NUMBER"),
                                ("ROW_COUNT", "ROW_COUNT"),
                                ("TABLE_ROW_NUMBER", "TABLE_ROW_NUMBER"),
                                ("COLUMN_NUMBER", "COLUMN_NUMBER"),
                                ("IS_ODD_ROW", "IS_ODD_ROW"),
                            ],
                        )
                        on_change=move |v: String| {
                            if !v.is_empty() {
                                style(json!({"backgroundExpression":format!("{copy}{v}")}));
                            }
                        }
                    />
                    <p class="helper">
                        {s
                            .t(
                                "ROW_NUMBER starts at 1 and continues across pages. TABLE_ROW_NUMBER includes the table header. ROW_COUNT, COLUMN_NUMBER and IS_ODD_ROW are also available.",
                            )}
                    </p>
                }
            })}
    }.into_any()
}
