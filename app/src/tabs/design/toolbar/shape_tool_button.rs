use crate::shared::controls::ActionButton;
use leptos::prelude::*;
#[component]
pub fn ShapeToolButton() -> impl IntoView {
    view! { <ActionButton label="Shape" action="add-shape" /> }
}
