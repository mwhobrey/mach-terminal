//! Live `shell_integration_status` wire contract checks behind `--features invoke-smoke`.
//!
//! On Windows, `tauri::test` + `MockRuntime` cannot be linked into a stable test binary
//! (`STATUS_ENTRYPOINT_NOT_FOUND`). Unix builds include the full body; Windows strict
//! invoke is handled in `scripts/invoke-smoke.mjs` via filtered in-crate lib tests.

#[cfg(all(feature = "invoke-smoke", not(target_os = "windows")))]
include!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/tests/shell_integration_invoke_smoke/body.rs"
));
