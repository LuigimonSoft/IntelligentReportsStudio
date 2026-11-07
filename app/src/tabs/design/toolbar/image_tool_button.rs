use crate::shared::controls::ActionButton;
use leptos::prelude::*;
#[component]
pub fn ImageToolButton() -> impl IntoView {
    view! { <ActionButton label="Image" action="add-image" /> }
}
