use crate::shared::controls::ActionButton;
use leptos::prelude::*;
#[component]
pub fn OpenButton() -> impl IntoView {
    view! { <ActionButton label="Open" action="open" primary=false /> }
}
