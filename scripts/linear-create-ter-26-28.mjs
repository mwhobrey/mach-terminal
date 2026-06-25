#!/usr/bin/env node
/**
 * One-shot Linear ticket bootstrap for TER-26/27/28.
 * Uses custom mcp-utils LinearClient (same as linear-server MCP).
 *
 * Usage (from repo root, via WSL):
 *   wsl -d Ubuntu -u whobs bash -lc 'LINEAR_API_TOKEN=... LINEAR_DEFAULT_TEAM=TER node /mnt/c/Users/whobs/dev/mach-terminal/scripts/linear-create-ter-26-28.mjs'
 */
import { readFileSync } from "node:fs";
import { LinearClient } from "/home/whobs/dev/mcp-utils/dist/linear-client.js";

const MCP_JSON = "/mnt/c/Users/whobs/.cursor/mcp.json";

function tokenForServer(serverKey) {
  const cfg = JSON.parse(readFileSync(MCP_JSON, "utf8"));
  return cfg.mcpServers?.[serverKey]?.env?.LINEAR_API_TOKEN;
}

async function findTerWorkspace() {
  for (const [serverKey, defaultTeam] of [
    ["linear-whobrey-studios", "TER"],
    ["linear-whobrey-studios", "WHO"],
    ["linear-mach-triage", "Mach-triage"],
    ["linear-mach-triage", "TER"],
  ]) {
    const apiToken = tokenForServer(serverKey);
    if (!apiToken) continue;
    const client = new LinearClient({ apiToken, defaultTeam });
    try {
      const issue = await client.getIssue("TER-25");
      if (issue?.identifier?.startsWith("TER-")) {
        return { client, serverKey, team: issue.team?.key ?? defaultTeam, sample: issue };
      }
    } catch {
      // try list teams for TER key
      try {
        const teams = await client.listTeams(50);
        const ter = teams.find((t) => t.key === "TER");
        if (ter) return { client, serverKey, team: "TER", sample: null };
      } catch {
        /* next */
      }
    }
  }
  throw new Error("Could not locate TER team in configured Linear workspaces");
}

const TICKETS = [
  {
    title: "Unify provider/onboarding status strings and error semantics",
    description: `Settings and onboarding share \`buildProviderCards\`, but onboarding still uses batch save while \`useProviderAiState\` had scattered failure strings for explain/fix/history AI.

**Acceptance**
- [ ] All provider mutation failure toasts use \`providerUiState\` helpers (settings + onboarding)
- [ ] History explain/fix pending/success/failure strings canonical in \`providerUiState\`
- [ ] \`providerUiState.smoke.test.ts\` covers onboarding fallbacks + history AI contracts
- [ ] No duplicated status literals in \`FirstRunSetup.tsx\` / \`useProviderAiState.ts\`
- [ ] Follow-up: onboarding live-save parity with Settings

**Branch:** \`ter-26-28-post-rc8\` (partial — string unification landed)

**Docs:** \`docs/linear/TER-26-28-post-rc8.md\``,
    priority: 3,
    estimate: "M",
  },
  {
    title: "PTY flow-control baseline + Phase 2 perf spike",
    description: `Phase 0/1 hot path shipped (WebGL, Channel, UTF-8 streaming). \`MAX_PENDING_CHUNKS\` is effectively dead at 8 KB reads.

**Acceptance**
- [x] \`docs/phase2-perf-spike.md\` — profiling plan, go/no-go criteria
- [x] \`enqueue_output_chunk\` unit-tested; drop semantics explicit
- [ ] Dogfood rc.8 under output flood; capture \`output_chunks_dropped\` counters
- [ ] Go/no-go decision before coalesce/backpressure production changes

**Branch:** \`ter-26-28-post-rc8\` (baseline landed)

**Docs:** \`docs/phase2-perf-spike.md\``,
    priority: 3,
    estimate: "M",
  },
  {
    title: "Script tab-focus routing and cross-surface provider UX smoke",
    description: `\`docs/manual-qa.md\` still has manual-only rows for tab switch focus and settings/palette coordination.

**Acceptance**
- [x] \`workspaceFocus.smoke.test.ts\` — focus event + \`selectTabGroup\` target/focus sync
- [x] Provider smoke covers onboarding fallbacks + history AI status parity
- [x] \`docs/manual-qa.md\` scripted section updated
- [ ] Palette/settings/surface coordination smoke (remaining manual-qa rows)

**Branch:** \`ter-26-28-post-rc8\` (partial)

**Docs:** \`docs/linear/TER-26-28-post-rc8.md\``,
    priority: 3,
    estimate: "S",
  },
];

async function main() {
  const { client, serverKey, team, sample } = await findTerWorkspace();
  console.log(`Using Linear workspace: ${serverKey}, team: ${team}`);
  if (sample) console.log(`Found reference issue: ${sample.identifier} — ${sample.title}`);

  const cycles = await client.listCycles({ team, limit: 20 });
  const now = Date.now();
  const activeCycle =
    cycles.find((c) => {
      const start = c.startsAt ? Date.parse(c.startsAt) : 0;
      const end = c.endsAt ? Date.parse(c.endsAt) : Number.MAX_SAFE_INTEGER;
      return start <= now && now <= end;
    }) ?? cycles[0];
  if (!activeCycle) {
    throw new Error(`No cycles found for team ${team}`);
  }
  console.log(`Active cycle: ${activeCycle.name ?? activeCycle.number} (${activeCycle.id})`);

  const existing = await client.searchIssues({ query: "TER-26 OR TER-27 OR TER-28 post rc.8", team, limit: 10 });
  const created = [];

  for (const ticket of TICKETS) {
    const dup = existing.find((row) => row.title === ticket.title);
    if (dup) {
      console.log(`SKIP (exists): ${dup.identifier} — ${dup.title}`);
      created.push(dup);
      continue;
    }
    const issue = await client.createIssue({
      team,
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      cycleId: activeCycle.id,
    });
    console.log(`CREATED: ${issue.identifier} — ${issue.title}`);
    created.push(issue);
  }

  console.log(JSON.stringify({ cycle: activeCycle, issues: created.map((i) => ({ id: i.identifier, url: i.url, title: i.title })) }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
