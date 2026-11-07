/// Pointer movement in document units, including scroll-induced changes to the paper's position.
#[derive(Clone, Copy, Debug)]
pub(super) struct DragGesture {
    pub pointer: i32,
    start: (f64, f64),
    paper: (f64, f64),
    scale: f64,
}
impl DragGesture {
    pub fn new(pointer: i32, start: (f64, f64), paper: (f64, f64), scale: f64) -> Self {
        Self {
            pointer,
            start,
            paper,
            scale: scale.max(0.01),
        }
    }
    pub fn delta(self, pointer: (f64, f64), paper: (f64, f64)) -> (f64, f64) {
        (
            (pointer.0 - self.start.0 - (paper.0 - self.paper.0)) / self.scale,
            (pointer.1 - self.start.1 - (paper.1 - self.paper.1)) / self.scale,
        )
    }
    pub fn crossed_threshold(self, pointer: (f64, f64)) -> bool {
        (pointer.0 - self.start.0).hypot(pointer.1 - self.start.1) > 3.0
    }
}

/// Reject releases outside the visible paper instead of moving to a stale section.
pub(super) fn contains_point(bounds: (f64, f64, f64, f64), point: (f64, f64)) -> bool {
    point.0 >= bounds.0 && point.0 < bounds.2 && point.1 >= bounds.1 && point.1 < bounds.3
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn movement_tracks_zoom_scroll_and_pointer_offset() {
        let gesture = DragGesture::new(7, (200.0, 300.0), (100.0, 150.0), 50.0);
        assert_eq!(gesture.delta((225.0, 325.0), (90.0, 130.0)), (0.7, 0.9));
        assert_eq!(gesture.delta((200.0, 300.0), (100.0, 150.0)), (0.0, 0.0));
        assert!(!gesture.crossed_threshold((202.0, 301.0)));
        assert!(gesture.crossed_threshold((205.0, 300.0)));
        let half = DragGesture::new(1, (200.0, 300.0), (100.0, 150.0), 25.0);
        assert_eq!(half.delta((225.0, 325.0), (90.0, 130.0)), (1.4, 1.8));
    }
    #[test]
    fn outside_releases_are_cancelled_and_boundaries_are_unambiguous() {
        let bounds = (100.0, 100.0, 300.0, 400.0);
        assert!(contains_point(bounds, (100.0, 100.0)));
        assert!(!contains_point(bounds, (300.0, 200.0)));
        assert!(!contains_point(bounds, (200.0, 400.0)));
        assert!(!contains_point(bounds, (99.0, 200.0)));
    }
}
