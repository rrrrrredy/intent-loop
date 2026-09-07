import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const [nodeMajor, nodeMinor] = process.versions.node.split(".").map(Number);
assert.equal(
  (nodeMajor === 22 && nodeMinor >= 19) || nodeMajor >= 24,
  true,
  `DeepSeek host smoke requires Node ^22.19.0 or >=24; received ${process.versions.node}`
);
const scratch = await mkdtemp(path.join(os.tmpdir(), "intent-formation-dsh-host-"));
const dshHome = path.join(scratch, "dsh-home");
const npmCache = path.join(scratch, "npm-cache");
const runtimeBin = path.dirname(process.execPath);
const npm = path.join(runtimeBin, process.platform === "win32" ? "npm.cmd" : "npm");
const npx = path.join(runtimeBin, process.platform === "win32" ? "npx.cmd" : "npx");
const corepack = path.join(runtimeBin, process.platform === "win32" ? "corepack.cmd" : "corepack");
const dshPackage = "@deepseek-ai/dsh@0.1.2-rc.1";
const pnpmPackage = "pnpm@11.7.0";

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
  COREPACK_DEFAULT_TO_LATEST: "0",
  COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
  COREPACK_ENABLE_AUTO_PIN: "0",
  XDG_CACHE_HOME: path.join(scratch, "xdg-cache")
});
const pathKey = Object.keys(cleanEnv).find((key) => key.toLowerCase() === "path") ?? "PATH";
cleanEnv[pathKey] = runtimeBin + path.delimiter + (cleanEnv[pathKey] ?? "");

function terminateProcessTree(child) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore"
    });
    return;
  }
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

function run(command, args, options = {}) {
  const timeout = options.timeout ?? 10 * 60 * 1000;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repositoryRoot,
      env: cleanEnv,
      windowsHide: true,
      shell: process.platform === "win32",
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let finished = false;
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      try {
        terminateProcessTree(child);
        reject(new Error(`${command} ${args.join(" ")} timed out after ${timeout} ms`));
      } catch (error) {
        reject(error);
      }
    }, timeout);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`${command} ${args.join(" ")} exited ${code}\n${stderr || stdout}`));
        return;
      }
      resolve(stdout);
    });
  });
}

let primaryError = null;
try {
  // This home is deliberately fresh; a runner's global Corepack activation is not inherited.
  await run(corepack, ["prepare", pnpmPackage, "--activate"]);
  assert.equal((await run(corepack, ["pnpm", "--version"])).trim(), "11.7.0");
  const packReport = JSON.parse(await run(npm, ["pack", "--json", "--ignore-scripts", "--pack-destination", scratch]));
  assert.equal(packReport.length, 1);
  const archives = (await readdir(scratch)).filter((entry) => entry.endsWith(".tgz"));
  assert.equal(archives.length, 1);
  const archive = path.join(scratch, archives[0]);

  await run(npx, ["--yes", dshPackage, "plugin", "--profile", "headless", "add", archive]);
  const installed = await run(npx, ["--yes", dshPackage, "--profile", "headless", "--dump-config"]);
  assert.match(installed, /id:\s*intent-formation/u);
  assert.match(installed, /name:\s*["']?dsh-intent-formation/u);

  const help = await run(npx, ["--yes", dshPackage, "--profile", "headless", "--help"]);
  assert.match(help, /DeepSeek Harness|dsh|headless/iu);

  await run(npx, ["--yes", dshPackage, "plugin", "--profile", "headless", "remove", "dsh-intent-formation"]);
  const removed = await run(npx, ["--yes", dshPackage, "--profile", "headless", "--dump-config"]);
  assert.doesNotMatch(removed, /name:\s*["']?dsh-intent-formation/u);

  process.stdout.write(JSON.stringify({
    ok: true,
    dsh: "0.1.2-rc.1",
    pnpm: "11.7.0",
    lifecycle: "pack-add-compose-boot-help-remove",
    api_key_used: false,
    dsh_home: "temporary-and-removed"
  }) + "\n");
} catch (error) {
  primaryError = error;
  throw error;
} finally {
  const resolvedScratch = path.resolve(scratch);
  assert.equal(resolvedScratch.startsWith(path.resolve(os.tmpdir())), true);
  try {
    await rm(resolvedScratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch (cleanupError) {
    if (!primaryError) throw cleanupError;
    process.stderr.write(`cleanup after primary failure also failed: ${cleanupError.code ?? "unknown"}\n`);
  }
}
