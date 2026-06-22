import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

function run(command) {
  console.log(`\n> ${command}`);
  execSync(command, { stdio: "inherit" });
}

function findDebArtifacts(bundleRoot) {
  const debDir = join(bundleRoot, "deb");
  if (!existsSync(debDir)) {
    return [];
  }
  return readdirSync(debDir).filter((name) => name.endsWith(".deb"));
}

try {
  run("node scripts/disable-updater-artifacts.mjs");
  run("npm run check:versions");
  // `beforeBuildCommand` in tauri.conf.json runs `npm run build` — no duplicate frontend build here.
  run("npm run tauri -- build --debug --bundles deb");

  const bundleRoot = resolve("src-tauri/target/debug/bundle");
  const debArtifacts = findDebArtifacts(bundleRoot);
  if (debArtifacts.length === 0) {
    console.error(`Release smoke failed: no .deb artifacts under ${bundleRoot}/deb`);
    process.exit(1);
  }

  console.log(`\nRelease smoke passed (${debArtifacts.length} deb artifact(s)).`);
  for (const artifact of debArtifacts) {
    console.log(`  - deb/${artifact}`);
  }
} catch {
  console.error("\nRelease smoke failed.");
  process.exit(1);
}
