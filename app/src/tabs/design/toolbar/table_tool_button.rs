use crate::shared::controls::ActionButton;
use leptos::prelude::*;
#[component]
pub fn TableToolButton() -> impl IntoView {
    view! { <ActionButton label="Table" action="add-table" /> }
}
