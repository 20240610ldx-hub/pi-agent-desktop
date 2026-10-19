use tauri::{
    webview::NewWindowResponse, AppHandle, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

use crate::{
    native_prefs::{
        is_inline_frame_document, read_stored_theme, same_origin, theme_bootstrap_script,
    },
    shell::{open_external, WINDOW_LABEL},
};

/// Chosen at Rust startup. Renderer URLs and credentials never select this origin.
pub struct ConversationWindowOrigin(pub Url);

const CONVERSATION_MARKER: &str = r#"Object.defineProperty(window, '__PILAUDE_CONVERSATION_WINDOW__', {value:true, writable:false, configurable:false});"#;

fn is_local_origin(url: &Url) -> bool {
    url.scheme() == "http"
        && url.host_str() == Some("127.0.0.1")
        && url.username().is_empty()
        && url.password().is_none()
}

pub(crate) fn conversation_url(origin: &Url, session_id: &str) -> Result<Url, String> {
    if !is_local_origin(origin) {
        return Err("Conversation windows require the local app server".into());
    }
    if session_id.trim().is_empty()
        || session_id.len() > 256
        || session_id.contains(['\0', '\r', '\n'])
    {
        return Err("Invalid conversation identifier".into());
    }
    let mut url = origin.clone();
    url.set_path("/");
    url.set_query(None);
    url.set_fragment(None);
    url.query_pairs_mut().append_pair("session", session_id);
    Ok(url)
}

pub(crate) fn is_conversation_navigation(candidate: &Url, target: &Url) -> bool {
    is_local_origin(target)
        && same_origin(candidate, target)
        && candidate.path() == "/"
        && candidate.username().is_empty()
        && candidate.password().is_none()
}

pub(crate) fn is_destination_caller(label: &str, current: &Url, origin: &Url) -> bool {
    (label == WINDOW_LABEL
        || label
            .strip_prefix("conversation-")
            .is_some_and(|suffix| !suffix.is_empty()))
        && is_conversation_navigation(current, origin)
}

pub(crate) fn authorize_destination_window(
    window: &WebviewWindow,
    origin: &Url,
) -> Result<(), String> {
    let current = window.url().map_err(|error| error.to_string())?;
    if !is_destination_caller(window.label(), &current, origin) {
        return Err("Conversation destinations require a trusted app window".into());
    }
    Ok(())
}

/// A decorated app window: closing it destroys only this view, not the main app.
#[tauri::command]
pub async fn open_conversation_window(
    app: AppHandle,
    window: WebviewWindow,
    session_id: String,
    origin: tauri::State<'_, ConversationWindowOrigin>,
) -> Result<(), String> {
    authorize_destination_window(&window, &origin.0)?;
    let target = conversation_url(&origin.0, &session_id)?;
    let navigation_target = target.clone();
    let label = format!("conversation-{}", crate::generate_random_hex()?);
    let mut builder = WebviewWindowBuilder::new(&app, label, WebviewUrl::External(target))
        .title("Conversation — Pilaude")
        .inner_size(1080.0, 800.0)
        .min_inner_size(480.0, 400.0)
        .decorations(true)
        .resizable(true)
        .disable_drag_drop_handler()
        .initialization_script(CONVERSATION_MARKER)
        .on_navigation(move |url| {
            if is_conversation_navigation(url, &navigation_target) || is_inline_frame_document(url)
            {
                true
            } else {
                if !same_origin(url, &navigation_target) {
                    open_external(url);
                }
                false
            }
        })
        .on_new_window(|url, _features| {
            open_external(&url);
            NewWindowResponse::Deny
        })
        .on_document_title_changed(|window, title| {
            let _ = window.set_title(&title);
        });
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
    window.set_focus().map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::{conversation_url, is_conversation_navigation, is_destination_caller};
    use tauri::Url;

    #[test]
    fn initial_url_is_origin_pinned_and_carries_only_encoded_session_data() {
        let origin = Url::parse("http://127.0.0.1:38471/old?token=private#secret").unwrap();
        let id = "session&token=not-a-token?#测试";
        let target = conversation_url(&origin, id).unwrap();
        assert_eq!(target.origin(), origin.origin());
        assert_eq!(target.path(), "/");
        assert_eq!(target.fragment(), None);
        assert_eq!(
            target.query_pairs().collect::<Vec<_>>(),
            vec![("session".into(), id.into())]
        );
    }

    #[test]
    fn invalid_session_or_nonlocal_origin_is_rejected_before_window_creation() {
        let local = Url::parse("http://127.0.0.1:38471").unwrap();
        for id in ["", "  ", "id\0bad", "id\nother", "id\rother"] {
            assert!(conversation_url(&local, id).is_err(), "{id:?}");
        }
        assert!(conversation_url(&local, &"a".repeat(257)).is_err());
        for origin in [
            "https://example.com",
            "http://user@127.0.0.1:38471",
            "http://localhost:38471",
            "file:///app",
        ] {
            assert!(
                conversation_url(&Url::parse(origin).unwrap(), "fixture").is_err(),
                "{origin}"
            );
        }
    }

    #[test]
    fn navigation_allows_only_the_root_at_the_exact_origin() {
        let target = Url::parse("http://127.0.0.1:38471/?session=fixture").unwrap();
        for valid in [
            "http://127.0.0.1:38471/",
            "http://127.0.0.1:38471/?session=other",
            "http://127.0.0.1:38471/?view=new",
        ] {
            assert!(
                is_conversation_navigation(&Url::parse(valid).unwrap(), &target),
                "{valid}"
            );
        }
        for invalid in [
            "http://127.0.0.1:30141/?session=fixture",
            "http://localhost:38471/",
            "https://127.0.0.1:38471/",
            "http://127.0.0.1:38471/api/home",
            "http://127.0.0.1:38471/changes",
            "http://user@127.0.0.1:38471/",
            "https://example.com/",
            "javascript:alert(1)",
            "file:///app",
        ] {
            assert!(
                !is_conversation_navigation(&Url::parse(invalid).unwrap(), &target),
                "{invalid}"
            );
        }
    }

    #[test]
    fn destination_commands_authorize_the_window_label_and_server_origin_together() {
        let origin = Url::parse("http://127.0.0.1:38471/").unwrap();
        assert!(is_destination_caller("main", &origin, &origin));
        assert!(is_destination_caller(
            "conversation-abc123",
            &origin,
            &origin
        ));
        for label in ["changes-abc123", "other", "conversation-"] {
            assert!(!is_destination_caller(label, &origin, &origin), "{label}");
        }
        assert!(!is_destination_caller(
            "main",
            &Url::parse("http://127.0.0.1:30141/").unwrap(),
            &origin
        ));
        assert!(!is_destination_caller(
            "conversation-abc123",
            &Url::parse("http://127.0.0.1:38471/api/home").unwrap(),
            &origin
        ));
    }
}
