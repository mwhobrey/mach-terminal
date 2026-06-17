import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const bundleRoot = resolve("src-tauri/target/release/bundle");

function walk(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      entries.push(...walk(path));
    } else {
      entries.push({ path, bytes: stat.size });
    }
  }
  return entries;
}

try {
  const artifacts = walk(bundleRoot).sort((a, b) => a.path.localeCompare(b.path));
  if (artifacts.length === 0) {
    console.error(`No release artifacts under ${bundleRoot}`);
    console.error("Run: npm run release:build");
    process.exit(1);
  }
  console.log(`\nRelease artifacts (${artifacts.length}):\n`);
  for (const artifact of artifacts) {
    const mb = (artifact.bytes / (1024 * 1024)).toFixed(2);
    console.log(`  ${artifact.path}  (${mb} MiB)`);
  }
  console.log("");
} catch (error) {
  console.error(`Could not read ${bundleRoot}. Build first with: npm run release:build`);
  process.exit(1);
}
