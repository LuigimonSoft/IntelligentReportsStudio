//! Reusable guidance for an empty workspace or query result.
use crate::{shared::icons::Icon, state::studio};
use leptos::prelude::*;
#[component]
pub fn EmptyState(title: &'static str, description: &'static str, #[prop(default="data")] icon: &'static str, children: Children) -> impl IntoView {
    let s = studio();
    view! { <div class="workspace-empty-state" role="status">
        <Icon name=icon size=28 />
        <strong>{move || s.t(title)}</strong>
        <p>{move || s.t(description)}</p>
        <div class="workspace-empty-actions">{children()}</div>
    </div> }
}
