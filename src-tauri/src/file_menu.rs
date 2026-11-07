use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem, Submenu},
    Manager,
};

pub struct MenuLabels(pub Mutex<serde_json::Value>);
#[tauri::command]
pub fn set_file_menu_labels(
    app: tauri::AppHandle,
    labels: serde_json::Value,
) -> Result<(), String> {
    *app.state::<MenuLabels>()
        .0
        .lock()
        .map_err(|e| e.to_string())? = labels;
    install(&app).map_err(|e| e.to_string())
}

pub fn install(app: &tauri::AppHandle) -> tauri::Result<()> {
    let labels = app
        .state::<MenuLabels>()
        .0
        .lock()
        .map(|v| v.clone())
        .unwrap_or_default();
    let label = |key: &str| labels[key].as_str().unwrap_or(key).to_owned();
    let menu = Menu::default(app)?;
    #[cfg(target_os = "macos")]
    menu.remove_at(1)?;
    #[cfg(target_os = "windows")]
    menu.remove_at(0)?;
    #[cfg(target_os = "macos")]
    menu.remove_at(1)?;
    #[cfg(not(target_os = "macos"))]
    menu.remove_at(0)?;
    let file = Submenu::with_id(app, "report-file", label("File"), true)?;
    for (id, label, shortcut) in [
        ("new", "New", Some("CmdOrCtrl+N")),
        ("open", "Open", Some("CmdOrCtrl+O")),
        ("save", "Save", None),
        ("save-as", "Save as", Some("CmdOrCtrl+Shift+S")),
        ("duplicate-report", "Duplicate report", None),
        ("export-pdf", "Export PDF", None),
    ] {
        file.append(&MenuItem::with_id(
            app,
            id,
            labels[label].as_str().unwrap_or(label),
            true,
            shortcut,
        )?)?;
    }
    let recent = Submenu::with_id(app, "recent-documents", label("Recent reports"), true)?;
    for (index, path) in crate::commands::list_recent_documents(app.clone())
        .unwrap_or_default()
        .iter()
        .take(10)
        .enumerate()
    {
        let name = std::path::Path::new(path)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or(path);
        recent.append(&MenuItem::with_id(
            app,
            format!("recent-{index}"),
            name,
            true,
            None::<&str>,
        )?)?;
    }
    file.append(&recent)?;
    #[cfg(target_os = "macos")]
    menu.insert(&file, 1)?;
    #[cfg(not(target_os = "macos"))]
    menu.insert(&file, 0)?;
    let edit = Submenu::with_id(app, "report-edit", label("Edit"), true)?;
    for (id, key) in [
        ("undo", "Undo"),
        ("redo", "Redo"),
        ("cut", "Cut"),
        ("copy", "Copy"),
        ("paste", "Paste"),
        ("delete", "Delete"),
    ] {
        edit.append(&MenuItem::with_id(app, id, label(key), true, None::<&str>)?)?;
    }
    let view = Submenu::with_id(app, "report-view", label("View"), true)?;
    for (id, key) in [
        ("view-design", "Design"),
        ("view-data", "Data"),
        ("view-preview", "Preview"),
    ] {
        view.append(&MenuItem::with_id(app, id, label(key), true, None::<&str>)?)?;
    }
    #[cfg(target_os = "macos")]
    {
        menu.insert(&edit, 2)?;
        menu.insert(&view, 3)?;
    }
    #[cfg(not(target_os = "macos"))]
    {
        menu.insert(&edit, 1)?;
        menu.insert(&view, 2)?;
    }
    app.set_menu(menu)?;
    Ok(())
}
