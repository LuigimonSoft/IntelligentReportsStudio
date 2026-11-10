/// At 100%, the designer uses 76 CSS pixels per document inch.
pub const DESIGN_PIXELS_PER_INCH: f64 = 76.0;
use serde_json::{json, Value};

pub fn number(value: &Value, key: &str) -> f64 {
    value[key].as_f64().unwrap_or(0.0)
}
pub fn text(value: &Value, key: &str) -> String {
    value[key].as_str().unwrap_or("").to_owned()
}
pub fn array(value: &Value) -> Vec<Value> {
    value.as_array().cloned().unwrap_or_default()
}
pub fn bands(report: &Value) -> Vec<Value> {
    fn flatten(band: &Value, out: &mut Vec<Value>) {
        if !band.is_object() {
            return;
        }
        out.push(band.clone());
        for child in array(&band["sections"]) {
            flatten(&child, out);
        }
    }
    let mut result = Vec::new();
    flatten(&report["header"], &mut result);
    flatten(&report["pageHeader"], &mut result);
    for detail in array(&report["details"]) {
        flatten(&detail["groupHeader"], &mut result);
        let groups = array(&detail["groups"]);
        for group in &groups {
            flatten(&group["header"], &mut result);
        }
        flatten(&detail["band"], &mut result);
        for group in groups.iter().rev() {
            flatten(&group["footer"], &mut result);
        }
        flatten(&detail["groupFooter"], &mut result);
    }
    flatten(&report["pageFooter"], &mut result);
    flatten(&report["footer"], &mut result);
    result
}
/// Design shows the sections at their assigned heights, without filling a sheet.
pub fn design_bands(report: &Value) -> Vec<Value> {
    bands(report)
}
pub fn design_height(report: &Value) -> f64 {
    design_bands(report)
        .iter()
        .map(|band| number(band, "height").max(0.05))
        .sum()
}
pub fn band_mut<'a>(value: &'a mut Value, id: &str) -> Option<&'a mut Value> {
    if value["id"].as_str() == Some(id) && value["elements"].is_array() {
        return Some(value);
    }
    match value {
        Value::Object(map) => map.values_mut().find_map(|child| band_mut(child, id)),
        Value::Array(items) => items.iter_mut().find_map(|child| band_mut(child, id)),
        _ => None,
    }
}
pub fn read_only(report: &Value, id: &str) -> bool {
    fn search(value: &Value, id: &str, inherited: bool) -> Option<bool> {
        let locked = inherited || value["readOnly"].as_bool() == Some(true);
        if value["id"].as_str() == Some(id) {
            return Some(locked);
        }
        match value {
            Value::Object(map) => map.values().find_map(|v| search(v, id, locked)),
            Value::Array(items) => items.iter().find_map(|v| search(v, id, locked)),
            _ => None,
        }
    }
    search(report, id, false).unwrap_or(false)
}
pub fn blank_project() -> Value {
    let band = |id: &str, name: &str, height: f64| json!({"id":id,"name":name,"height":height,"elements":[],"visible":true});
    json!({"version":1,"schemaVersion":1,"datasets":[],"report":{"version":1,"id":"new-report","title":"New report","locale":"en-US","currency":"MXN",
      "page":{"width":210.0/25.4,"height":297.0/25.4,"margins":{"top":0.4,"left":0.4,"right":0.4,"bottom":0.4}},
      "header":band("report-header","Report header",0.7),"pageHeader":band("page-header","Page header",0.6),
      "details":[{"id":"detail","dataset":"","groupHeader":band("details-header","Details header",0.4),"band":band("details","Details",0.4),"groupFooter":band("details-footer","Details footer",0.5)}],
      "pageFooter":band("page-footer","Page footer",0.5),"footer":band("report-footer","Report footer",0.8)}})
}
pub fn example_project() -> Value {
    let mut value: Value = serde_json::from_str(include_str!("../data/exampleInvoice.json"))
        .expect("valid bundled example");
    let data: Value =
        serde_json::from_str(include_str!("../data/exampleData.json")).expect("valid bundled data");
    for dataset in value["datasets"].as_array_mut().into_iter().flatten() {
        if let Some(source) = data
            .as_array()
            .unwrap()
            .iter()
            .find(|s| s["id"] == dataset["id"])
        {
            dataset["data"] = source["data"].clone();
        }
    }
    value
}
/// Explicit whitelist prevents credentials and runtime rows reaching disk.
pub fn template_only(project: &Value) -> Value {
    let mut result = json!({"version":1,"schemaVersion":1,"report":project["report"].clone(),"datasets":[]});
    result["datasets"] = Value::Array(
        array(&project["datasets"])
            .into_iter()
            .map(|d| json!({"id":d["id"],"name":d["name"],"schema":d["schema"],"data":[]}))
            .collect(),
    );
    for key in ["relations", "dataModel"] {
        if let Some(v) = project.get(key) {
            result[key] = v.clone();
        }
    }
    if let Some(name) = project.pointer("/dataSource/name").and_then(Value::as_str) {
        result["dataSource"] = json!({"name":name});
    }
    if let Some(parameters) = project["parameters"].as_array() {
        result["parameters"] = Value::Array(
            parameters
                .iter()
                .map(|p| {
                    let mut p = p.clone();
                    if p["saveValue"] == false {
                        p.as_object_mut().unwrap().remove("value");
                        p.as_object_mut().unwrap().remove("defaultValue");
                    }
                    p
                })
                .collect(),
        );
    }
    result
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn blank_has_seven_ordered_sections_and_no_data() {
        let p = blank_project();
        assert_eq!(
            bands(&p["report"])
                .iter()
                .map(|b| text(b, "name"))
                .collect::<Vec<_>>(),
            [
                "Report header",
                "Page header",
                "Details header",
                "Details",
                "Details footer",
                "Page footer",
                "Report footer"
            ]
        );
        assert_eq!(p["datasets"], json!([]));
    }
    #[test]
    fn template_drops_rows_secrets_and_transient_values() {
        let mut p = example_project();
        p["credentials"] = json!({"password":"secret"});
        p["parameters"] = json!([{"id":"p","saveValue":false,"value":"secret","defaultValue":"secret"},{"id":"q","saveValue":true,"value":"keep"}]);
        let saved = template_only(&p);
        assert!(saved.get("credentials").is_none());
        assert!(array(&saved["datasets"])
            .iter()
            .all(|d| d["data"] == json!([])));
        assert!(saved["parameters"][0].get("value").is_none());
        assert_eq!(saved["parameters"][1]["value"], "keep");
    }
    #[test]
    fn inherited_read_only() {
        let mut p = blank_project();
        p["report"]["header"]["readOnly"] = json!(true);
        p["report"]["header"]["sections"] = json!([{"id":"child","elements":[]}]);
        assert!(read_only(&p["report"], "child"));
    }
    #[test]
    fn unknown_report_properties_survive() {
        let mut p = blank_project();
        p["report"]["extension"] = json!({"future":true});
        assert_eq!(
            template_only(&p)["report"]["extension"],
            p["report"]["extension"]
        );
    }
}

/// Match the portable font choices used by the report engine and PDF adapter.
pub fn font_stack(family: &str) -> &'static str {
    match family {
        "serif" => "'Times New Roman',Times,'Liberation Serif','DejaVu Serif',serif",
        "monospace" => "'Courier New',Courier,'Liberation Mono','DejaVu Sans Mono',monospace",
        "verdana" => "Verdana,Geneva,'DejaVu Sans',sans-serif",
        "tahoma" => "Tahoma,Geneva,'DejaVu Sans',sans-serif",
        "trebuchet" => "'Trebuchet MS','DejaVu Sans',sans-serif",
        "segoe" => "'Segoe UI','Helvetica Neue','DejaVu Sans',sans-serif",
        "system" => "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        "georgia" => "Georgia,'DejaVu Serif',serif",
        "palatino" => "'Palatino Linotype',Palatino,'Book Antiqua','DejaVu Serif',serif",
        "garamond" => "Garamond,Baskerville,'DejaVu Serif',serif",
        "consolas" => "Consolas,Menlo,Monaco,'DejaVu Sans Mono',monospace",
        _ => "Arial,Helvetica,'Liberation Sans','DejaVu Sans',sans-serif",
    }
}
