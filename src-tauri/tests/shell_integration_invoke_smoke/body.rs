// Included only on non-Windows when `invoke-smoke` is enabled (see ../shell_integration_invoke_smoke.rs).
// Kept under `tests/shell_integration_invoke_smoke/` so Cargo does not compile this file as its own
// integration test crate on Windows (where `tauri::test` is unavailable).

use mach_terminal_lib::models::{AppSettings, ShellIntegrationSettings};
use mach_terminal_lib::settings::resolve_settings_json_path;
use mach_terminal_lib::shell_integration::shell_integration_status;
use serde_json::Value;
use std::ffi::OsString;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

static INVOKE_SHELL_STATUS_TEST_LOCK: Mutex<()> = Mutex::new(());

struct SettingsFileGuard {
    path: PathBuf,
    original_bytes: Option<Vec<u8>>,
}

impl SettingsFileGuard {
    fn new(path: PathBuf) -> Self {
        let original_bytes = fs::read(&path).ok();
        Self { path, original_bytes }
    }

    fn write(&self, settings: &AppSettings) {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).expect("create settings parent");
        }
        let bytes = serde_json::to_vec_pretty(settings).expect("serialize settings fixture");
        fs::write(&self.path, bytes).expect("write settings fixture");
    }
}

impl Drop for SettingsFileGuard {
    fn drop(&mut self) {
        match &self.original_bytes {
            Some(original) => {
                let _ = fs::write(&self.path, original);
            }
            None => {
                let _ = fs::remove_file(&self.path);
            }
        }
    }
}

struct EnvVarGuard {
    key: &'static str,
    previous: Option<OsString>,
}

impl EnvVarGuard {
    fn set_empty(key: &'static str) -> Self {
        let previous = std::env::var_os(key);
        unsafe { std::env::set_var(key, "") };
        Self { key, previous }
    }
}

impl Drop for EnvVarGuard {
    fn drop(&mut self) {
        match &self.previous {
            Some(value) => unsafe { std::env::set_var(self.key, value) },
            None => unsafe { std::env::remove_var(self.key) },
        }
    }
}

fn build_test_app() -> tauri::App<tauri::test::MockRuntime> {
    tauri::test::mock_builder()
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("build mock tauri app")
}

fn seed_settings(
    app: &tauri::App<tauri::test::MockRuntime>,
    shell_integration: ShellIntegrationSettings,
) -> SettingsFileGuard {
    let settings_path = resolve_settings_json_path(app.handle()).expect("resolve settings path");
    let guard = SettingsFileGuard::new(settings_path);
    let mut settings = AppSettings::default();
    settings.shell_integration = shell_integration;
    guard.write(&settings);
    guard
}

fn shell_status_json(app: &tauri::App<tauri::test::MockRuntime>) -> Value {
    let status = shell_integration_status(app.handle().clone()).expect("shell_integration_status");
    serde_json::to_value(&status).expect("serialize ShellIntegrationStatus")
}

fn shell_row<'a>(status: &'a Value, shell_kind: &str) -> &'a Value {
    status
        .get("shells")
        .and_then(Value::as_array)
        .expect("shell rows")
        .iter()
        .find(|row| row.get("shellKind").and_then(Value::as_str) == Some(shell_kind))
        .expect("shell row by kind")
}

fn assert_top_level_shape(status: &Value) {
    assert!(status.get("scriptVersion").is_some_and(Value::is_number));
    assert!(
        status
            .get("shellDir")
            .and_then(Value::as_str)
            .is_some_and(|value| !value.is_empty())
    );
    assert!(status.get("shells").is_some_and(Value::is_array));
}

fn assert_allowed_health(row: &Value) {
    assert!(matches!(
        row.get("health").and_then(Value::as_str),
        Some("healthy" | "stale" | "missing" | "error")
    ));
}

