pub mod fixed_rulers;
use crate::{domain::*, state::studio};
use leptos::prelude::*;

/// Physical ruler divisions use millimeters or eighths of an inch.
#[derive(Clone, Debug)]
pub struct RulerTick {
    pub inches: f64,
    pub major: bool,
    pub medium: bool,
    pub label: String,
}
pub fn ruler_ticks(length: f64, unit: &str) -> Vec<RulerTick> {
    let (units_per_inch, step, divisions) = if unit == "cm" {
        (2.54, 0.1, 10)
    } else {
        (1.0, 0.125, 8)
    };
    (0..=((length * units_per_inch / step).floor() as usize))
        .map(|index| RulerTick {
            inches: index as f64 * step / units_per_inch,
            major: index % divisions == 0,
            medium: index % (divisions / 2) == 0,
            label: if index % divisions == 0 {
                format!("{:.0}", index as f64 * step)
            } else {
                String::new()
            },
        })
        .collect()
}
#[component]
pub fn HorizontalRuler() -> impl IntoView {
    let s = studio();
    view! {
        <div
            class="horizontal-ruler"
            role="img"
            aria-label=move || {
                s.t(if s.units.get() == "cm" { "Ruler in centimeters" } else { "Ruler in inches" })
            }
            data-unit=move || s.units.get()
            data-layout={
                let layout = crate::platform::layout_styles::LayoutStyle::new();
                move || {
                    layout
                        .apply({
                            format!(
                                "width:{}px",
                                number(&s.project.get()["report"]["page"], "width")
                                    * DESIGN_PIXELS_PER_INCH * s.zoom.get(),
                            )
                        })
                }
            }
        >
            {move || {
                ruler_ticks(number(&s.project.get()["report"]["page"], "width"), &s.units.get())
                    .into_iter()
                    .map(|tick| {
                        view! {
                            <span
                                class="ruler-tick"
                                class:major=tick.major
                                class:medium=tick.medium
                                data-layout=crate::platform::layout_styles::LayoutStyle::new()
                                    .apply(
                                        format!(
                                            "left:{}px",
                                            tick.inches * DESIGN_PIXELS_PER_INCH * s.zoom.get(),
                                        ),
                                    )
                            >
                                {tick.major.then(|| view! { <b>{tick.label}</b> })}
                            </span>
                        }
                    })
                    .collect_view()
            }}
        </div>
    }
}
#[component]
pub fn VerticalRuler() -> impl IntoView {
    let s = studio();
    view! {
        <div class="vertical-ruler" data-unit=move || s.units.get()>
            {move || {
                ruler_ticks(design_height(&s.project.get()["report"]), &s.units.get())
                    .into_iter()
                    .map(|tick| {
                        view! {
                            <span
                                class="vertical-tick"
                                class:major=tick.major
                                data-layout=crate::platform::layout_styles::LayoutStyle::new()
                                    .apply(
                                        format!(
                                            "top:{}px",
                                            tick.inches * DESIGN_PIXELS_PER_INCH * s.zoom.get(),
                                        ),
                                    )
                            >
                                {tick.label}
                            </span>
                        }
                    })
                    .collect_view()
            }}
        </div>
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn inches_use_eighths_and_half_inch_marks() {
        let ticks = ruler_ticks(2.0, "in");
        assert_eq!(ticks.len(), 17);
        assert_eq!(ticks[1].inches, 0.125);
        assert!(ticks[4].medium);
        assert!(ticks[8].major);
        assert_eq!(ticks[8].label, "1");
    }
    #[test]
    fn centimeters_use_millimeters() {
        let ticks = ruler_ticks(1.0, "cm");
        assert_eq!(ticks.len(), 26);
        assert!((ticks[10].inches - 1.0 / 2.54).abs() < 1e-9);
        assert_eq!(ticks[10].label, "1");
    }
}
