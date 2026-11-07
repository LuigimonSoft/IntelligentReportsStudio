#![recursion_limit = "512"]
pub mod domain;
pub mod header;
pub mod i18n;
pub mod navigation;
pub mod platform;
pub mod shared;
pub mod state;
pub mod tabs;

use leptos::prelude::*;
use leptos_meta::{provide_meta_context, Title};
use state::{studio, Studio};

#[component]
pub fn App() -> impl IntoView {
    provide_meta_context();
    provide_context(Studio::new());
    view! {
        <Title text="Report Studio" />
        {if platform::editor_windows::editor_window() {
            view! { <shared::dialogs::NativeEditorWindow /> }.into_any()
        } else {
            view! { <StudioWorkspace /> }.into_any()
        }}
    }
}

#[component]
fn StudioWorkspace() -> impl IntoView {
    let s = studio();
    #[cfg(feature = "csr")]
    Effect::new(move |_| {
        platform::sync_document_dirty(s.dirty.get(), &s.t("Discard unsaved changes?"))
    });
    #[cfg(feature = "csr")]
    Effect::new(move |_| {
        let labels = [
            "File",
            "New",
            "Open",
            "Save",
            "Save as",
            "Duplicate report",
            "Export PDF",
            "Recent reports",
            "Edit",
            "View",
            "Undo",
            "Redo",
            "Cut",
            "Copy",
            "Paste",
            "Delete",
            "Design",
            "Data",
            "Preview",
        ]
        .into_iter()
        .map(|key| (key.to_string(), s.t(key)))
        .collect::<std::collections::BTreeMap<_, _>>();
        platform::sync_file_menu(&serde_json::json!(labels).to_string());
    });
    #[cfg(feature = "csr")]
    {
        let recovery_ready = RwSignal::new(false);
        let recovery_busy = RwSignal::new(false);
        let recovery_pending = RwSignal::new(false);
        leptos::task::spawn_local(async move {
            match platform::call(serde_json::json!({"action":"recovery-load"})).await {
                Ok(result) => {
                    if s.dirty.get_untracked() {
                        s.message.set(s.t("Recovery was paused because the report was edited during startup. Save your work before restarting to review the previous recovery copy."));
                        return;
                    }
                    if let Some(project) = result.get("project").filter(|v| v.is_object()) {
                        if platform::confirm_discard(
                            &s.t("Recover the unsaved report from the previous session?"),
                        ) {
                            s.commit(project.clone());
                        } else {
                            let _ = platform::call(serde_json::json!({"action":"recovery-clear"}))
                                .await;
                        }
                    }
                    recovery_ready.set(true);
                }
                Err(error) => s.message.set(format!(
                    "{}: {}",
                    s.t("Recovery could not be loaded"),
                    error
                )),
            }
        });
        Effect::new(move |_| {
            let ready = recovery_ready.get();
            let dirty = s.dirty.get();
            let project = s.project.get();
            if !ready {
                return;
            }
            recovery_pending.set(true);
            if recovery_busy.get_untracked() {
                return;
            }
            recovery_busy.set(true);
            leptos::task::spawn_local(async move {
                let mut current = (dirty, project);
                loop {
                    recovery_pending.set(false);
                    let action = if current.0 {
                        "recovery-save"
                    } else {
                        "recovery-clear"
                    };
                    if let Err(error) =
                        platform::call(serde_json::json!({"action":action,"project":current.1}))
                            .await
                    {
                        s.message
                            .set(format!("{}: {}", s.t("Recovery could not be saved"), error));
                    }
                    if !recovery_pending.get_untracked() {
                        break;
                    }
                    current = (s.dirty.get_untracked(), s.project.get_untracked());
                }
                recovery_busy.set(false);
            });
        });
    }
    navigation::keyboard::install_shortcuts();
    platform::install_host_events();
    view! {
        <div class="reportstudio-app" class:dark=move || s.dark.get()>
            <header::StudioHeader />
            <navigation::WorkspaceNavigation />
            <main class="studio-main">
                {move || match s.tab.get().as_str() {
                    "Data" => view! { <tabs::data::DataTab /> }.into_any(),
                    "Preview" => view! { <tabs::preview::PreviewTab /> }.into_any(),
                    _ => view! { <tabs::design::DesignTab /> }.into_any(),
                }}
            </main>
            <footer class="status-bar" role="status" hidden=move || s.tab.get() == "Preview">
                {move || s.t(&s.message.get())}
            </footer>
            <shared::dialogs::EditorDialog />
        </div>
    }
}
