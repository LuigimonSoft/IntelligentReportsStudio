pub mod left_sidebar;
pub mod report_area;
pub mod right_sidebar;
pub mod sections_bar;
pub mod toolbar;
use leptos::prelude::*;
#[component]
pub fn DesignTab() -> impl IntoView {
    view! {
        <div class="design-tab">
            <toolbar::DesignToolbar />
            <div class="design-workspace">
                <left_sidebar::FieldsSidebar />
                <report_area::ReportArea />
                <right_sidebar::PropertiesSidebar />
            </div>
            <sections_bar::SectionsBar />
        </div>
    }
    .into_any()
}
