import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const repositoryRoot = new URL("../..", import.meta.url);
const rootPackage = JSON.parse(await readFile(new URL("package.json", repositoryRoot), "utf8"));
const codexPackage = JSON.parse(await readFile(new URL("plugins/intent-loop/package.json", repositoryRoot), "utf8"));
const codexManifest = JSON.parse(await readFile(new URL("plugins/intent-loop/.codex-plugin/plugin.json", repositoryRoot), "utf8"));
assert.equal(rootPackage.version, codexPackage.version, "DeepSeek and Codex package versions must match");
assert.equal(codexManifest.version, codexPackage.version, "Codex installed manifest version must match package.json");
const packed = spawnSync(npm, ["pack", "--dry-run", "--json", "--ignore-scripts"], {
  cwd: repositoryRoot,
  encoding: "utf8",
  windowsHide: true,
  shell: process.platform === "win32",
  maxBuffer: 10 * 1024 * 1024
});
if (packed.status !== 0) {
  throw new Error(packed.stderr || `npm pack exited ${packed.status} (${packed.signal ?? "no signal"})`);
}
const report = JSON.parse(packed.stdout);
assert.equal(Array.isArray(report), true);
assert.equal(report.length, 1);
assert.equal(report[0].version, rootPackage.version);
const files = report[0].files.map((entry) => entry.path).sort();
const expectedFiles = [
  "LICENSE",
  "NOTICE",
  "README.md",
  "dsh/README.md",
  "dsh/SBOM.cdx.json",
  "dsh/THIRD_PARTY_NOTICES.md",
  "dsh/adapter.js",
  "dsh/cordis.patch.yml",
  "dsh/index.js",
  "dsh/tool-catalog.json",
  "package.json",
  "plugins/intent-loop/LICENSE",
  "plugins/intent-loop/NOTICE",
  "plugins/intent-loop/THIRD_PARTY_NOTICES.md",
  "plugins/intent-loop/runtime/server.mjs",
  "plugins/intent-loop/skills/intent/SKILL.md"
].sort();
assert.deepEqual(files, expectedFiles, "packed DeepSeek bundle path set must match the exact allowlist");
assert.equal(files.some((file) => file.includes("node_modules") || file.includes("/tests/") || file.includes("/scripts/")), false);
assert.equal(report[0].size < 8_000_000, true, "packed DeepSeek bundle unexpectedly exceeds 8 MB");
process.stdout.write(JSON.stringify({
  ok: true,
  filename: report[0].filename,
  files: files.length,
  bytes: report[0].size
}) + "\n");
