pub mod keyboard;

use crate::{shared::controls::*, state::studio};
use leptos::prelude::*;
use serde_json::Value;
#[component]
pub fn WorkspaceNavigation() -> impl IntoView {
    let s = studio();
    view! {
        <nav class="workspace-navigation">
            <div>
                {["Design", "Data", "Preview"]
                    .into_iter()
                    .map(move |tab| {
                        view! {
                            <Button
                                label=tab
                                active=Signal::derive(move || s.tab.get() == tab)
                                on_press=move |_| {
                                    s.tab.set(tab.into());
                                    if tab == "Preview" {
                                        s.command("preview", Value::Null);
                                    }
                                }
                            />
                        }
                    })
                    .collect_view()}
            </div>
            <div class="edit-controls">
                <ActionButton label="Cut" action="cut" />
                <ActionButton label="Copy" action="copy" />
                <ActionButton label="Paste" action="paste" />
                <span class="control-divider" />
                <Button label="Undo" on_press=move |_| s.undo() />
                <Button label="Redo" on_press=move |_| s.redo() />
            </div>
        </nav>
    }
    .into_any()
}
