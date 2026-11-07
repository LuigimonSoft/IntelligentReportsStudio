use serde_json::Value;
use std::sync::LazyLock;
static EN: LazyLock<Value> =
    LazyLock::new(|| serde_json::from_str(include_str!("en.json")).expect("valid English catalog"));
static ES: LazyLock<Value> =
    LazyLock::new(|| serde_json::from_str(include_str!("es.json")).expect("valid Spanish catalog"));
static FR: LazyLock<Value> =
    LazyLock::new(|| serde_json::from_str(include_str!("fr.json")).expect("valid French catalog"));
pub fn translate(language: &str, key: &str) -> String {
    let catalog = match language {
        "es" => &*ES,
        "fr" => &*FR,
        _ => &*EN,
    };
    catalog[key].as_str().unwrap_or(key).to_owned()
}
