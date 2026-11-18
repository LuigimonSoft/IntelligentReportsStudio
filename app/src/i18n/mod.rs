use serde_json::Value;
use std::sync::LazyLock;
static EN: LazyLock<Value> =
    LazyLock::new(|| serde_json::from_str(include_str!("en.json")).expect("valid English catalog"));
static ES: LazyLock<Value> =
    LazyLock::new(|| serde_json::from_str(include_str!("es.json")).expect("valid Spanish catalog"));
static FR: LazyLock<Value> =
    LazyLock::new(|| serde_json::from_str(include_str!("fr.json")).expect("valid French catalog"));
pub fn translate(language: &str, key: &str) -> String {
    let catalog = match language {
        "es" => &*ES,
        "fr" => &*FR,
        _ => &*EN,
    };
    catalog[key].as_str().unwrap_or(key).to_owned()
}

/// Map an operating-system or browser locale to an available translation.
pub fn language_for_locale(locale: Option<&str>) -> &'static str {
    let language = locale
        .unwrap_or("")
        .split(['-', '_', '.', '@'])
        .next()
        .unwrap_or("");
    if language.eq_ignore_ascii_case("es") {
        "es"
    } else if language.eq_ignore_ascii_case("fr") {
        "fr"
    } else {
        "en"
    }
}

/// Prefer a valid explicit selection; otherwise use the operating-system locale.
pub fn resolve_language(saved: Option<&str>, system: Option<&str>) -> (&'static str, bool) {
    match saved {
        Some("en") => ("en", true),
        Some("es") => ("es", true),
        Some("fr") => ("fr", true),
        _ => (language_for_locale(system), false),
    }
}

/// Browser fallback while the native operating-system locale is loading.
pub fn initial_language() -> &'static str {
    #[cfg(feature = "csr")]
    {
        let locale = web_sys::window().and_then(|window| window.navigator().language());
        return language_for_locale(locale.as_deref());
    }
    #[cfg(not(feature = "csr"))]
    {
        "en"
    }
}

#[cfg(test)]
mod language_tests {
    use super::{language_for_locale, resolve_language};
    #[test]
    fn resolves_supported_locales_and_falls_back_to_english() {
        for locale in ["es", "es-MX", "ES_es.UTF-8"] {
            assert_eq!(language_for_locale(Some(locale)), "es");
        }
        for locale in ["fr", "fr-CA", "FR_fr"] {
            assert_eq!(language_for_locale(Some(locale)), "fr");
        }
        for locale in ["en-US", "de-DE", "", "C.UTF-8"] {
            assert_eq!(language_for_locale(Some(locale)), "en");
        }
        assert_eq!(language_for_locale(None), "en");
        assert_eq!(resolve_language(Some("fr"), Some("es-MX")), ("fr", true));
        assert_eq!(resolve_language(None, Some("es-MX")), ("es", false));
        assert_eq!(
            resolve_language(Some("invalid"), Some("fr-CA")),
            ("fr", false)
        );
        assert_eq!(resolve_language(None, Some("de-DE")), ("en", false));
    }
}
