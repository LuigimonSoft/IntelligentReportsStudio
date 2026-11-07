use crate::shared::controls::ActionButton;
use leptos::prelude::*;
#[component]
pub fn ChartToolButton() -> impl IntoView {
    view! { <ActionButton label="Chart" action="add-chart" /> }
}
