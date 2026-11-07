use crate::domain::*;
#[cfg(feature = "csr")]
use crate::state::studio;
use leptos::prelude::*;
#[cfg(feature = "csr")]
use serde_json::json;
use serde_json::Value;
#[component]
pub fn ReportElementView(element: Value) -> impl IntoView {
    #[cfg(feature = "csr")]
    let s = studio();
    let kind = text(&element, "type");
    let svg = RwSignal::new(String::new());
    #[cfg(feature = "csr")]
    let chart = element.clone();
    if kind == "chart" {
        #[cfg(feature = "csr")]
        Effect::new(move |_| {
            let project = s.project.get();
            let chart = chart.clone();
            leptos::task::spawn_local(async move {
                if let Ok(value) = crate::platform::call(
                    json!({"action":"chart-svg","project":project,"args":{"element":chart}}),
                )
                .await
                {
                    svg.set(value["svg"].as_str().unwrap_or("").to_owned());
                }
            });
        });
    }
    match kind.as_str() {
        "image" => view! { <img alt="" draggable="false" src=text(&element, "src") /> }.into_any(),
        "chart" => view! { <div class="chart-svg" inner_html=move || svg.get()></div> }.into_any(),
        "line" => view! {
            <div
                class="element-line"
                data-layout=crate::platform::layout_styles::LayoutStyle::new()
                    .apply(format!("border-color:{}", text(&element["style"], "color")))
            ></div>
        }
        .into_any(),
        "box" => view! {
            <div
                class="element-box"
                data-layout=crate::platform::layout_styles::LayoutStyle::new()
                    .apply(
                        format!(
                            "background:{};border:{}px solid {}",
                            text(&element["style"], "color"),
                            number(&element, "borderWidth"),
                            text(&element, "borderColor"),
                        ),
                    )
            ></div>
        }
        .into_any(),
        "shape" => {
            let shape = text(&element, "shape");
            view! {
                <svg
                    class="element-box shape-vector"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    fill=text(&element["style"], "color")
                    stroke=text(&element, "borderColor")
                    stroke-width=number(&element, "borderWidth")
                >

                    {match shape.as_str() {
                        "circle" => {
                            view! {
                                <ellipse
                                    cx="50"
                                    cy="50"
                                    rx="49"
                                    ry="49"
                                    vector-effect="non-scaling-stroke"
                                />
                            }
                                .into_any()
                        }
                        "triangle" => {
                            view! {
                                <polygon
                                    points="50,1 99,99 1,99"
                                    vector-effect="non-scaling-stroke"
                                />
                            }
                                .into_any()
                        }
                        "diamond" => {
                            view! {
                                <polygon
                                    points="50,1 99,50 50,99 1,50"
                                    vector-effect="non-scaling-stroke"
                                />
                            }
                                .into_any()
                        }
                        _ => {
                            view! {
                                <rect
                                    x="1"
                                    y="1"
                                    width="98"
                                    height="98"
                                    vector-effect="non-scaling-stroke"
                                />
                            }
                                .into_any()
                        }
                    }}
                </svg>
            }.into_any()
        }
        _ => view! { <span class="element-text">{text(&element, "text").replace("\\n", "\n")}</span> }.into_any(),
    }
}
