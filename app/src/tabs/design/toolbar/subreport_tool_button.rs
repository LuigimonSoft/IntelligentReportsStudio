use crate::shared::controls::ActionButton;
use leptos::prelude::*;
#[component]
pub fn SubreportToolButton() -> impl IntoView {
    view! { <ActionButton label="Subreport" action="add-subreport" /> }
}
