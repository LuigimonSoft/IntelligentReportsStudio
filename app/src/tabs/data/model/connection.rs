//! Pointer-driven column connections work in both browsers and native WebViews.
use crate::{
    domain::{array, text},
    state::Studio,
};
use leptos::prelude::*;
use serde_json::{json, Value};

#[derive(Clone)]
pub struct Connection {
    pub from: Value,
    pub start: (f64, f64),
    pub cursor: (f64, f64),
    pub pointer: i32,
    pub moved: bool,
}

pub fn new_relationship_id(s: Studio) -> String {
    let relations = array(&s.project.get_untracked()["relations"]);
    let mut index = 1;
    while relations
        .iter()
        .any(|relation| relation["id"] == format!("relation-{index}"))
    {
        index += 1;
    }
    format!("relation-{index}")
}

pub fn open_relationship(s: Studio, from: Value, to: Value) {
    if from["dataset"] == to["dataset"]
        || text(&from, "field").is_empty()
        || text(&to, "field").is_empty()
    {
        return;
    }
    s.show_json(
        "Relationship",
        json!({
            "id":new_relationship_id(s),
            "from":from,"to":to,"cardinality":"1:n"
        }),
    );
}
