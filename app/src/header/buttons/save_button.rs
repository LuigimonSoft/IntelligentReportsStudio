use crate::shared::controls::ActionButton;
use leptos::prelude::*;
#[component]
pub fn SaveButton() -> impl IntoView {
    view! { <ActionButton label="Save" action="save" primary=false /> }
}
