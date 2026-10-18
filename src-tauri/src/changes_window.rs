use tauri::{
    webview::NewWindowResponse, AppHandle, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

use crate::{
    native_prefs::{read_stored_theme, same_origin, theme_bootstrap_script},
    shell::{open_external, WINDOW_LABEL},
};

/// The server origin chosen by Rust at startup, never a renderer-provided URL.
pub struct ChangesWindowOrigin(pub Url);

fn changes_url(origin: &Url, cwd: &str, target_id: Option<&str>) -> Result<Url, String> {
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
    Ok(url)
}

fn is_changes_navigation(candidate: &Url, target: &Url) -> bool {
    same_origin(candidate, target)
        && candidate.path() == "/changes"
        && candidate.username().is_empty()
        && candidate.password().is_none()
}

/// Creates only the dedicated Changes page. General webview creation remains
/// unavailable to the renderer, and the desktop API token never enters the URL.
#[tauri::command]
pub async fn open_changes_window(
    app: AppHandle,
    window: WebviewWindow,
    cwd: String,
    target_id: Option<String>,
    origin: tauri::State<'_, ChangesWindowOrigin>,
) -> Result<(), String> {
    if window.label() != WINDOW_LABEL {
        return Err("Changes windows can only be opened from the main window".into());
    }
    let target = changes_url(&origin.0, &cwd, target_id.as_deref())?;
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
    use super::{changes_url, is_changes_navigation};
    use tauri::Url;

    #[test]
    fn changes_url_encodes_cwd_as_one_query_value_on_the_server_origin() {
        let origin = Url::parse("http://127.0.0.1:38471/old?token=never#fragment").unwrap();
        let cwd = "C:\\src\\R&D\\用户 #1?x=2";
        let target = changes_url(&origin, cwd, None).unwrap();
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
        let target = changes_url(&origin, r"C:\src", Some("main&cwd=else#where")).unwrap();
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
            assert!(changes_url(&origin, cwd, None).is_err());
        }
        assert!(changes_url(&origin, &"a".repeat(32_769), None).is_err());
        assert!(changes_url(&origin, "C:\\src", Some(&"x".repeat(257))).is_err());
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
