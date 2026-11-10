mod editor_modality;
pub mod data_files;
pub mod preferences;
pub mod editor_windows;
use serde_json::Value;
use std::{fs, path::Path, sync::Mutex};
use tauri::{Manager, State};

pub struct DocumentPath(
    pub Mutex<Option<std::path::PathBuf>>,
    pub Mutex<Option<std::path::PathBuf>>,
);

pub struct DocumentDirty(pub std::sync::atomic::AtomicBool, pub Mutex<String>);
#[tauri::command]
pub fn set_document_dirty(dirty: bool, message: String, state: State<'_, DocumentDirty>) {
    if let Ok(mut text) = state.1.lock() {
        *text = message;
    }
    state.0.store(dirty, std::sync::atomic::Ordering::SeqCst);
}

pub struct NativeClipboard(pub Mutex<Option<arboard::Clipboard>>);

/// Ask in an operating-system dialog; a WebKit window.confirm is not supported.
#[tauri::command]
pub async fn confirm_discard_changes(window: tauri::WebviewWindow, message: String) -> Result<bool, String> {
    if message.len() > 2048 { return Err("Confirmation message is too long.".into()); }
    let answer = rfd::AsyncMessageDialog::new()
        .set_title("Report Studio")
        .set_description(&message)
        .set_buttons(rfd::MessageButtons::YesNo)
        .set_parent(&window)
        .show().await;
    Ok(answer == rfd::MessageDialogResult::Yes)
}

/// A native acknowledgement proves that the CSR application mounted in the WebView.
#[tauri::command]
pub fn frontend_ready() {
    log::info!("Report Studio WebView mounted and ready");
}

