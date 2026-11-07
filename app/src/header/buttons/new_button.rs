use crate::shared::controls::ActionButton;
use leptos::prelude::*;
#[component]
pub fn NewButton() -> impl IntoView {
    view! { <ActionButton label="New" action="new" primary=false /> }
}
