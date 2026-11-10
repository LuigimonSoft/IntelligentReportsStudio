pub mod left_sidebar;
pub mod report_area;
pub mod right_sidebar;
pub mod sections_bar;
pub mod toolbar;
use leptos::prelude::*;
use crate::{state::studio, shared::controls::panel_splitter::PanelSplitter};
#[component]
pub fn DesignTab() -> impl IntoView {
    let s = studio();
    view! {
        <div class="design-tab">
            <toolbar::DesignToolbar />
            <div class="design-workspace" data-layout={ let layout = crate::platform::layout_styles::LayoutStyle::new(); move || layout.apply(format!("--panel-left:{}px;--panel-right:{}px",s.design_left_width.get(),s.design_right_width.get())) }>
                <left_sidebar::FieldsSidebar />
                <PanelSplitter width=s.design_left_width label="Resize fields panel" default_width=310.0 />
                <report_area::ReportArea />
                <PanelSplitter width=s.design_right_width label="Resize properties panel" right=true default_width=344.0 />
                <right_sidebar::PropertiesSidebar />
            </div>
            <sections_bar::SectionsBar />
        </div>
    }
    .into_any()
}