const MAX_DOCUMENT: usize = 16 * 1024 * 1024;
fn validate_document_version(document: &Value) -> Result<(), String> {
    if document["version"] != 1 || !document["report"].is_object() {
        return Err("Invalid report document.".into());
    }
    if document.get("schemaVersion").is_some_and(|version| version != 1) {
        return Err("Unsupported report schema version.".into());
    }
    Ok(())
}
fn checked_text(text: String) -> Result<String, String> {
    if text.len() > MAX_DOCUMENT {
        Err("The document exceeds the 16 MiB limit.".into())
    } else {
        Ok(text)
    }
}
fn read_document(path: &Path) -> Result<String, String> {
    let length = fs::metadata(path).map_err(|e| e.to_string())?.len();
    if length > MAX_DOCUMENT as u64 {
        return Err("The document exceeds the 16 MiB limit.".into());
    }
    checked_text(fs::read_to_string(path).map_err(|e| e.to_string())?)
}
/// Save to a sibling temporary file first; cancellation never touches the document.
fn write_file(path: &Path, bytes: &[u8]) -> Result<(), String> {
    use std::io::Write;
    let parent = path
        .parent()
        .ok_or("The destination has no parent directory.")?;
    let mut file = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    file.write_all(bytes)
        .and_then(|_| file.as_file().sync_all())
        .map_err(|e| e.to_string())?;
    file.persist(path).map_err(|e| e.to_string())?;
    Ok(())
}
fn recovery_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let directory = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    Ok(directory.join("recovery.json"))
}
#[tauri::command]
pub fn save_recovery(app: tauri::AppHandle, document: Value) -> Result<(), String> {
    validate_document_version(&document)?;
    let bytes = serde_json::to_vec(&document).map_err(|e| e.to_string())?;
    if bytes.len() > MAX_DOCUMENT {
        return Err("The document exceeds the 16 MiB limit.".into());
    }
    write_file(&recovery_path(&app)?, &bytes)
}
#[tauri::command]
pub fn load_recovery(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = recovery_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    read_document(&path).map(Some)
}
#[tauri::command]
pub fn clear_recovery(app: tauri::AppHandle) -> Result<(), String> {
    match fs::remove_file(recovery_path(&app)?) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
fn recent_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let directory = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    Ok(directory.join("recent.json"))
}
#[tauri::command]
pub fn list_recent_documents(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let path = recent_path(&app)?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let text = read_document(&path)?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}
fn update_recent(recent: &mut Vec<String>, name: String) {
    recent.retain(|entry| entry != &name);
    recent.insert(0, name);
    recent.truncate(10);
}
fn remember_document(app: &tauri::AppHandle, path: &Path) -> Result<(), String> {
    let name = path.to_string_lossy().into_owned();
    let mut recent = list_recent_documents(app.clone()).unwrap_or_default();
    update_recent(&mut recent, name);
    write_file(
        &recent_path(app)?,
        &serde_json::to_vec(&recent).map_err(|e| e.to_string())?,
    )?;
    crate::file_menu::install(app).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn open_recent_document(
    app: tauri::AppHandle,
    path: String,
    state: State<'_, DocumentPath>,
) -> Result<String, String> {
    if !list_recent_documents(app)?.contains(&path) {
        return Err("Unknown recent document.".into());
    }
    let path = std::path::PathBuf::from(path);
    let text = read_document(&path)?;
    *state.1.lock().map_err(|e| e.to_string())? = Some(path);
    Ok(text)
}
#[tauri::command]
pub async fn open_report() -> Result<Option<String>, String> {
    let file = rfd::AsyncFileDialog::new()
        .add_filter("Report Studio", &["json"])
        .pick_file()
        .await;
    file.map(|f| read_document(f.path())).transpose()
}
#[tauri::command]
pub async fn save_report(
    document: Value,
    app: tauri::AppHandle,
    save_as: Option<bool>,
    state: State<'_, DocumentPath>,
) -> Result<bool, String> {
    validate_document_version(&document)?;
    let template = app::domain::template_only(&document);
    let bytes = serde_json::to_vec_pretty(&template).map_err(|e| e.to_string())?;
    if bytes.len() > MAX_DOCUMENT {
        return Err("The document exceeds the 16 MiB limit.".into());
    }
    let current = state.0.lock().map_err(|e| e.to_string())?.clone();
    let path = if save_as.unwrap_or(false) || current.is_none() {
        rfd::AsyncFileDialog::new()
            .add_filter("Report Studio", &["json"])
            .set_file_name("Report Studio.json")
            .save_file()
            .await
            .map(|f| f.path().to_path_buf())
    } else {
        current
    };
    if let Some(path) = path {
        write_file(&path, &bytes)?;
        if let Err(error) = remember_document(&app, &path) {
            log::warn!("Could not update recent documents: {error}");
        }
        *state.0.lock().map_err(|e| e.to_string())? = Some(path);
        Ok(true)
    } else {
        Ok(false)
    }
}
#[tauri::command]
pub fn reset_document_path(state: State<'_, DocumentPath>, files: State<'_, data_files::DataFiles>) -> Result<(), String> {
    files.clear()?;
    *state.0.lock().map_err(|e| e.to_string())? = None;
    Ok(())
}
#[tauri::command]
pub async fn open_document(state: State<'_, DocumentPath>) -> Result<Option<String>, String> {
    let file = rfd::AsyncFileDialog::new()
        .add_filter("Report Studio", &["json"])
        .pick_file()
        .await;
    if let Some(file) = file {
        let text = read_document(file.path())?;
        // Only remember a document after basic structural validation.
        let value: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
        validate_document_version(&value)?;
        *state.1.lock().map_err(|e| e.to_string())? = Some(file.path().to_path_buf());
        Ok(Some(text))
    } else {
        Ok(None)
    }
}
#[tauri::command]
pub fn accept_document_path(
    app: tauri::AppHandle,
    state: State<'_, DocumentPath>,
    files: State<'_, data_files::DataFiles>,
) -> Result<(), String> {
    files.clear()?;
    let pending = state.1.lock().map_err(|e| e.to_string())?.take();
    if let Some(path) = &pending {
        if let Err(error) = remember_document(&app, path) {
            log::warn!("Could not update recent documents: {error}");
        }
    }
    *state.0.lock().map_err(|e| e.to_string())? = pending;
    Ok(())
}
/// Generate a portable file name without treating report titles as paths.
fn pdf_file_name(title: Option<&str>) -> String {
    let cleaned: String = title.unwrap_or("").chars().take(100)
        .map(|c| if c.is_control() || ['/', '\\', ':', '*', '?', '"', '<', '>', '|'].contains(&c) { '_' } else { c })
        .collect();
    let stem = cleaned.trim().trim_matches('.').trim();
    let stem = if stem.is_empty() { "Report Studio" } else { stem };
    let base = stem.split('.').next().unwrap_or(stem).to_ascii_uppercase();
    let reserved = matches!(base.as_str(), "CON" | "PRN" | "AUX" | "NUL" | "COM1" | "COM2" | "COM3" | "COM4" | "COM5" | "COM6" | "COM7" | "COM8" | "COM9" | "LPT1" | "LPT2" | "LPT3" | "LPT4" | "LPT5" | "LPT6" | "LPT7" | "LPT8" | "LPT9");
    let stem = if reserved { format!("_{stem}") } else { stem.to_owned() };
    if stem.to_ascii_lowercase().ends_with(".pdf") { stem } else { format!("{stem}.pdf") }
}
#[tauri::command]
pub async fn save_pdf(bytes: Vec<u8>, suggested_name: Option<String>) -> Result<bool, String> {
    if bytes.len() > 100 * 1024 * 1024 || !bytes.starts_with(b"%PDF-") {
        return Err("Invalid PDF document.".into());
    }
    if let Some(file) = rfd::AsyncFileDialog::new()
        .add_filter("PDF", &["pdf"])
        .set_file_name(pdf_file_name(suggested_name.as_deref()))
        .save_file()
        .await
    {
        write_file(file.path(), &bytes)?;
        Ok(true)
    } else {
        Ok(false)
    }
}
#[tauri::command]
pub async fn save_csv(text: String, format: Option<String>) -> Result<bool, String> {
    let text = checked_text(text)?;
    let (label, extension) = match format.as_deref().unwrap_or("csv") {
        "csv" => ("CSV", "csv"),
        "json" => ("JSON", "json"),
        _ => return Err("Unsupported data export format.".into()),
    };
    if let Some(file) = rfd::AsyncFileDialog::new()
        .add_filter(label, &[extension])
        .set_file_name(format!("Report Studio.{extension}"))
        .save_file()
        .await
    {
        write_file(file.path(), text.as_bytes())?;
        Ok(true)
    } else {
        Ok(false)
    }
}
#[tauri::command]
pub async fn open_image() -> Result<Option<String>, String> {
    use base64::Engine;
    let file = rfd::AsyncFileDialog::new()
        .add_filter("Image", &["png", "jpg", "jpeg"])
        .pick_file()
        .await;
    if let Some(file) = file {
        let metadata = fs::metadata(file.path()).map_err(|e| e.to_string())?;
        if metadata.len() > MAX_DOCUMENT as u64 {
            return Err("The image exceeds the 16 MiB limit.".into());
        }
        let bytes = fs::read(file.path()).map_err(|e| e.to_string())?;
        let mime = if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
            "image/png"
        } else if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
            "image/jpeg"
        } else {
            return Err("Only PNG and JPEG images are supported.".into());
        };
        Ok(Some(format!(
            "data:{mime};base64,{}",
            base64::engine::general_purpose::STANDARD.encode(bytes)
        )))
    } else {
        Ok(None)
    }
}
#[tauri::command]
pub fn write_clipboard(text: String, state: State<NativeClipboard>) -> Result<(), String> {
    let text = checked_text(text)?;
    let mut clipboard = state.0.lock().map_err(|e| e.to_string())?;
    if clipboard.is_none() {
        *clipboard = Some(arboard::Clipboard::new().map_err(|e| e.to_string())?);
    }
    clipboard
        .as_mut()
        .unwrap()
        .set_text(text)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn read_clipboard(state: State<NativeClipboard>) -> Result<String, String> {
    let mut clipboard = state.0.lock().map_err(|e| e.to_string())?;
    if clipboard.is_none() {
        *clipboard = Some(arboard::Clipboard::new().map_err(|e| e.to_string())?);
    }
    checked_text(
        clipboard
            .as_mut()
            .unwrap()
            .get_text()
            .map_err(|e| e.to_string())?,
    )
}
#[tauri::command]
pub fn print_report(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}
#[tauri::command]
pub fn toggle_fullscreen(window: tauri::WebviewWindow) -> Result<(), String> {
    let current = window.is_fullscreen().map_err(|e| e.to_string())?;
    window.set_fullscreen(!current).map_err(|e| e.to_string())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn atomic_save_overwrites_and_preserves_utf8() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("report.json");
        write_file(&path, b"old").unwrap();
        write_file(&path, "{\"title\":\"Français\"}".as_bytes()).unwrap();
        assert_eq!(read_document(&path).unwrap(), "{\"title\":\"Français\"}");
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }
    #[test]
    fn nonexistent_destination_does_not_create_files() {
        let dir = tempfile::tempdir().unwrap();
        assert!(write_file(&dir.path().join("missing/file"), b"text").is_err());
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 0);
    }
    #[test]
    fn recent_documents_are_unique_ordered_and_limited() {
        let mut recent = Vec::new();
        for index in 0..12 {
            update_recent(&mut recent, format!("report-{index}.json"));
        }
        assert_eq!(recent.len(), 10);
        assert_eq!(recent[0], "report-11.json");
        update_recent(&mut recent, "report-5.json".into());
        assert_eq!(recent[0], "report-5.json");
        assert_eq!(
            recent
                .iter()
                .filter(|entry| *entry == "report-5.json")
                .count(),
            1
        );
    }
    #[test]
    fn recovery_write_is_independent_of_saved_report() {
        let dir = tempfile::tempdir().unwrap();
        let report = dir.path().join("report.json");
        let recovery = dir.path().join("recovery.json");
        write_file(&report, br#"{"title":"saved"}"#).unwrap();
        write_file(&recovery, br#"{"title":"edited"}"#).unwrap();
        assert_eq!(read_document(&report).unwrap(), r#"{"title":"saved"}"#);
        assert_eq!(read_document(&recovery).unwrap(), r#"{"title":"edited"}"#);
    }
    #[test]
    fn recovery_child_process() {
        let Ok(path) = std::env::var("REPORTSTUDIO_TEST_RECOVERY_PATH") else {
            return;
        };
        write_file(Path::new(&path), br#"{"title":"unsaved edit"}"#).unwrap();
        std::thread::sleep(std::time::Duration::from_secs(30));
    }
    #[test]
    fn recovery_survives_abrupt_process_termination() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("recovery.json");
        let mut child = std::process::Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "commands::tests::recovery_child_process",
                "--nocapture",
            ])
            .env("REPORTSTUDIO_TEST_RECOVERY_PATH", &path)
            .spawn()
            .unwrap();
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
        while !path.exists() && std::time::Instant::now() < deadline {
            std::thread::sleep(std::time::Duration::from_millis(20));
        }
        let existed = path.exists();
        child.kill().unwrap();
        child.wait().unwrap();
        assert!(existed, "child did not write the recovery file");
        assert_eq!(read_document(&path).unwrap(), r#"{"title":"unsaved edit"}"#);
    }
    #[test]
    fn rejects_oversized_documents() {
        assert!(checked_text("a".repeat(MAX_DOCUMENT + 1)).is_err());
    }
}
