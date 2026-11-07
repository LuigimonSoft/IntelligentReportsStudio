//! Native ownership and lifetime of the editor dialogs. Drafts stay in memory.
use futures_channel::oneshot;
use serde_json::Value;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Mutex,
};
use tauri::{Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};

#[derive(Default)]
pub struct EditorWindows {
    sequence: AtomicU64,
    session: Mutex<Option<Session>>,
}
struct Session {
    label: String,
    context: Value,
    reply: oneshot::Sender<Option<Value>>,
    result: Option<Value>,
}
fn check_context(context: &Value) -> Result<(), String> {
    let kind = context["kind"].as_str().unwrap_or_default();
    if ![
        "Formula",
        "Chart",
        "Relationship",
        "Parameter",
        "Add table",
        "Data table",
        "Record",
        "Query",
        "Print settings",
        "Import tables",
        "Grouping",
    ]
    .contains(&kind)
    {
        return Err("Unsupported editor.".into());
    }
    if context.to_string().len() > 16 * 1024 * 1024 {
        return Err("The editor context exceeds the 16 MiB limit.".into());
    }
    Ok(())
}
fn release(app: &tauri::AppHandle, label: &str, result: Option<Value>) {
    let state = app.state::<EditorWindows>();
    let session = {
        let Ok(mut slot) = state.session.lock() else {
            return;
        };
        if slot.as_ref().is_none_or(|s| s.label != label) {
            return;
        }
        slot.take()
    };
    if let Some(session) = session {
        if let Some(parent) = app.get_webview_window("main") {
            let _ = super::editor_modality::restore(&parent);
            let _ = parent.set_focus();
        }
        let _ = session.reply.send(result.or(session.result));
    }
}
#[tauri::command]
pub async fn open_editor(
    window: WebviewWindow,
    state: State<'_, EditorWindows>,
    context: Value,
) -> Result<Option<Value>, String> {
    if window.label() != "main" {
        return Err("Only the main window may open an editor.".into());
    }
    check_context(&context)?;
    let label = format!("editor-{}", state.sequence.fetch_add(1, Ordering::Relaxed));
    let title = context["title"]
        .as_str()
        .unwrap_or("Report Studio")
        .chars()
        .take(120)
        .collect::<String>();
    let context_kind_is_table =
        matches!(context["kind"].as_str(), Some("Add table" | "Data table"));
    let context_kind_is_relation = context["kind"] == "Relationship";
    let context_kind_is_chart = context["kind"] == "Chart";
    let large = matches!(context["kind"].as_str(), Some("Formula" | "Chart"));
    let (reply, receive) = oneshot::channel();
    {
        let mut slot = state.session.lock().map_err(|e| e.to_string())?;
        if slot.is_some() {
            return Err("An editor is already open.".into());
        }
        *slot = Some(Session {
            label: label.clone(),
            context,
            reply,
            result: None,
        });
    }
    let app = window.app_handle().clone();
    let create = (|| -> tauri::Result<WebviewWindow> {
        let child =
            WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("index.html?editor=1".into()))
                .title(title)
                .inner_size(
                    if context_kind_is_chart {
                        1400.0
                    } else if context_kind_is_relation || context_kind_is_table {
                        620.0
                    } else if large {
                        1180.0
                    } else {
                        760.0
                    },
                    if context_kind_is_chart {
                        860.0
                    } else if context_kind_is_table {
                        490.0
                    } else if context_kind_is_relation {
                        450.0
                    } else if large {
                        760.0
                    } else {
                        620.0
                    },
                )
                .min_inner_size(560.0, 440.0)
                .parent(&window)?
                .center()
                .visible(false)
                .build()?;
        let owner = app.clone();
        let identity = label.clone();
        child.on_window_event(move |event| {
            if matches!(event, WindowEvent::Destroyed) {
                release(&owner, &identity, None);
            }
        });
        super::editor_modality::present(&window, &child)?;
        Ok(child)
    })();
    if let Err(error) = create {
        if let Some(child) = app.get_webview_window(&label) {
            let _ = child.destroy();
        }
        release(&app, &label, None);
        return Err(error.to_string());
    }
    receive.await.map_err(|_| "The editor was closed.".into())
}
#[tauri::command]
pub fn editor_context(window: WebviewWindow, state: State<EditorWindows>) -> Result<Value, String> {
    let slot = state.session.lock().map_err(|e| e.to_string())?;
    slot.as_ref()
        .filter(|s| s.label == window.label())
        .map(|s| s.context.clone())
        .ok_or_else(|| "Unknown editor window.".into())
}
#[tauri::command]
pub fn finish_editor(
    window: WebviewWindow,
    state: State<EditorWindows>,
    result: Option<Value>,
) -> Result<(), String> {
    {
        let slot = state.session.lock().map_err(|e| e.to_string())?;
        if slot.as_ref().is_none_or(|s| s.label != window.label()) {
            return Err("Unknown editor window.".into());
        }
    }
    if result
        .as_ref()
        .is_some_and(|v| v.to_string().len() > 16 * 1024 * 1024)
    {
        return Err("The definition exceeds the 16 MiB limit.".into());
    }
    {
        let mut slot = state.session.lock().map_err(|e| e.to_string())?;
        if let Some(session) = slot.as_mut() {
            session.result = result.clone();
        }
    }
    if let Some(parent) = window.app_handle().get_webview_window("main") {
        super::editor_modality::restore(&parent).map_err(|e| e.to_string())?;
    }
    // Destroy first: if the OS rejects closing, keep the draft and parent blocked.
    if let Err(error) = window.destroy() {
        if let Ok(mut slot) = state.session.lock() {
            if let Some(session) = slot.as_mut() {
                session.result = None;
            }
        }
        return Err(error.to_string());
    }
    release(window.app_handle(), window.label(), result);
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn only_known_editors_accept_context() {
        for kind in [
            "Formula",
            "Chart",
            "Relationship",
            "Parameter",
            "Add table",
            "Data table",
            "Record",
            "Query",
            "Print settings",
            "Import tables",
            "Grouping",
        ] {
            assert!(check_context(&json!({"kind":kind})).is_ok());
        }
        assert!(check_context(&json!({"kind":"Script"})).is_err());
    }
    #[test]
    fn oversized_editor_context_is_rejected() {
        assert!(
            check_context(&json!({"kind":"Formula","value":"a".repeat(16 * 1024 * 1024)})).is_err()
        );
    }
    #[test]
    fn closing_a_session_delivers_cancellation() {
        let (reply, mut receive) = oneshot::channel::<Option<Value>>();
        reply.send(None).unwrap();
        assert_eq!(receive.try_recv().unwrap(), Some(None));
    }
}
