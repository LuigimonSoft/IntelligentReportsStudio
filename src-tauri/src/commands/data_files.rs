//! Session-only associations between tables and user-selected JSON files.
use std::{collections::HashMap, path::PathBuf, sync::Mutex};
use tauri::State;
#[derive(Default)]
pub struct DataFiles { files: Mutex<HashMap<String, PathBuf>>, pending: Mutex<HashMap<String, PathBuf>> }
impl DataFiles {
    pub fn clear(&self) -> Result<(), String> {
        self.files.lock().map_err(|e| e.to_string())?.clear();
        self.pending.lock().map_err(|e| e.to_string())?.clear(); Ok(())
    }
}
#[tauri::command]
pub async fn choose_table_data(table: String, state: State<'_, DataFiles>) -> Result<Option<String>, String> {
    if table.is_empty() || table.len() > 200 { return Err("Invalid table.".into()); }
    let Some(file) = rfd::AsyncFileDialog::new().add_filter("JSON", &["json"]).pick_file().await else { return Ok(None); };
    let path = file.path().to_path_buf();
    let contents = super::read_document(&path)?;
    state.pending.lock().map_err(|e| e.to_string())?.insert(table, path);
    Ok(Some(contents))
}
#[tauri::command]
pub fn accept_table_data(table: String, state: State<'_, DataFiles>) -> Result<(), String> {
    let pending = state.pending.lock().map_err(|e| e.to_string())?.remove(&table);
    if let Some(path) = pending {
        state.files.lock().map_err(|e| e.to_string())?.insert(table, path);
    } Ok(())
}
#[tauri::command]
pub fn reload_table_data(table: String, state: State<'_, DataFiles>) -> Result<String, String> {
    let path = state.files.lock().map_err(|e| e.to_string())?.get(&table).cloned().ok_or("Choose a JSON file for this table first.")?;
    super::read_document(&path)
}
#[tauri::command]
pub fn clear_table_data_sources(state: State<'_, DataFiles>) -> Result<(), String> { state.clear() }
