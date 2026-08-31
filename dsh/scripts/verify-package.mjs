import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const packed = spawnSync(npm, ["pack", "--dry-run", "--json", "--ignore-scripts"], {
  cwd: new URL("../..", import.meta.url),
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
const files = report[0].files.map((entry) => entry.path).sort();
for (const required of [
  "LICENSE",
  "NOTICE",
  "dsh/README.md",
  "dsh/SBOM.cdx.json",
  "dsh/THIRD_PARTY_NOTICES.md",
  "dsh/adapter.js",
  "dsh/cordis.patch.yml",
  "dsh/index.js",
  "dsh/tool-catalog.json",
  "package.json",
  "plugins/intent-loop/runtime/server.mjs",
  "plugins/intent-loop/skills/intent/SKILL.md"
]) {
  assert.equal(files.includes(required), true, `packed DeepSeek bundle is missing ${required}`);
}
assert.equal(files.some((file) => file.includes("node_modules") || file.includes("/tests/") || file.includes("/scripts/")), false);
assert.equal(report[0].size < 8_000_000, true, "packed DeepSeek bundle unexpectedly exceeds 8 MB");
process.stdout.write(JSON.stringify({
  ok: true,
  filename: report[0].filename,
  files: files.length,
  bytes: report[0].size
}) + "\n");
