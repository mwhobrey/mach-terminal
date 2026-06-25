#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { LinearClient } from "/home/whobs/dev/mcp-utils/dist/linear-client.js";

const token = JSON.parse(readFileSync("/mnt/c/Users/whobs/.cursor/mcp.json", "utf8")).mcpServers[
  "linear-mach-triage"
].env.LINEAR_API_TOKEN;
const client = new LinearClient({ apiToken: token, defaultTeam: "TER" });
const issues = await client.listIssues({ team: "TER", limit: 15 });
for (const issue of issues) {
  console.log(`${issue.identifier}\t${issue.title}\t${issue.url ?? ""}`);
}
