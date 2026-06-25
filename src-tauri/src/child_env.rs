//! Environment block assembly for PTY child processes.

use std::collections::HashMap;

/// Process env plus optional profile overrides. On Windows, PATH is refreshed from registry.
pub fn build_child_environment(profile_env: HashMap<String, String>) -> HashMap<String, String> {
    #[cfg(windows)]
    {
        return crate::win_env::build_child_environment(profile_env);
    }
    #[cfg(not(windows))]
    {
        let mut env: HashMap<String, String> = std::env::vars().collect();
        for (key, value) in profile_env {
            env.insert(key, value);
        }
        env
    }
}
