//! Windows-only environment helpers for PTY spawn.
//!
//! GUI apps inherit a frozen PATH from Explorer at logon. Child shells should see
//! the current User + Machine registry PATH (like Windows Terminal per-tab refresh).

use std::collections::{HashMap, HashSet};
use winreg::enums::*;
use winreg::RegKey;
use windows::core::PCWSTR;
use windows::Win32::System::Environment::ExpandEnvironmentStringsW;

const MACHINE_ENV_KEY: &str = r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment";
const USER_ENV_KEY: &str = "Environment";
const PATH_VAR: &str = "Path";

/// Merge machine and user PATH segments: machine first, then user; dedupe case-insensitively.
pub fn merge_path_strings(machine: &str, user: &str) -> String {
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for segment in machine.split(';').chain(user.split(';')) {
        let trimmed = segment.trim();
        if trimmed.is_empty() {
            continue;
        }
        let key = trimmed.to_ascii_lowercase();
        if seen.insert(key) {
            out.push(trimmed.to_string());
        }
    }
    out.join(";")
}

fn read_path_from_hive(hive: &RegKey, subkey: &str) -> Option<String> {
    hive.open_subkey(subkey)
        .ok()
        .and_then(|key| key.get_value::<String, _>(PATH_VAR).ok())
}

/// Read merged Machine + User PATH from the registry (not yet expanded).
pub fn raw_merged_path_from_registry() -> Result<String, String> {
    let machine = read_path_from_hive(&RegKey::predef(HKEY_LOCAL_MACHINE), MACHINE_ENV_KEY)
        .unwrap_or_default();
    let user = read_path_from_hive(&RegKey::predef(HKEY_CURRENT_USER), USER_ENV_KEY).unwrap_or_default();
    if machine.is_empty() && user.is_empty() {
        return Err("registry PATH is empty in both machine and user hives".to_string());
    }
    Ok(merge_path_strings(&machine, &user))
}

/// Expand `%VAR%` tokens using the calling process environment (ExpandEnvironmentStringsW).
pub fn expand_environment_string(src: &str) -> Result<String, String> {
    let wide: Vec<u16> = src.encode_utf16().chain(std::iter::once(0)).collect();
    let mut buffer = vec![0u16; 32_768];
    let written = unsafe {
        ExpandEnvironmentStringsW(PCWSTR(wide.as_ptr()), Some(buffer.as_mut_slice()))
    };
    if written == 0 {
        return Err("ExpandEnvironmentStringsW failed".to_string());
    }
    let len = (written as usize).min(buffer.len()).saturating_sub(1);
    Ok(String::from_utf16_lossy(&buffer[..len]))
}

/// Merged, expanded PATH suitable for child process env.
pub fn merged_path_from_registry() -> Result<String, String> {
    let raw = raw_merged_path_from_registry()?;
    expand_environment_string(&raw)
}

/// Build the environment map passed to a PTY child: process env, registry PATH override, profile overlay.
pub fn build_child_environment(profile_env: HashMap<String, String>) -> HashMap<String, String> {
    let mut env: HashMap<String, String> = std::env::vars().collect();
    match merged_path_from_registry() {
        Ok(path) => {
            env.insert("PATH".to_string(), path);
        }
        Err(error) => {
            tracing::warn!("failed to refresh PATH from registry for PTY spawn: {error}");
        }
    }
    for (key, value) in profile_env {
        env.insert(key, value);
    }
    env
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn merge_path_strings_order_and_dedupe() {
        let merged = merge_path_strings(
            r"C:\Windows\System32;C:\Tools",
            r"C:\Tools;C:\Users\me\bin",
        );
        assert_eq!(merged, r"C:\Windows\System32;C:\Tools;C:\Users\me\bin");
    }

    #[test]
    fn merge_path_strings_case_insensitive_dedupe() {
        let merged = merge_path_strings(r"C:\Tools", r"c:\tools;C:\Other");
        assert_eq!(merged, r"C:\Tools;C:\Other");
    }

    #[test]
    fn expand_environment_string_resolves_system_root() {
        let system_root = std::env::var("SystemRoot").expect("SystemRoot should exist on Windows");
        let expanded = expand_environment_string("%SystemRoot%\\System32")
            .expect("expansion should succeed");
        assert_eq!(expanded, format!("{system_root}\\System32"));
    }
}
