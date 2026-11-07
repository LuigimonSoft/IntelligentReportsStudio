use crate::shared::controls::ActionButton;
use leptos::prelude::*;
#[component]
pub fn ExportPdfButton() -> impl IntoView {
    view! { <ActionButton label="Export PDF" action="export-pdf" primary=true /> }
}
