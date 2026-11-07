use crate::shared::controls::ActionButton;
use leptos::prelude::*;
#[component]
pub fn LineToolButton() -> impl IntoView {
    view! { <ActionButton label="Line" action="add-line" /> }
}
