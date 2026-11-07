use serde_json::Value;

/// Preview positions are transient; the final position creates one undoable edit.
#[derive(Clone, Debug)]
pub(super) struct TableDrag {
    pub id: String,
    pub pointer: i32,
    pub position: (f64, f64),
    origin: (f64, f64),
    pointer_start: (i32, i32),
    scroll_start: (i32, i32),
    zoom: f64,
}
impl TableDrag {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        id: String,
        pointer: i32,
        x: i32,
        y: i32,
        scroll_x: i32,
        scroll_y: i32,
        zoom: f64,
        origin: (f64, f64),
    ) -> Self {
        Self {
            id,
            pointer,
            position: origin,
            origin,
            pointer_start: (x, y),
            scroll_start: (scroll_x, scroll_y),
            zoom: zoom.max(0.01),
        }
    }
    pub fn update(&mut self, x: i32, y: i32, scroll_x: i32, scroll_y: i32) {
        self.position = (
            (self.origin.0
                + f64::from(x - self.pointer_start.0 + scroll_x - self.scroll_start.0) / self.zoom)
                .max(0.0),
            (self.origin.1
                + f64::from(y - self.pointer_start.1 + scroll_y - self.scroll_start.1) / self.zoom)
                .max(0.0),
        );
    }
    pub fn moved(&self) -> bool {
        (self.position.0 - self.origin.0).abs() > 0.5
            || (self.position.1 - self.origin.1).abs() > 0.5
    }
}

pub(super) fn model_position(
    project: &Value,
    id: &str,
    index: usize,
    drag: Option<&TableDrag>,
) -> (f64, f64) {
    if let Some(drag) = drag.filter(|drag| drag.id == id) {
        return drag.position;
    }
    let settings = &project["dataModel"]["tables"][id];
    (
        settings["x"]
            .as_f64()
            .unwrap_or((180 + (index % 3) * 300) as f64),
        settings["y"]
            .as_f64()
            .unwrap_or((50 + (index / 3) * 340) as f64),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn movement_scales_with_zoom_and_scroll_and_clamps_to_canvas() {
        let mut drag = TableDrag::new("table".into(), 1, 100, 100, 0, 0, 0.5, (180.0, 50.0));
        drag.update(140, 130, 20, 10);
        assert_eq!(drag.position, (300.0, 130.0));
        drag.update(-500, -500, 0, 0);
        assert_eq!(drag.position, (0.0, 0.0));
        assert!(drag.moved());
    }
}
