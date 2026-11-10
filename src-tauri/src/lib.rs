mod commands;
mod file_menu;
use tauri::Manager;

/// Tauri serves the compiled CSR assets and handles operating-system operations.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(commands::editor_windows::EditorWindows::default())
        .manage(file_menu::MenuLabels(std::sync::Mutex::new(serde_json::json!({}))))
        .manage(commands::DocumentDirty(
            std::sync::atomic::AtomicBool::new(false),
            std::sync::Mutex::new(String::from("Discard unsaved changes?")),
        ))
        .manage(commands::DocumentPath(
            std::sync::Mutex::new(None),
            std::sync::Mutex::new(None),
        ))
        .manage(commands::data_files::DataFiles::default())
        .manage(commands::NativeClipboard(std::sync::Mutex::new(None)))
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            commands::editor_windows::open_editor,
            commands::editor_windows::editor_context,
            commands::editor_windows::finish_editor,
            commands::frontend_ready,
            file_menu::set_file_menu_labels,
            commands::preferences::load_preferences,
            commands::preferences::save_preferences,
            commands::save_recovery,
            commands::load_recovery,
            commands::clear_recovery,
            commands::set_document_dirty,
            commands::confirm_discard_changes,
            commands::data_files::choose_table_data,
            commands::data_files::accept_table_data,
            commands::data_files::reload_table_data,
            commands::data_files::clear_table_data_sources,
            commands::open_report,
            commands::open_document,
            commands::list_recent_documents,
            commands::open_recent_document,
            commands::accept_document_path,
            commands::reset_document_path,
            commands::save_report,
            commands::save_pdf,
            commands::save_csv,
            commands::open_image,
            commands::write_clipboard,
            commands::read_clipboard,
            commands::print_report,
            commands::toggle_fullscreen
        ])
        .setup(|app| { file_menu::install(app.handle())?; Ok(()) })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            let (action, args) = if let Some(index) = id.strip_prefix("recent-").and_then(|v| v.parse::<usize>().ok()) {
                let paths = commands::list_recent_documents(app.clone()).unwrap_or_default();
                let Some(path) = paths.get(index) else { return; };
                ("open-recent", serde_json::json!({"path":path}))
            } else if ["new", "open", "save", "save-as", "duplicate-report", "export-pdf", "undo", "redo", "cut", "copy", "paste", "delete", "view-design", "view-data", "view-preview"].contains(&id) {
                (id, serde_json::json!({}))
            } else { return; };
            if let Some(window) = app.get_webview_window("main") {
                let detail = serde_json::json!({"action":action,"args":args});
                let _ = window.eval(format!("window.dispatchEvent(new CustomEvent('reportstudio:file-menu', {{detail: {detail}}}));"));
            }
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window
                    .state::<commands::DocumentDirty>()
                    .0
                    .load(std::sync::atomic::Ordering::SeqCst)
                {
                    let message = window
                        .state::<commands::DocumentDirty>()
                        .1
                        .lock()
                        .map(|text| text.clone())
                        .unwrap_or_default();
                    let discard = rfd::MessageDialog::new()
                        .set_title("Report Studio")
                        .set_description(&message)
                        .set_buttons(rfd::MessageButtons::YesNo)
                        .show();
                    if discard != rfd::MessageDialogResult::Yes {
                        api.prevent_close();
                    } else if let Err(error) = commands::clear_recovery(window.app_handle().clone())
                    {
                        log::error!("Could not clear discarded recovery: {error}");
                        api.prevent_close();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod configuration_tests {
    #[test]
    fn main_window_allows_html_field_dragging() {
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        assert_eq!(config["app"]["windows"][0]["dragDropEnabled"], false);
    }
}
