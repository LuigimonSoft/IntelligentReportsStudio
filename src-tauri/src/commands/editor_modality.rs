//! Keep platform-specific window modality outside the editor/session logic.
use tauri::WebviewWindow;

pub fn present(parent: &WebviewWindow, child: &WebviewWindow) -> tauri::Result<()> {
    #[cfg(target_os = "macos")]
    {
        let owner = parent.clone();
        let editor = child.clone();
        // Tauri's set_enabled(false) creates an empty AppKit sheet. Present the
        // actual editor as that sheet instead, so its WebView receives input.
        parent.run_on_main_thread(move || {
            if let (Ok(parent_ptr), Ok(child_ptr)) = (owner.ns_window(), editor.ns_window()) {
                // SAFETY: Tauri owns both live NSWindows; AppKit is called only
                // on its main thread. No raw pointer leaves this callback.
                unsafe {
                    let parent = &*parent_ptr.cast::<objc2_app_kit::NSWindow>();
                    let child = &*child_ptr.cast::<objc2_app_kit::NSWindow>();
                    parent.beginSheet_completionHandler(child, None);
                }
            }
        })?;
    }
    #[cfg(not(target_os = "macos"))]
    {
        parent.set_enabled(false)?;
        child.show()?;
        child.set_focus()?;
    }
    Ok(())
}

pub fn restore(parent: &WebviewWindow) -> tauri::Result<()> {
    #[cfg(target_os = "macos")]
    {
        let owner = parent.clone();
        parent.run_on_main_thread(move || {
            if let Ok(ptr) = owner.ns_window() {
                // SAFETY: the parent is retained by Tauri and we are on the
                // AppKit main thread; the session owns its attached sheet.
                unsafe {
                    let parent = &*ptr.cast::<objc2_app_kit::NSWindow>();
                    if let Some(sheet) = parent.attachedSheet() {
                        parent.endSheet(&sheet);
                    }
                }
            }
        })?;
    }
    #[cfg(not(target_os = "macos"))]
    parent.set_enabled(true)?;
    Ok(())
}
