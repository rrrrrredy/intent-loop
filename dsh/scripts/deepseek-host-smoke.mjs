import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scratch = await mkdtemp(path.join(os.tmpdir(), "intent-loop-dsh-host-"));
const dshHome = path.join(scratch, "dsh-home");
const npmCache = path.join(scratch, "npm-cache");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const dshPackage = "@deepseek-ai/dsh@0.1.2-alpha.2";

const cleanEnv = { ...process.env };
for (const key of Object.keys(cleanEnv)) {
  if (/(?:^|_)(?:OPENAI|DEEPSEEK|ANTHROPIC|GEMINI).*(?:KEY|TOKEN|SECRET)|(?:API_KEY)$/iu.test(key)) {
    delete cleanEnv[key];
  }
}
Object.assign(cleanEnv, {
  DSH_HOME: dshHome,
  DSH_TELEMETRY_DISABLED: "1",
  NPM_CONFIG_CACHE: npmCache,
  npm_config_cache: npmCache,
  COREPACK_HOME: path.join(scratch, "corepack"),
  XDG_CACHE_HOME: path.join(scratch, "xdg-cache")
});

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    env: cleanEnv,
    encoding: "utf8",
    windowsHide: true,
    shell: process.platform === "win32",
    maxBuffer: 20 * 1024 * 1024,
    timeout: options.timeout ?? 10 * 60 * 1000
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited ${result.status}\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

try {
  run(pnpm, ["--version"], { timeout: 30_000 });
  const packReport = JSON.parse(run(npm, ["pack", "--json", "--ignore-scripts", "--pack-destination", scratch]));
  assert.equal(packReport.length, 1);
  const archives = (await readdir(scratch)).filter((entry) => entry.endsWith(".tgz"));
  assert.equal(archives.length, 1);
  const archive = path.join(scratch, archives[0]);

  run(npx, ["--yes", dshPackage, "plugin", "--profile", "headless", "add", archive]);
  const installed = run(npx, ["--yes", dshPackage, "--profile", "headless", "--dump-config"]);
  assert.match(installed, /id:\s*intent-loop/u);
  assert.match(installed, /name:\s*["']?dsh-intent-loop/u);

  const help = run(npx, ["--yes", dshPackage, "--profile", "headless", "--help"]);
  assert.match(help, /DeepSeek Harness|dsh|headless/iu);

  run(npx, ["--yes", dshPackage, "plugin", "--profile", "headless", "remove", "dsh-intent-loop"]);
  const removed = run(npx, ["--yes", dshPackage, "--profile", "headless", "--dump-config"]);
  assert.doesNotMatch(removed, /name:\s*["']?dsh-intent-loop/u);

  process.stdout.write(JSON.stringify({
    ok: true,
    dsh: "0.1.2-alpha.2",
    lifecycle: "pack-add-compose-boot-help-remove",
    api_key_used: false,
    dsh_home: "temporary-and-removed"
  }) + "\n");
} finally {
  const resolvedScratch = path.resolve(scratch);
  assert.equal(resolvedScratch.startsWith(path.resolve(os.tmpdir())), true);
  await rm(resolvedScratch, { recursive: true, force: true });
}
