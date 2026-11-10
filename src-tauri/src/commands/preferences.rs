//! Native persistence for non-sensitive interface preferences.
use serde_json::{Map, Value};
use std::fs;
use tauri::Manager;

fn path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.join("preferences.json"))
}

/// Accept only known fields and bounded values, including when a file was edited manually.
fn clean(value: &Value) -> Result<Value, String> {
    let source = value.as_object().ok_or("Invalid preferences.")?;
    let mut result = Map::new();
    for (key, allowed) in [
        ("language", &["en", "es", "fr"][..]),
        ("units", &["cm", "mm", "in", "pt"][..]),
        ("guides", &["dots", "lines", "none"][..]),
    ] {
        if let Some(value) = source.get(key).and_then(Value::as_str).filter(|v| allowed.contains(v)) {
            result.insert(key.into(), value.into());
        }
    }
    for key in ["dark", "zoomAuto", "snapGrid", "showMargins"] {
        if let Some(value) = source.get(key).and_then(Value::as_bool) {
            result.insert(key.into(), value.into());
        }
    }
    for (key, min, max) in [("zoom", 0.15, 3.0), ("modelZoom", 0.25, 2.0), ("spacing", 0.01, 2.0),
        ("designLeftWidth", 180.0, 500.0), ("designRightWidth", 180.0, 500.0),
        ("dataLeftWidth", 180.0, 500.0), ("dataRightWidth", 180.0, 500.0),
        ("previewLeftWidth", 140.0, 360.0), ("previewRightWidth", 180.0, 500.0)] {
        if let Some(value) = source.get(key).and_then(Value::as_f64).filter(|n| n.is_finite() && *n >= min && *n <= max) {
            result.insert(key.into(), value.into());
        }
    }
    Ok(Value::Object(result))
}

#[tauri::command]
pub fn load_preferences(app: tauri::AppHandle) -> Result<Value, String> {
    let file = path(&app)?;
    match fs::metadata(&file) {
        Ok(metadata) if metadata.len() > 65536 => return Err("Preferences file is too large.".into()),
        Ok(_) => {},
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(serde_json::json!({})),
        Err(error) => return Err(error.to_string()),
    }
    let bytes = fs::read(file).map_err(|error| error.to_string())?;
    let value = serde_json::from_slice(&bytes).map_err(|error| error.to_string())?;
    clean(&value)
}

#[tauri::command]
pub fn save_preferences(app: tauri::AppHandle, preferences: Value) -> Result<(), String> {
    let bytes = serde_json::to_vec(&clean(&preferences)?).map_err(|error| error.to_string())?;
    super::write_file(&path(&app)?, &bytes)
}
