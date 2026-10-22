use tauri::{
    webview::NewWindowResponse, AppHandle, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

use crate::{
    native_prefs::{read_stored_theme, same_origin, theme_bootstrap_script},
    shell::{open_external, WINDOW_LABEL},
};

/// The server origin chosen by Rust at startup, never a renderer-provided URL.
pub struct ChangesWindowOrigin(pub Url);

fn changes_url(origin: &Url, cwd: &str, target_id: Option<&str>, view_id: Option<&str>) -> Result<Url, String> {
    if cwd.trim().is_empty() || cwd.contains('\0') || cwd.len() > 32_768 {
        return Err("A project folder is required to open Changes".into());
    }
    let mut url = origin.clone();
    url.set_path("/changes");
    url.set_query(None);
    url.set_fragment(None);
    url.query_pairs_mut().append_pair("cwd", cwd);
    if let Some(target_id) = target_id.filter(|id| !id.is_empty()) {
        if target_id.len() > 256 || target_id.contains('\0') {
            return Err("Invalid Changes feedback target".into());
        }
        url.query_pairs_mut().append_pair("targetId", target_id);
    }
    if let Some(view_id) = view_id {
        if view_id.len() != 36 || !view_id.bytes().enumerate().all(|(index, byte)| {
            if [8, 13, 18, 23].contains(&index) { byte == b'-' } else { byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte) }
        }) {
            return Err("Invalid Changes view identifier".into());
        }
        url.query_pairs_mut().append_pair("viewId", view_id);
    }
    Ok(url)
}

fn is_changes_navigation(candidate: &Url, target: &Url) -> bool {
    same_origin(candidate, target)
        && candidate.path() == "/changes"
        && candidate.username().is_empty()
        && candidate.password().is_none()
}

fn validate_changes_caller(label: &str, current: &Url, origin: &Url) -> Result<(), String> {
    if label != WINDOW_LABEL {
        return Err("Changes windows can only be opened from the main window".into());
    }
    if !same_origin(current, origin) || current.path() != "/" || !current.username().is_empty() || current.password().is_some() {
        return Err("Changes windows require the trusted app origin".into());
    }
    Ok(())
}

/// Creates only the dedicated Changes page. General webview creation remains
/// unavailable to the renderer, and the desktop API token never enters the URL.
#[tauri::command]
pub async fn open_changes_window(
    app: AppHandle,
    window: WebviewWindow,
    cwd: String,
    target_id: Option<String>,
    view_id: Option<String>,
    origin: tauri::State<'_, ChangesWindowOrigin>,
) -> Result<(), String> {
    let current = window.url().map_err(|error| error.to_string())?;
    validate_changes_caller(window.label(), &current, &origin.0)?;
    let target = changes_url(&origin.0, &cwd, target_id.as_deref(), view_id.as_deref())?;
    let navigation_target = target.clone();
    let label = format!("changes-{}", crate::generate_random_hex()?);
    let mut builder = WebviewWindowBuilder::new(&app, label, WebviewUrl::External(target))
        .title("Changes — Pilaude")
        .inner_size(1080.0, 800.0)
        .min_inner_size(480.0, 400.0)
        .resizable(true)
        .disable_drag_drop_handler()
        .on_navigation(move |url| {
            if is_changes_navigation(url, &navigation_target) {
                true
            } else {
                // Other app pages are blocked here. Only genuinely external
                // links may leave via the existing OS-handler whitelist.
                if !same_origin(url, &navigation_target) {
                    open_external(url);
                }
                false
            }
        })
        .on_new_window(|url, _features| {
            open_external(&url);
            NewWindowResponse::Deny
        });

    // Reuse the main window's stored-theme bootstrap, including its rule that
    // existing localStorage wins. Keep native decorations for OS window controls.
    if let Some(theme) = read_stored_theme(&app) {
        builder = builder
            .theme(Some(if theme == "dark" {
                tauri::Theme::Dark
            } else {
                tauri::Theme::Light
            }))
            .initialization_script(theme_bootstrap_script(theme));
    }
    let window = builder.build().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}

