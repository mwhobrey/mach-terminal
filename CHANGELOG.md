# Changelog

All notable changes to Mach Terminal are documented in this file.

## [Unreleased]

### Added

- Shell profile picker with cross-platform `detect_shells` (WSL distro enumeration, `/etc/shells`, profile `args`).
- Persisted workspace tabs (`RestorableSession`: shell, cwd, name, chatKey, inputMode) with cold-restart respawn and layout remap.
- Per-session AI chat persistence (`chatKey` + localStorage) with exit-save overlay and phased close flush.
- Operator/Commander input modes, composer Cmd/AI intent chip, and ops-rail AI chat panel.
- AI read-only tools (`list_command_runs`, `get_command_output`) with native tool loop for OpenAI, Ollama, and Anthropic.
- Resizable ops rail; Explain/Safer gated on configured AI providers.
- Dogfood release CI workflow and `npm run release:build` local production bundles.

### Changed

- Provider settings and onboarding share canonical `buildProviderCards` view-model.
- Titlebar-integrated tabs with inline rename and short shell labels.

## [0.1.0] - 2026-04-15

### Added

- PTY session lifecycle commands and event streaming.
- Multi-session tabs, split workspace primitives, command palette, and keymap controls.
- History query/replay commands and AI explain/fix UX hooks.
- OTel-ready runtime telemetry, burn-in scripts, nightly burn-in workflow, and threshold gates.
- Release-readiness foundation including updater scaffolding, release workflows, and signing documentation.

### Changed

- Runtime capabilities now report truthful session persistence status.
- Frontend terminal output handling now uses bounded buffering and batched writes.

### Fixed

- Session teardown reliability and exit cleanup behavior.
- Build-time icon asset gap by generating full Tauri icon set.
