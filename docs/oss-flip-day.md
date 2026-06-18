# OSS flip day — runbook

> Mach Cloud stays out of scope.

## Current state (2026-06-18)

| Item | Status |
| --- | --- |
| Domain `machbox.dev` | Registered |
| Org `MachBox-Dev` + profile README | Done |
| Site / logos | In progress |
| **`MachBox-Dev/mach-terminal`** | **Public** |
| Security Advisories | Enabled |
| Local `origin` remote | `git@github.com:MachBox-Dev/mach-terminal.git` |
| OSS prep on `main` | Pushed (`95eb026`) |
| Actions secrets on org repo | Tier 1 via `setup-release-signing.ps1` (user-run) |
| First org release tag | Pending green CI + secrets |

---

## Completed — Phase A

- A1 OSS prep committed and pushed
- A2 Transfer to `MachBox-Dev`
- A3 Public visibility
- A5 Security Advisories enabled

### A4. Updater signing secrets (Tier 1 — required)

**Never set before.** Run from repo root:

```powershell
.\scripts\setup-release-signing.ps1
```

Full guide: [`docs/signing-setup.md`](signing-setup.md). Creates three secrets:

| Secret | Purpose |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | Signs update bundles |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Key password |
| `UPDATER_PUBLIC_KEY` | Embedded in release builds for updater verification |

Verify: `gh secret list --repo MachBox-Dev/mach-terminal`

### A4b. OS code signing (Tier 2 — optional, later)

Windows/macOS Authenticode certs — see `docs/signing-setup.md`. Builds work without them; downloads may show OS warnings.

---

## Phase B — Infra (parallel with site work)

| Task | Blocks |
| --- | --- |
| `security@` + `conduct@` → your inbox | Real security contact |
| `terminal.machbox.dev` → site or GitHub redirect | Marketing |
| Apex `machbox.dev` links to Terminal + Triage | Announce |

Site polish does **not** block using GitHub as canonical docs.

---

## Phase C — First public release (next)

1. Re-run CI on `main` (last OSS push run was cancelled — check [Actions](https://github.com/MachBox-Dev/mach-terminal/actions))
2. Re-add signing secrets (A4)
3. `CHANGELOG.md` — cut `[0.1.1]` OSS announcement or tag `v0.1.0` from org
4. Tag from org repo:

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

5. `release.yml` → `MACH_UPDATER_ENDPOINT=https://github.com/MachBox-Dev/mach-terminal/releases/latest/download/latest.json`
6. Promote draft stable release per `RELEASING.md`

---

## Phase D — Announce (when site is ready)

- Link from `machbox.dev` → [github.com/MachBox-Dev/mach-terminal](https://github.com/MachBox-Dev/mach-terminal) + Triage
- Release notes: `PRINCIPLES.md`, install from Releases

---

## Post-flip product (not blocking)

| Item | When |
| --- | --- |
| New-tab profile picker | First post-flip UX slice (before loud announce) |
| Bundle id `com.whobs.machterminal` → `com.machbox.terminal` | Before wide install push (breaking) |
| Full `NOTICE` dep regeneration | Before first org release tag |
| Mach Cloud / `api.machbox.dev` | When relay exists |

---

## Rollback

Org repos can be made private again (plan-dependent). Transfers are hard to undo — prefer fixing forward.
