use crate::conversation_window::{authorize_destination_window, ConversationWindowOrigin};
use serde::Serialize;
use std::{
    ffi::OsString,
    path::{Path, PathBuf},
    process::{Command, Stdio},
};
use tauri::WebviewWindow;

/// Candidate paths are local and absolute. Windows script shims are deliberately
/// excluded: Command on a .cmd file would bring cmd.exe parsing back into play.
fn editor_candidates(platform: &str, vars: impl Fn(&str) -> Option<OsString>) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if platform == "windows" {
        for (key, suffix) in [
            ("LOCALAPPDATA", "Programs/Microsoft VS Code/Code.exe"),
            ("ProgramFiles", "Microsoft VS Code/Code.exe"),
            ("ProgramFiles(x86)", "Microsoft VS Code/Code.exe"),
        ] {
            if let Some(base) = vars(key)
                .map(PathBuf::from)
                .filter(|path| path.is_absolute())
            {
                candidates.push(base.join(suffix));
            }
        }
    } else if platform == "macos" {
        candidates.push(PathBuf::from(
            "/Applications/Visual Studio Code.app/Contents/MacOS/Electron",
        ));
        if let Some(home) = vars("HOME")
            .map(PathBuf::from)
            .filter(|path| path.is_absolute())
        {
            candidates
                .push(home.join("Applications/Visual Studio Code.app/Contents/MacOS/Electron"));
        }
    }
    if let Some(paths) = vars("PATH") {
        for directory in std::env::split_paths(&paths).filter(|path| path.is_absolute()) {
            if platform == "windows" {
                candidates.push(directory.join("Code.exe"));
                if directory
                    .file_name()
                    .is_some_and(|part| part.eq_ignore_ascii_case("bin"))
                {
                    if let Some(parent) = directory.parent() {
                        candidates.push(parent.join("Code.exe"));
                    }
                }
            } else if platform == "macos" {
                // PATH normally points at VS Code's bin/code shell script. Use
                // only its actual app executable when that conventional bundle exists.
                if let Some(bundle) = directory.ancestors().find(|path| {
                    path.file_name()
                        .is_some_and(|part| part == "Visual Studio Code.app")
                }) {
                    candidates.push(bundle.join("Contents/MacOS/Electron"));
                }
            } else {
                candidates.push(directory.join("code"));
            }
        }
    }
    candidates.dedup();
    candidates
}
fn editor_args(cwd: &Path) -> Vec<OsString> {
    vec![
        "--new-window".into(),
        "--".into(),
        cwd.as_os_str().to_owned(),
    ]
}
fn validate_project_cwd(cwd: &str) -> Result<PathBuf, String> {
    if cwd.trim().is_empty()
        || cwd.len() > 32_768
        || cwd.contains(['\0', '\r', '\n'])
        || !Path::new(cwd).is_absolute()
    {
        return Err("An absolute project folder is required".into());
    }
    let target = dunce::canonicalize(cwd)
        .map_err(|error| format!("Project folder is unavailable: {error}"))?;
    if !target.is_dir() {
        return Err("The selected project is not a directory".into());
    }
    Ok(target)
}
fn find_editor(
    candidates: impl IntoIterator<Item = PathBuf>,
    usable: impl Fn(&Path) -> bool,
) -> Option<PathBuf> {
    candidates.into_iter().find(|candidate| usable(candidate))
}
fn is_executable(path: &Path) -> bool {
    let Ok(metadata) = path.metadata() else {
        return false;
    };
    if !metadata.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        true
    }
}
fn installed_editor() -> Option<PathBuf> {
    find_editor(
        editor_candidates(std::env::consts::OS, |key| std::env::var_os(key)),
        is_executable,
    )
}
fn editor_command(executable: &Path, cwd: &Path) -> Command {
    let mut command = Command::new(executable);
    command
        .args(editor_args(cwd))
        .current_dir(cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(crate::CREATE_NO_WINDOW);
    }
    command
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationDestinations {
    new_window: bool,
    vs_code: EditorAvailability,
}
#[derive(Serialize)]
pub struct EditorAvailability {
    supported: bool,
    reason: Option<&'static str>,
}

#[tauri::command]
pub fn conversation_destinations(
    window: WebviewWindow,
    origin: tauri::State<'_, ConversationWindowOrigin>,
) -> Result<ConversationDestinations, String> {
    authorize_destination_window(&window, &origin.0)?;
    let supported = installed_editor().is_some();
    Ok(ConversationDestinations {
        new_window: true,
        vs_code: EditorAvailability {
            supported,
            reason: if supported {
                None
            } else {
                Some("not-installed")
            },
        },
    })
}

#[tauri::command]
pub fn open_project_in_vscode(
    window: WebviewWindow,
    cwd: String,
    origin: tauri::State<'_, ConversationWindowOrigin>,
) -> Result<(), String> {
    authorize_destination_window(&window, &origin.0)?;
    let cwd = validate_project_cwd(&cwd)?;
    let executable =
        installed_editor().ok_or("VS Code was not found in standard install or PATH locations")?;
    let mut child = editor_command(&executable, &cwd)
        .spawn()
        .map_err(|error| format!("Could not open the project in VS Code: {error}"))?;
    // Reap a CLI launcher after it hands off to an existing editor instance.
    std::thread::spawn(move || {
        let _ = child.wait();
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{collections::HashMap, fs};

    #[test]
    fn project_folder_and_metacharacters_are_a_single_native_argument() {
        let cwd = Path::new(r"C:\src\R&D\用户 #1?x=2");
        assert_eq!(
            editor_args(cwd),
            vec![
                OsString::from("--new-window"),
                OsString::from("--"),
                cwd.as_os_str().to_owned()
            ]
        );
        let executable = Path::new(r"C:\Program Files\Microsoft VS Code\Code.exe");
        let command = editor_command(executable, cwd);
        assert_eq!(command.get_program(), executable.as_os_str());
        assert_eq!(
            command.get_args().collect::<Vec<_>>(),
            editor_args(cwd)
                .iter()
                .map(OsString::as_os_str)
                .collect::<Vec<_>>()
        );
    }

    #[cfg(windows)]
    #[test]
    fn windows_discovery_accepts_only_absolute_executables_not_cmd_or_relative_path_entries() {
        let vars = HashMap::from([
            (
                "LOCALAPPDATA",
                OsString::from(r"C:\Users\fixture\AppData\Local"),
            ),
            ("ProgramFiles", OsString::from(r"C:\Program Files")),
            (
                "PATH",
                OsString::from(r".;relative;C:\custom\bin;C:\Program Files\Microsoft VS Code\bin"),
            ),
        ]);
        let candidates = editor_candidates("windows", |key| vars.get(key).cloned());
        assert!(candidates.contains(&PathBuf::from(
            r"C:\Users\fixture\AppData\Local\Programs\Microsoft VS Code\Code.exe"
        )));
        assert!(candidates.contains(&PathBuf::from(
            r"C:\Program Files\Microsoft VS Code\Code.exe"
        )));
        assert!(candidates.contains(&PathBuf::from(r"C:\custom\bin\Code.exe")));
        assert!(candidates.iter().all(|path| path.is_absolute()
            && path
                .extension()
                .is_some_and(|ext| ext.eq_ignore_ascii_case("exe"))));
        assert!(!candidates
            .iter()
            .any(|path| path.to_string_lossy().contains("relative")));
    }

    #[test]
    fn macos_path_bundle_is_detected_without_running_its_shell_shim() {
        let bundle = std::env::temp_dir().join("Visual Studio Code.app");
        let bin = bundle.join("Contents/Resources/app/bin");
        let paths = std::env::join_paths([bin]).unwrap();
        let candidates = editor_candidates("macos", |key| (key == "PATH").then(|| paths.clone()));
        assert!(candidates.contains(&bundle.join("Contents/MacOS/Electron")));
        assert!(!candidates
            .iter()
            .any(|path| path.file_name().is_some_and(|name| name == "code")));
    }

    #[cfg(unix)]
    #[test]
    fn linux_path_discovery_ignores_relative_directories() {
        let paths = std::env::join_paths(["/usr/local/bin", ".", "relative", "/usr/bin"]).unwrap();
        let candidates = editor_candidates("linux", |key| (key == "PATH").then(|| paths.clone()));
        assert_eq!(
            candidates,
            vec![
                PathBuf::from("/usr/local/bin/code"),
                PathBuf::from("/usr/bin/code")
            ]
        );
    }

    #[test]
    fn executable_probe_checks_candidates_and_never_launches_them() {
        let candidates = vec![
            PathBuf::from("/missing/code"),
            PathBuf::from("/installed/code"),
            PathBuf::from("/other/code"),
        ];
        let selected = find_editor(candidates, |path| path == Path::new("/installed/code"));
        assert_eq!(selected, Some(PathBuf::from("/installed/code")));
        assert_eq!(
            find_editor(Vec::<PathBuf>::new(), |_| panic!(
                "empty candidates must not be probed"
            )),
            None
        );
    }

    #[test]
    fn selected_project_must_be_an_existing_absolute_directory() {
        let root = std::env::temp_dir().join(format!(
            "pilaude-editor-test-{}",
            crate::generate_random_hex().unwrap()
        ));
        fs::create_dir(&root).unwrap();
        fs::write(root.join("file.txt"), "fixture").unwrap();
        assert_eq!(
            validate_project_cwd(root.to_str().unwrap()).unwrap(),
            dunce::canonicalize(&root).unwrap()
        );
        for invalid in [
            "",
            " ",
            "relative/project",
            "https://example.com",
            "file:///C:/project",
            "--extensionDevelopmentPath=evil",
            "C:\\src\0ignored",
            "C:\\src\nignored",
        ] {
            assert!(validate_project_cwd(invalid).is_err(), "{invalid:?}");
        }
        assert!(validate_project_cwd(root.join("file.txt").to_str().unwrap()).is_err());
        assert!(validate_project_cwd(root.join("missing").to_str().unwrap()).is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
