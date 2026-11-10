//! Restore and persist workspace preferences without storing report content.
use crate::{platform, state::Studio};
use leptos::prelude::*;
use serde_json::{json, Value};

fn snapshot(s: Studio) -> Value {
    json!({"language":s.language.get(), "dark":s.dark.get(), "units":s.units.get(),
        "guides":s.guides.get(), "spacing":s.spacing.get(), "snapGrid":s.snap_grid.get(),
        "showMargins":s.show_margins.get(), "zoom":s.zoom.get(), "zoomAuto":s.zoom_auto.get(),
        "modelZoom":s.model_zoom.get(), "designLeftWidth":s.design_left_width.get(),
        "designRightWidth":s.design_right_width.get(), "dataLeftWidth":s.data_left_width.get(),
        "dataRightWidth":s.data_right_width.get(), "previewLeftWidth":s.preview_left_width.get(),
        "previewRightWidth":s.preview_right_width.get()})
}

pub fn install(s: Studio) {
    let ready = RwSignal::new(false);
    let busy = RwSignal::new(false);
    let pending = RwSignal::new(false);
    let initial = snapshot(s);
    leptos::task::spawn_local(async move {
        match platform::call(json!({"action":"preferences-load"})).await {
            Ok(result) => {
                let prefs = &result["preferences"];
                // Preserve changes the user made while preferences were loading.
                macro_rules! restore {
                    ($key:literal, $signal:expr, $method:ident, $validate:expr) => {
                        if $signal.get_untracked() == initial[$key].$method().unwrap_or_default() {
                            if let Some(value) = prefs[$key].$method().filter($validate) {
                                $signal.set(value.into());
                            }
                        }
                    };
                }
                restore!("language", s.language, as_str, |v: &&str| ["en", "es", "fr"].contains(v));
                restore!("dark", s.dark, as_bool, |_: &bool| true);
                restore!("units", s.units, as_str, |v: &&str| ["cm", "mm", "in", "pt"].contains(v));
                restore!("guides", s.guides, as_str, |v: &&str| ["dots", "lines", "none"].contains(v));
                restore!("snapGrid", s.snap_grid, as_bool, |_: &bool| true);
                restore!("showMargins", s.show_margins, as_bool, |_: &bool| true);
                restore!("spacing", s.spacing, as_f64, |v: &f64| v.is_finite() && (0.01..=2.0).contains(v));
                restore!("modelZoom", s.model_zoom, as_f64, |v: &f64| v.is_finite() && (0.25..=2.0).contains(v));
                restore!("designLeftWidth", s.design_left_width, as_f64, |v: &f64| (180.0..=500.0).contains(v));
                restore!("designRightWidth", s.design_right_width, as_f64, |v: &f64| (180.0..=500.0).contains(v));
                restore!("dataLeftWidth", s.data_left_width, as_f64, |v: &f64| (180.0..=500.0).contains(v));
                restore!("dataRightWidth", s.data_right_width, as_f64, |v: &f64| (180.0..=500.0).contains(v));
                restore!("previewLeftWidth", s.preview_left_width, as_f64, |v: &f64| (140.0..=360.0).contains(v));
                restore!("previewRightWidth", s.preview_right_width, as_f64, |v: &f64| (180.0..=500.0).contains(v));
                // The designer may calculate its initial fit while the file is loading.
                if s.zoom_auto.get_untracked() == initial["zoomAuto"].as_bool().unwrap_or(true) {
                    if prefs["zoomAuto"] == false {
                        if let Some(zoom) = prefs["zoom"].as_f64().filter(|n| n.is_finite() && (0.15..=3.0).contains(n)) {
                            s.design_fit_initialized.set(true);
                            s.zoom_auto.set(false);
                            s.zoom.set(zoom);
                        }
                    }
                }
                ready.set(true);
            }
            Err(error) => s.message.set(format!("{}: {}", s.t("Preferences could not be loaded"), error)),
        }
    });
    Effect::new(move |_| {
        let is_ready = ready.get();
        let preferences = snapshot(s);
        if !is_ready { return; }
        pending.set(true);
        if busy.get_untracked() { return; }
        busy.set(true);
        leptos::task::spawn_local(async move {
            let mut current = preferences;
            loop {
                pending.set(false);
                if let Err(error) = platform::call(json!({"action":"preferences-save","args":{"preferences":current}})).await {
                    s.message.set(format!("{}: {}", s.t("Preferences could not be saved"), error));
                }
                if !pending.get_untracked() { break; }
                current = snapshot_untracked(s);
            }
            busy.set(false);
        });
    });
}

fn snapshot_untracked(s: Studio) -> Value {
    leptos::prelude::untrack(|| snapshot(s))
}