fn assert_capabilities(row: &Value, supports_profile_override: bool) {
    assert_eq!(
        row.get("capabilities")
            .and_then(|capabilities| capabilities.get("supportsBackupRestore"))
            .and_then(Value::as_bool),
        Some(true)
    );
    assert_eq!(
        row.get("capabilities")
            .and_then(|capabilities| capabilities.get("supportsProfileOverride"))
            .and_then(Value::as_bool),
        Some(supports_profile_override)
    );
}

#[test]
fn invoke_shell_status_reports_top_level_shape_order_and_cross_shell_capabilities() {
    let _lock = INVOKE_SHELL_STATUS_TEST_LOCK.lock().expect("lock");
    let app = build_test_app();
    let _settings_guard = seed_settings(&app, ShellIntegrationSettings::default());
    let _path_guard = EnvVarGuard::set_empty("PATH");

    let status = shell_status_json(&app);
    assert_top_level_shape(&status);
    let rows = status
        .get("shells")
        .and_then(Value::as_array)
        .expect("shells array");
    let kinds: Vec<&str> = rows
        .iter()
        .map(|row| row.get("shellKind").and_then(Value::as_str).expect("shell kind"))
        .collect();
    assert_eq!(kinds, vec!["pwsh", "bash", "zsh"]);

    let pwsh = shell_row(&status, "pwsh");
    let bash = shell_row(&status, "bash");
    let zsh = shell_row(&status, "zsh");
    assert_capabilities(pwsh, true);
    assert_capabilities(bash, false);
    assert_capabilities(zsh, false);
    assert_allowed_health(pwsh);
    assert_allowed_health(bash);
    assert_allowed_health(zsh);
    for row in rows {
        assert!(row.get("markerPresent").is_some_and(Value::is_boolean));
        assert!(row.get("profileResolved").is_some_and(Value::is_boolean));
        assert!(row.get("capabilities").is_some_and(Value::is_object));
    }
    assert!(matches!(
        bash.get("profilePathSource").and_then(Value::as_str),
        Some("auto") | None
    ));
    assert!(matches!(
        zsh.get("profilePathSource").and_then(Value::as_str),
        Some("auto") | None
    ));
}

#[test]
fn invoke_shell_status_surfaces_invalid_override_row_contract() {
    let _lock = INVOKE_SHELL_STATUS_TEST_LOCK.lock().expect("lock");
    let app = build_test_app();
    let _settings_guard = seed_settings(
        &app,
        ShellIntegrationSettings {
            pwsh_profile_override: Some("C:\\Users\\mike\\Documents\\profile.txt".to_string()),
            onboarding_install_prompt_seen: false,
        },
    );

    let status = shell_status_json(&app);
    let pwsh = shell_row(&status, "pwsh");
    assert_eq!(pwsh.get("profileResolved").and_then(Value::as_bool), Some(false));
    assert_eq!(pwsh.get("health").and_then(Value::as_str), Some("error"));
    assert_eq!(pwsh.get("profilePathSource").and_then(Value::as_str), Some("override"));
    assert!(pwsh.get("backupCount").is_some_and(Value::is_null));
    assert!(
        pwsh.get("error")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .contains("must end with .ps1")
    );
}

#[test]
fn invoke_shell_status_preserves_null_wire_shape_for_unresolved_auto() {
    let _lock = INVOKE_SHELL_STATUS_TEST_LOCK.lock().expect("lock");
    let _path_guard = EnvVarGuard::set_empty("PATH");
    let app = build_test_app();
    let _settings_guard = seed_settings(&app, ShellIntegrationSettings::default());

    let status = shell_status_json(&app);
    let pwsh = shell_row(&status, "pwsh");
    assert_eq!(pwsh.get("profileResolved").and_then(Value::as_bool), Some(false));
    assert_eq!(pwsh.get("health").and_then(Value::as_str), Some("error"));
    assert!(pwsh.get("profilePath").is_some_and(Value::is_null));
    assert!(pwsh.get("backupCount").is_some_and(Value::is_null));
    assert!(pwsh.get("profilePathSource").is_some_and(Value::is_null));
    assert!(pwsh.get("error").is_some_and(Value::is_string));
}
