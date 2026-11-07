mod subreport_tool_button;
use subreport_tool_button::SubreportToolButton;
mod text_tool_button;
use text_tool_button::TextToolButton;
mod image_tool_button;
use image_tool_button::ImageToolButton;
mod line_tool_button;
use line_tool_button::LineToolButton;
mod rectangle_tool_button;
use rectangle_tool_button::RectangleToolButton;
mod table_tool_button;
use table_tool_button::TableToolButton;
mod chart_tool_button;
use chart_tool_button::ChartToolButton;
mod shape_tool_button;
use shape_tool_button::ShapeToolButton;

use crate::{shared::controls::*, state::studio};
use leptos::prelude::*;
use serde_json::json;
#[component]
pub fn DesignToolbar() -> impl IntoView {
    let s = studio();
    view! {
        <div class="design-toolbar" role="toolbar" aria-label="Design tools">
            <TextToolButton />
            <ImageToolButton />
            <LineToolButton />
            <RectangleToolButton />
            <TableToolButton />
            <ChartToolButton />
            <ShapeToolButton />
            <SubreportToolButton />
            <Button
                label="Formula"
                on_press=move |_| { s.show_json("Formula", json!({"name":"","expression":""})) }
            />
            <Button label="Group data" on_press=move |_| {
                s.show_grouping_for_section(&s.band.get_untracked());
            } />
            <span class="control-divider" />
            <Button
                label="Zoom out"
                on_press=move |_| {
                    s.zoom_auto.set(false);
                    s.zoom.update(|v| *v = (*v - 0.05).max(0.15));
                }
            />
            <select
                aria-label="Zoom"
                class="zoom-selector"
                prop:value=move || format!("{:.2}", s.zoom.get())
                on:change=move |e| {
                    s.zoom_auto.set(false);
                    s.zoom.set(event_target_value(&e).parse().unwrap_or(1.0));
                }
            >
                <option value=move || {
                    format!("{:.2}", s.zoom.get())
                }>
                    {move || {
                        if s.zoom_auto.get() {
                            s.t("Fit")
                        } else {
                            format!("{:.0}%", s.zoom.get() * 100.0)
                        }
                    }}
                </option>
                {[0.5, 0.75, 1.0, 1.25, 1.5]
                    .into_iter()
                    .map(|value| {
                        view! {
                            <option value=format!(
                                "{value:.2}",
                            )>{format!("{:.0}%", value * 100.0)}</option>
                        }
                    })
                    .collect_view()}
            </select>
            <Button
                label="Zoom in"
                on_press=move |_| {
                    s.zoom_auto.set(false);
                    s.zoom.update(|v| *v = (*v + 0.05).min(3.0));
                }
            />
            <span class="control-divider" />
            <Button label="Fit" on_press=move |_| s.fit_design() />
            <span class="control-divider" />
            <label class="ruler-unit-control">
                <crate::shared::icons::Icon name="ruler" size=16 />
                <select aria-label="Units" on:change=move |e| s.units.set(event_target_value(&e))>
                    <option value="cm">{move || s.t("Centimeters")}</option>
                    <option value="in">{move || s.t("Inches")}</option>
                </select>
            </label>
            <span class="control-divider" />
            <div class="guide-controls">
                <crate::shared::icons::Icon name="guides" size=16 />
                <select aria-label="Guides" on:change=move |e| s.guides.set(event_target_value(&e))>
                    <option value="dots">{move || s.t("Guide dots")}</option>
                    <option value="lines">{move || s.t("Dotted lines")}</option>
                    <option value="none">{move || s.t("No guides")}</option>
                </select>
                <span>{move || s.t("Spacing")}</span>
                <select
                    aria-label="Guide spacing"
                    prop:value=move || s.spacing.get().to_string()
                    disabled=move || s.guides.get() == "none"
                    on:change=move |e| s.spacing.set(event_target_value(&e).parse().unwrap_or(0.25))
                >
                    <option value=move || {
                        s.spacing.get().to_string()
                    }>
                        {move || {
                            format!(
                                "{} {}",
                                format!(
                                    "{:.4}",
                                    s.spacing.get() * if s.units.get() == "cm" { 2.54 } else { 1.0 },
                                )
                                    .trim_end_matches('0')
                                    .trim_end_matches('.'),
                                if s.units.get() == "cm" { "cm" } else { "″" },
                            )
                        }}
                    </option>
                    {move || {
                        let cm = s.units.get() == "cm";
                        let steps = if cm {
                            vec![0.1, 0.2, 0.25, 0.5, 1.0, 2.0, 5.0]
                        } else {
                            vec![0.0625, 0.125, 0.25, 0.5, 1.0, 2.0]
                        };
                        steps
                            .into_iter()
                            .map(|v| {
                                view! {
                                    <option value=(v / if cm { 2.54 } else { 1.0 })
                                        .to_string()>
                                        {format!("{} {}", v, if cm { "cm" } else { "″" })}
                                    </option>
                                }
                            })
                            .collect_view()
                    }}
                </select>
            </div>
        </div>
    }
}
