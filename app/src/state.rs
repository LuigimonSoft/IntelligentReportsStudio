use crate::domain::*;
use leptos::prelude::*;
use serde_json::{json, Value};
#[derive(Clone, Copy)]
pub struct Studio {
    pub commands: RwSignal<std::collections::VecDeque<(String, Value)>>,
    pub busy: RwSignal<bool>,
    pub project: RwSignal<Value>,
    pub tab: RwSignal<String>,
    pub data_tab: RwSignal<String>,
    pub selected: RwSignal<Vec<String>>,
    pub band: RwSignal<String>,
    pub language: RwSignal<String>,
    pub dark: RwSignal<bool>,
    pub zoom: RwSignal<f64>,
    pub zoom_auto: RwSignal<bool>,
    pub design_fit_initialized: RwSignal<bool>,
    pub units: RwSignal<String>,
    pub guides: RwSignal<String>,
    pub spacing: RwSignal<f64>,
    pub table: RwSignal<String>,
    pub relation: RwSignal<Value>,
    pub model_zoom: RwSignal<f64>,
    pub search: RwSignal<String>,
    pub filters_open: RwSignal<bool>,
    pub hidden_columns: RwSignal<Vec<String>>,
    pub record_filters: RwSignal<std::collections::BTreeMap<String, String>>,
    pub filter_groups: RwSignal<Vec<Value>>,
    pub filter_combination: RwSignal<String>,
    pub record_sort: RwSignal<Value>,
    pub record_page: RwSignal<usize>,
    pub page_size: RwSignal<usize>,
    pub record_count: RwSignal<usize>,
    pub record_columns: RwSignal<Vec<Value>>,
    pub record_refresh: RwSignal<usize>,
    pub history: RwSignal<Vec<Value>>,
    pub future: RwSignal<Vec<Value>>,
    pub dirty: RwSignal<bool>,
    pub message: RwSignal<String>,
    pub preview: RwSignal<Value>,
    pub preview_page: RwSignal<usize>,
    pub preview_zoom: RwSignal<f64>,
    pub preview_fit_width: RwSignal<bool>,
    pub preview_header: RwSignal<bool>,
    pub preview_footer: RwSignal<bool>,
    pub dialog: RwSignal<String>,
    pub draft: RwSignal<String>,
    pub original_record: RwSignal<Value>,
    pub clipboard: RwSignal<Value>,
    pub limit: RwSignal<usize>,
    pub scope: RwSignal<String>,
    pub formula_valid: RwSignal<bool>,
    pub inspector_tab: RwSignal<String>,
}
impl Default for Studio {
    fn default() -> Self {
        Self::new()
    }
}
impl Studio {
    pub fn new() -> Self {
        let project = if cfg!(debug_assertions) {
            example_project()
        } else {
            blank_project()
        };
        let first = bands(&project["report"])
            .first()
            .map(|b| text(b, "id"))
            .unwrap_or_default();
        let default_table = array(&project["datasets"])
            .into_iter()
            .find(|table| table["id"] == "invoice")
            .or_else(|| array(&project["datasets"]).first().cloned())
            .unwrap_or_default();
        let table = default_table["id"].as_str().unwrap_or("").to_owned();
        Self {
            commands: RwSignal::new(std::collections::VecDeque::new()),
            busy: RwSignal::new(false),
            project: RwSignal::new(project),
            tab: RwSignal::new("Design".into()),
            data_tab: RwSignal::new("Data model".into()),
            selected: RwSignal::new(vec![]),
            band: RwSignal::new(first),
            language: RwSignal::new("en".into()),
            dark: RwSignal::new(false),
            zoom: RwSignal::new(1.0),
            zoom_auto: RwSignal::new(true),
            design_fit_initialized: RwSignal::new(false),
            units: RwSignal::new("cm".into()),
            guides: RwSignal::new("dots".into()),
            spacing: RwSignal::new(0.5 / 2.54),
            table: RwSignal::new(table),
            relation: RwSignal::new(Value::Null),
            model_zoom: RwSignal::new(1.0),
            search: RwSignal::new(String::new()),
            filters_open: RwSignal::new(false),
            hidden_columns: RwSignal::new(vec![]),
            record_filters: RwSignal::new(std::collections::BTreeMap::new()),
            filter_groups: RwSignal::new(vec![]),
            filter_combination: RwSignal::new("and".into()),
            record_sort: RwSignal::new(Value::Null),
            record_page: RwSignal::new(1),
            page_size: RwSignal::new(100),
            record_count: RwSignal::new(0),
            record_columns: RwSignal::new(vec![]),
            record_refresh: RwSignal::new(0),
            history: RwSignal::new(vec![]),
            future: RwSignal::new(vec![]),
            dirty: RwSignal::new(false),
            message: RwSignal::new("Ready".into()),
            preview: RwSignal::new(Value::Null),
            preview_page: RwSignal::new(1),
            preview_zoom: RwSignal::new(0.66),
            preview_fit_width: RwSignal::new(false),
            preview_header: RwSignal::new(true),
            preview_footer: RwSignal::new(true),
            dialog: RwSignal::new(String::new()),
            draft: RwSignal::new(String::new()),
            original_record: RwSignal::new(Value::Null),
            clipboard: RwSignal::new(Value::Null),
            limit: RwSignal::new(200),
            formula_valid: RwSignal::new(false),
            scope: RwSignal::new("cell".into()),
            inspector_tab: RwSignal::new("Properties".into()),
        }
    }
    pub fn t(self, key: &str) -> String {
        for prefix in ["Group header", "Group footer"] {
            if let Some(suffix) = key.strip_prefix(&format!("{prefix} · ")) {
                return format!(
                    "{} · {}",
                    crate::i18n::translate(&self.language.get(), prefix),
                    suffix
                );
            }
        }
        crate::i18n::translate(&self.language.get(), key)
    }
    pub fn commit(self, next: Value) {
        let old = self.project.get_untracked();
        if old == next {
            return;
        }
        self.history.update(|h| {
            h.push(old);
            if h.len() > 100 {
                h.remove(0);
            }
        });
        self.future.set(vec![]);
        self.project.set(next);
        self.dirty.set(true);
        self.preview.set(Value::Null);
    }
    pub fn undo(self) {
        let mut h = self.history.get_untracked();
        if let Some(p) = h.pop() {
            self.future.update(|f| f.push(self.project.get_untracked()));
            self.history.set(h);
            self.project.set(p);
            self.dirty.set(true);
            self.preview.set(Value::Null);
        }
    }
    pub fn redo(self) {
        let mut f = self.future.get_untracked();
        if let Some(p) = f.pop() {
            self.history
                .update(|h| h.push(self.project.get_untracked()));
            self.future.set(f);
            self.project.set(p);
            self.dirty.set(true);
            self.preview.set(Value::Null);
        }
    }
    pub fn mutate(self, change: impl FnOnce(&mut Value)) {
        let mut next = self.project.get_untracked();
        change(&mut next);
        self.commit(next);
    }
    pub fn selected_element(self) -> Option<Value> {
        let ids = self.selected.get();
        bands(&self.project.get()["report"])
            .iter()
            .flat_map(|b| array(&b["elements"]))
            .find(|e| ids.contains(&text(e, "id")))
    }
    pub fn patch_band(self, key: &str, value: Value) {
        let id = self.band.get_untracked();
        self.patch_band_by_id(&id, key, value);
    }
    pub fn patch_band_by_id(self, id: &str, key: &str, value: Value) {
        if key == "height" {
            self.command("resize-section", json!({"band":id,"height":value}));
            return;
        }
        if read_only(&self.project.get_untracked()["report"], id) && key != "readOnly" {
            return;
        }
        self.mutate(|p| {
            if let Some(b) = band_mut(&mut p["report"], id) {
                if value.is_null() {
                    if let Some(properties) = b.as_object_mut() {
                        properties.remove(key);
                    }
                } else {
                    b[key] = value;
                }
            }
        });
    }
    pub fn selected_metric(self, key: &str) -> f64 {
        let Some(element) = self.selected_element() else {
            return 0.0;
        };
        let Some(group) = element["groupId"].as_str() else {
            return number(&element, key);
        };
        let items = bands(&self.project.get()["report"])
            .iter()
            .flat_map(|b| array(&b["elements"]))
            .filter(|e| e["groupId"].as_str() == Some(group))
            .collect::<Vec<_>>();
        let x = items
            .iter()
            .map(|e| number(e, "x"))
            .fold(f64::INFINITY, f64::min);
        let y = items
            .iter()
            .map(|e| number(e, "y"))
            .fold(f64::INFINITY, f64::min);
        match key {
            "x" => x,
            "y" => y,
            "width" => items
                .iter()
                .map(|e| number(e, "x") + number(e, "width") - x)
                .fold(0.0, f64::max),
            "height" => items
                .iter()
                .map(|e| number(e, "y") + number(e, "height") - y)
                .fold(0.0, f64::max),
            _ => number(&element, key),
        }
    }
    pub fn patch_element(self, key: &str, value: Value) {
        if ["x", "y", "width", "height"].contains(&key)
            && self
                .selected_element()
                .is_some_and(|e| e["table"].is_object())
        {
            self.command("table-geometry", json!({"property":key,"value":value}));
            return;
        }
        let ids = self.selected.get_untracked();
        self.mutate(|p| {
            let snapshot = p["report"].clone();
            for b in bands(&snapshot) {
                let id = text(&b, "id");
                if read_only(&snapshot, &id) {
                    continue;
                }
                if let Some(b) = band_mut(&mut p["report"], &id) {
                    for e in b["elements"].as_array_mut().into_iter().flatten() {
                        if ids.contains(&text(e, "id")) {
                            e[key] = value.clone();
                        }
                    }
                }
            }
        });
    }
    /// Serialize asynchronous document actions so rapid clicks never overwrite edits.
    pub fn command(self, action: &str, args: Value) {
        #[cfg(feature = "csr")]
        {
            if matches!(action, "new" | "open" | "open-recent")
                && self.dirty.get_untracked()
                && !crate::platform::confirm_discard(&self.t("Discard unsaved changes?"))
            {
                return;
            }
            let mut action = action.to_owned();
            let mut args = if args.is_object() { args } else { json!({}) };
            if matches!(
                action.as_str(),
                "add-subsection" | "remove-section" | "resize-section"
            ) && args.get("band").is_none()
            {
                args["band"] = json!(self.band.get_untracked());
            }
            if action == "style"
                && self
                    .selected_element()
                    .is_some_and(|e| e["table"].is_object())
            {
                action = "table-style".into();
                args = json!({"scope":self.scope.get_untracked(),"style":args});
            }
            if action == "apply-definition" && args["kind"] == "Record" {
                args["original"] = self.original_record.get_untracked();
            }
            if action == "preview" || action == "export-pdf" {
                args["header"] = json!(self.preview_header.get_untracked());
                args["footer"] = json!(self.preview_footer.get_untracked());
            }
            if action == "export-data" {
                args["filters"] = json!(self.record_filters.get_untracked());
                args["groups"] = json!(self.filter_groups.get_untracked());
                args["combination"] = json!(self.filter_combination.get_untracked());
                args["sort"] = self.record_sort.get_untracked();
                args["locale"] = json!(self.language.get_untracked());
                args["search"] = json!(self.search.get_untracked());
                args["limit"] = json!(self.limit.get_untracked());
                args["hiddenColumns"] = json!(self.hidden_columns.get_untracked());
            }
            if args.get("table").is_none()
                && ["query", "export-data", "apply-definition", "model-settings"]
                    .contains(&action.as_str())
            {
                args["table"] = json!(self.table.get_untracked());
            }
            self.commands
                .update(|queue| queue.push_back((action, args)));
            if self.busy.get_untracked() {
                return;
            }
            self.busy.set(true);
            leptos::task::spawn_local(async move {
                loop {
                    let mut queue = self.commands.get_untracked();
                    let Some((action, mut args)) = queue.pop_front() else {
                        break;
                    };
                    self.commands.set(queue);
                    if action == "export-pdf" && !self.preview.get_untracked().is_null() {
                        args["layout"] = self.preview.get_untracked();
                    }
                    let snapshot = self.project.get_untracked();
                    let request = json!({"action":action,"project":snapshot,"selected":self.selected.get_untracked(),"band":self.band.get_untracked(),"args":args});
                    match crate::platform::call(request).await {
                        Ok(result) => {
                            if let Some(project) = result.get("project") {
                                self.commit(project.clone());
                                if action == "new" || action == "open" || action == "open-recent" {
                                    self.dirty.set(false);
                                    self.history.set(vec![]);
                                    self.future.set(vec![]);
                                }
                                if !bands(&project["report"])
                                    .iter()
                                    .any(|b| text(b, "id") == self.band.get_untracked())
                                {
                                    self.band.set(
                                        bands(&project["report"])
                                            .first()
                                            .map(|b| text(b, "id"))
                                            .unwrap_or_default(),
                                    );
                                }
                                if !array(&project["datasets"])
                                    .iter()
                                    .any(|t| text(t, "id") == self.table.get_untracked())
                                {
                                    self.table.set(
                                        project["datasets"][0]["id"]
                                            .as_str()
                                            .unwrap_or("")
                                            .to_owned(),
                                    );
                                }
                            }
                            if let Some(id) = result["activeTable"].as_str() {
                                if array(&self.project.get_untracked()["datasets"])
                                    .iter()
                                    .any(|table| text(table, "id") == id)
                                {
                                    self.table.set(id.to_owned());
                                }
                            }
                            if let Some(id) = result["activeBand"].as_str() {
                                self.band.set(id.to_owned());
                                let id = id.to_owned();
                                request_animation_frame(move || {
                                    if let Some(section) = document()
                                        .get_element_by_id(&format!("report-section-{id}"))
                                    {
                                        section.scroll_into_view_with_bool(false);
                                    }
                                    if let Some(tab) =
                                        document().get_element_by_id(&format!("section-tab-{id}"))
                                    {
                                        tab.scroll_into_view_with_bool(false);
                                    }
                                });
                            }
                            if let Some(layout) = result.get("layout") {
                                self.preview.set(layout.clone());
                                self.preview_page.set(1);
                            }
                            if let Some(message) = result["message"].as_str() {
                                self.message.set(message.into());
                            }
                            if let Some(selected) = result["selected"].as_array() {
                                self.selected.set(
                                    selected
                                        .iter()
                                        .filter_map(|v| v.as_str().map(str::to_owned))
                                        .collect(),
                                );
                            }
                            if result["saved"] == true && snapshot == self.project.get_untracked() {
                                self.dirty.set(false);
                            }
                        }
                        Err(error) => self.message.set(error),
                    }
                }
                self.busy.set(false);
            });
        }
        #[cfg(not(feature = "csr"))]
        let _ = (action, args);
    }
    pub fn go_to_page(self, page: usize) {
        let count = array(&self.preview.get_untracked()["pages"]).len().max(1);
        let page = page.clamp(1, count);
        self.preview_page.set(page);
        #[cfg(feature = "csr")]
        if let Some(element) = document().get_element_by_id(&format!("pdf-page-{page}")) {
            element.scroll_into_view();
        }
    }
    pub fn measurement_scale(self) -> f64 {
        if self.units.get() == "cm" {
            2.54
        } else {
            1.0
        }
    }
    pub fn fit_design(self) {
        #[cfg(feature = "csr")]
        if let Ok(Some(viewport)) = document().query_selector(".canvas-scroll") {
            let width = number(&self.project.get_untracked()["report"]["page"], "width")
                * DESIGN_PIXELS_PER_INCH;
            if width > 0.0 {
                self.zoom_auto.set(true);
                self.zoom
                    .set(((viewport.client_width() as f64 - 180.0) / width).clamp(0.15, 3.0));
            }
        }
    }
    pub fn fit_preview_page(self) {
        self.preview_fit_width.set(false);
        #[cfg(feature = "csr")]
        if let Ok(Some(viewport)) = document().query_selector(".preview-scroll") {
            let project = self.project.get_untracked();
            let page = &project["report"]["page"];
            let width = number(page, "width") * 96.0;
            let height = number(page, "height") * 96.0;
            if width > 0.0 && height > 0.0 {
                self.preview_zoom.set(
                    ((viewport.client_width() as f64 - 48.0) / width)
                        .min((viewport.client_height() as f64 - 96.0) / height)
                        .clamp(0.15, 3.0),
                );
            }
        }
    }
    pub fn fit_preview(self) {
        self.preview_fit_width.set(true);
        #[cfg(feature = "csr")]
        if let Ok(Some(viewport)) = document().query_selector(".preview-scroll") {
            let width = number(&self.project.get_untracked()["report"]["page"], "width") * 96.0;
            if width > 0.0 {
                self.preview_zoom
                    .set(((viewport.client_width() as f64 - 48.0) / width).clamp(0.15, 3.0));
            }
        }
    }
    pub fn apply_editor_value(self, kind: &str, value: Value) {
        if kind == "Print settings" {
            self.mutate(|p| p["report"]["page"] = value);
            self.command("preview", Value::Null);
            self.fit_preview_page();
        } else if kind == "Import tables" {
            self.command("import-tables", value);
        } else if kind == "Query" {
            self.table
                .set(value["table"].as_str().unwrap_or_default().to_owned());
            self.limit
                .set(value["limit"].as_u64().unwrap_or(200).max(1) as usize);
            self.hidden_columns.set(vec![]);
        } else {
            self.command("apply-definition", json!({"kind":kind,"value":value}));
        }
    }
    /// Open the grouping editor for the detail that owns the selected section.
    pub fn show_grouping_for_section(self, section_id: &str) {
        fn contains(section: &Value, id: &str) -> bool {
            text(section, "id") == id
                || array(&section["sections"])
                    .iter()
                    .any(|child| contains(child, id))
        }
        let project = self.project.get_untracked();
        let details = array(&project["report"]["details"]);
        let detail = details
            .iter()
            .find(|detail| {
                ["band", "groupHeader", "groupFooter"]
                    .iter()
                    .any(|key| contains(&detail[*key], section_id))
                    || array(&detail["groups"]).iter().any(|group| {
                        ["header", "footer"]
                            .iter()
                            .any(|key| contains(&group[*key], section_id))
                    })
            })
            .or_else(|| details.first())
            .cloned()
            .unwrap_or_default();
        self.show_json(
            "Grouping",
            json!({
                "detailId": text(&detail, "id"),
                "legacyField": text(&detail, "groupBy"),
                "legacyDirection": detail["sortDirection"].as_str().unwrap_or("asc"),
                "groups": array(&detail["groups"])
            }),
        );
    }
    pub fn show_json(self, kind: &str, value: Value) {
        if matches!(
            kind,
            "Chart"
                | "Relationship"
                | "Add table"
                | "Data table"
                | "Print settings"
                | "Import tables"
                | "Grouping"
        ) {
            self.message.set(String::new());
        }
        self.dialog.set(kind.into());
        #[cfg(feature = "csr")]
        if crate::platform::editor_windows::native_desktop()
            && !crate::platform::editor_windows::editor_window()
        {
            let context = json!({"kind":kind,"title":self.t(if kind == "Query" { "Edit query" } else if kind == "Chart" { "Chart editor" } else if kind == "Data table" { "Edit table" } else if kind == "Relationship" { if crate::domain::array(&self.project.get_untracked()["relations"]).iter().any(|r| r["id"] == value["id"]) { "Edit relationship" } else { "Add relationship" } } else { kind }),"value":value,"project":self.project.get_untracked(),"language":self.language.get_untracked(),"dark":self.dark.get_untracked(),"table":self.table.get_untracked(),"selected":self.selected.get_untracked(),"band":self.band.get_untracked(),"original":self.original_record.get_untracked()});
            let kind = kind.to_owned();
            leptos::task::spawn_local(async move {
                match crate::platform::editor_windows::call(
                    "open_editor",
                    json!({"context":context}),
                )
                .await
                {
                    Ok(result) if !result.is_null() => self.apply_editor_value(&kind, result),
                    Ok(_) => {}
                    Err(error) => self.message.set(error),
                }
                self.dialog.set(String::new());
            });
            return;
        }
        self.draft
            .set(serde_json::to_string_pretty(&value).unwrap_or_default());
    }
}
pub fn studio() -> Studio {
    expect_context::<Studio>()
}
