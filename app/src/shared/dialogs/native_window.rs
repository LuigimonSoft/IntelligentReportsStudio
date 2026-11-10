use crate::{shared::dialogs::EditorDialog, state::studio};
use leptos::prelude::*;
#[component]
pub fn NativeEditorWindow() -> impl IntoView {
    let s = studio();
    #[cfg(feature = "csr")]
    {
        let escape = window_event_listener(leptos::ev::keydown, move |event| {
            if event.key() == "Escape" {
                event.prevent_default();
                super::close_editor(s);
            }
        });
        on_cleanup(move || escape.remove());
    }
    #[cfg(feature = "csr")]
    leptos::task::spawn_local(async move {
        match crate::platform::editor_windows::call("editor_context", serde_json::json!({})).await {
            Ok(context) => {
                s.project.set(context["project"].clone());
                s.language
                    .set(context["language"].as_str().unwrap_or("en").to_owned());
                s.units
                    .set(context["units"].as_str().unwrap_or("cm").to_owned());
                s.dark.set(context["dark"].as_bool().unwrap_or(false));
                s.table
                    .set(context["table"].as_str().unwrap_or_default().to_owned());
                s.selected
                    .set(serde_json::from_value(context["selected"].clone()).unwrap_or_default());
                s.band
                    .set(context["band"].as_str().unwrap_or_default().to_owned());
                s.original_record.set(context["original"].clone());
                s.draft
                    .set(serde_json::to_string_pretty(&context["value"]).unwrap_or_default());
                s.message.set(String::new());
                s.dialog
                    .set(context["kind"].as_str().unwrap_or_default().to_owned());
            }
            Err(error) => s.message.set(error),
        }
    });
    view! {
        <div class="reportstudio-app native-editor-window" class:dark=move || s.dark.get()>
            <Show when=move || s.dialog.get().is_empty()>
                <p role="status">{move || s.message.get()}</p>
            </Show>
            <EditorDialog />
        </div>
    }
}
