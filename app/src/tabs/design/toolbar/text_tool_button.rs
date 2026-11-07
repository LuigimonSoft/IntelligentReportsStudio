use crate::shared::controls::ActionButton;
use leptos::prelude::*;
#[component]
pub fn TextToolButton() -> impl IntoView {
    view! { <ActionButton label="Text" action="add-text" /> }
}
