#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(windows)]
    if let Some(code) = pi_agent_desktop_lib::credential_helper::run_cli() {
        std::process::exit(code);
    }
    pi_agent_desktop_lib::run();
}
