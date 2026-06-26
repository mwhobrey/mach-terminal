#!/usr/bin/env node
/**
 * Mark TER-24/25 Done (shipped in v0.1.0-rc.7 @ 9ea4667).
 *
 * Usage (WSL):
 *   wsl -d Ubuntu -u whobs bash -lc '/home/whobs/.local/share/mise/installs/node/latest/bin/node /mnt/c/Users/whobs/dev/mach-terminal/scripts/linear-close-ter-24-25.mjs'
 */
import { readFileSync } from "node:fs";
import { LinearClient } from "/home/whobs/dev/mcp-utils/dist/linear-client.js";

const SHIP_SHA = process.env.SHIP_SHA ?? "9ea4667";
const TAG = "v0.1.0-rc.7";
const REPO = "MachBox-Dev/mach-terminal";

const token = JSON.parse(readFileSync("/mnt/c/Users/whobs/.cursor/mcp.json", "utf8")).mcpServers[
  "linear-mach-triage"
].env.LINEAR_API_TOKEN;
const client = new LinearClient({ apiToken: token, defaultTeam: "TER" });

const COMPLETIONS = {
  "TER-24": `**Shipped** in \`${TAG}\` @ [\`${SHIP_SHA}\`](https://github.com/${REPO}/commit/${SHIP_SHA}).

Commander/tmux xterm repaint stall fixed:
- \`refresh()\` after every PTY write
- visibility/focus recovery when WebView2 throttles RAF

Docs: \`CHANGELOG.md\` (rc.7 Fixed), \`terminalViewport.ts\`.`,

  "TER-25": `**Shipped** in \`${TAG}\` @ [\`${SHIP_SHA}\`](https://github.com/${REPO}/commit/${SHIP_SHA}) (Ctrl/Cmd+click parity also noted in rc.8 changelog).

- Heuristic link provider off-by-one on xterm \`provideLinks\` coordinates fixed (\`terminalLinkRanges.ts\`)
- Ctrl+click (Win/Linux) / Cmd+click (Mac) required to activate links — Windows Terminal parity (\`terminalLinkActivation.ts\`)

Docs: \`CHANGELOG.md\`, \`docs/runtime-contracts.md\`.`,
};

async function main() {
  for (const [identifier, body] of Object.entries(COMPLETIONS)) {
    const issue = await client.getIssue(identifier);
    if (!issue) {
      throw new Error(`Issue ${identifier} not found`);
    }
    const priorState = issue.state?.name ?? "(unknown)";
    console.log(`Updating ${identifier} (${issue.title}) — was: ${priorState}`);
    await client.saveIssue({ id: identifier, team: "TER", state: "Done" });
    await client.addComment({ issueId: identifier, body });
    console.log(`  → Done + comment posted (${issue.url ?? identifier})`);
  }
  console.log("TER-24/25 marked Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