/// No label argument: a Changes page can close only its own native window.
#[tauri::command]
pub async fn close_changes_window(window: WebviewWindow) -> Result<(), String> {
    if !window.label().starts_with("changes-") {
        return Err("Only a Changes window can close itself with this command".into());
    }
    window.close().map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::{changes_url, is_changes_navigation, validate_changes_caller};
    use tauri::Url;

    #[test]
    fn changes_url_encodes_cwd_as_one_query_value_on_the_server_origin() {
        let origin = Url::parse("http://127.0.0.1:38471/old?token=never#fragment").unwrap();
        let cwd = "C:\\src\\R&D\\用户 #1?x=2";
        let target = changes_url(&origin, cwd, None, None).unwrap();
        assert_eq!(target.origin(), origin.origin());
        assert_eq!(target.path(), "/changes");
        assert_eq!(target.fragment(), None);
        assert_eq!(
            target.query_pairs().collect::<Vec<_>>(),
            vec![("cwd".into(), cwd.into())]
        );
    }

    #[test]
    fn feedback_target_is_optional_and_travels_only_as_encoded_data() {
        let origin = Url::parse("http://127.0.0.1:38471").unwrap();
        let target = changes_url(&origin, r"C:\src", Some("main&cwd=else#where"), None).unwrap();
        assert_eq!(
            target.query_pairs().collect::<Vec<_>>(),
            vec![
                ("cwd".into(), r"C:\src".into()),
                ("targetId".into(), "main&cwd=else#where".into())
            ],
        );
        assert_eq!(target.fragment(), None);
    }

    #[test]
    fn changes_url_rejects_missing_or_invalid_folders() {
        let origin = Url::parse("http://127.0.0.1:30141").unwrap();
        for cwd in ["", "   ", "C:\\src\0ignored"] {
            assert!(changes_url(&origin, cwd, None, None).is_err());
        }
        assert!(changes_url(&origin, &"a".repeat(32_769), None, None).is_err());
        assert!(changes_url(&origin, "C:\\src", Some(&"x".repeat(257)), None).is_err());
    }

    #[test]
    fn only_main_at_the_trusted_origin_root_can_open_changes() {
        let origin = Url::parse("http://127.0.0.1:30141/").unwrap();
        assert!(validate_changes_caller("main", &origin, &origin).is_ok());
        for label in ["conversation-123", "changes-123", "other"] {
            assert!(validate_changes_caller(label, &origin, &origin).is_err());
        }
        for url in [
            "http://127.0.0.1:30142/", "http://localhost:30141/",
            "https://127.0.0.1:30141/", "http://127.0.0.1:30141/changes",
            "http://user@127.0.0.1:30141/", "https://example.com/",
        ] {
            assert!(validate_changes_caller("main", &Url::parse(url).unwrap(), &origin).is_err());
        }
    }

    #[test]
    fn view_identifier_is_bounded_opaque_data_not_a_url_or_state_payload() {
        let origin = Url::parse("http://127.0.0.1:38471").unwrap();
        let id = "31b2ff61-9167-42ca-b241-8f95792acdf4";
        let target = changes_url(&origin, r"C:\src", Some("draft-A"), Some(id)).unwrap();
        assert_eq!(target.query_pairs().find(|(key, _)| key == "viewId").unwrap().1, id);
        for value in ["", "../api/home", "https://example.com", "31b2ff61-9167-42ca-b241-8f95792acdfG", &id.to_uppercase(), &id[..35], &format!("{id}0")] {
            assert!(changes_url(&origin, r"C:\src", None, Some(value)).is_err());
        }
    }

    #[test]
    fn navigation_stays_on_changes_at_the_exact_server_origin() {
        let target = Url::parse("http://127.0.0.1:38471/changes?cwd=C%3A%5Csrc").unwrap();
        assert!(is_changes_navigation(&target, &target));
        assert!(is_changes_navigation(
            &Url::parse("http://127.0.0.1:38471/changes?cwd=other#file").unwrap(),
            &target,
        ));
        for url in [
            "http://127.0.0.1:30141/changes",
            "http://localhost:38471/changes",
            "https://127.0.0.1:38471/changes",
            "http://127.0.0.1:38471/",
            "http://127.0.0.1:38471/api/home",
            "http://127.0.0.1:38471/changes/extra",
            "http://user@127.0.0.1:38471/changes",
            "https://example.com/changes",
            "about:blank",
            "javascript:alert(1)",
            "file:///changes",
        ] {
            assert!(
                !is_changes_navigation(&Url::parse(url).unwrap(), &target),
                "{url}"
            );
        }
    }
}
