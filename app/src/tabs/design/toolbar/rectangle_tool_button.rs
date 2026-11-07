use crate::shared::controls::ActionButton;
use leptos::prelude::*;
#[component]
pub fn RectangleToolButton() -> impl IntoView {
    view! { <ActionButton label="Rectangle" action="add-rectangle" /> }
}
