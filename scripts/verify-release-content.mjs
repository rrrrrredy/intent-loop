import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function json(relativePath) {
  return JSON.parse(read(relativePath));
}

function section(markdown, heading, nextHeading) {
  const start = markdown.indexOf(heading);
  invariant(start >= 0, `missing section ${heading}`);
  const bodyStart = start + heading.length;
  const end = nextHeading ? markdown.indexOf(nextHeading, bodyStart) : markdown.length;
  invariant(end >= 0, `missing section boundary ${nextHeading}`);
  return markdown.slice(bodyStart, end).trim();
}

function codePoints(value) {
  return [...value.normalize("NFC")].length;
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    if ([".git", "node_modules"].includes(entry)) continue;
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

const rootPackage = json("package.json");
const sourcePackage = json("packages/intent-formation/package.json");
const manifests = [
  json("packages/intent-formation/.codex-plugin/plugin.json"),
  json("packages/intent-formation/companion/.codex-plugin/plugin.json"),
  json("plugins/intent-formation/.codex-plugin/plugin.json"),
  json("plugins/intent-formation-state/.codex-plugin/plugin.json")
];
const version = "0.3.0-beta.1";
invariant(rootPackage.version === version, "root package version mismatch");
invariant(sourcePackage.version === version, "source package version mismatch");
invariant(manifests.every((manifest) => manifest.version === version), "Codex manifest version mismatch");
invariant(rootPackage.name === "dsh-intent-formation", "DeepSeek package identity mismatch");
invariant(rootPackage.peerDependencies?.["@deepseek-ai/cordis"] === "4.0.2", "Cordis peer mismatch");
invariant(rootPackage.peerDependencies?.["@deepseek-ai/dsh-tools"] === "0.1.2-alpha.5", "DeepSeek tools peer mismatch");
invariant(read("dsh/scripts/deepseek-host-smoke.mjs").includes("@deepseek-ai/dsh@0.1.2-alpha.5"), "DeepSeek host version mismatch");
const releaseWorkflow = read(".github/workflows/release.yml");
invariant(
  releaseWorkflow.includes('node scripts/verify-annotated-tag.mjs --tag "$GITHUB_REF_NAME" --commit "$GITHUB_SHA"'),
  "release workflow must verify the annotated tag object"
);
invariant(
  releaseWorkflow.includes("node scripts/verify-evidence.mjs --require-candidate"),
  "release workflow must require exact-candidate holdout evidence"
);
invariant(
  releaseWorkflow.includes("--sort=name --mtime=") &&
    releaseWorkflow.includes("--owner=0 --group=0 --numeric-owner") &&
    releaseWorkflow.includes("gzip -n"),
  "release archives must be deterministic"
);
invariant(
  releaseWorkflow.includes("node scripts/release-asset-plan.mjs") &&
    !releaseWorkflow.includes("--clobber"),
  "release asset reconciliation must be digest-aware and non-clobbering"
);

const xMarkdown = read("social/x-post.md");
const xCopy = section(xMarkdown, "## English", "- Raw characters:");
const xUrl = xCopy.match(/https:\/\/\S+/u)?.[0];
invariant(xUrl, "X post must contain one URL");
invariant(/^[\x00-\x7F]+$/u.test(xCopy), "English X post must use ASCII text and punctuation");
const xRaw = codePoints(xCopy);
const xWeighted = xRaw - codePoints(xUrl) + 23;
invariant(xWeighted <= 280, `X post is ${xWeighted}/280 weighted characters`);
invariant(xMarkdown.includes(`- Raw characters: ${xRaw}`), "X raw count note is stale");
invariant(xMarkdown.includes(`- X weighted characters: ${xWeighted}`), "X weighted count note is stale");

const xhsMarkdown = read("social/xiaohongshu/post.md");
const xhsBody = section(xhsMarkdown, "## 正文", "## 发布检查");
const xhsLength = codePoints(xhsBody);
invariant(xhsLength <= 1000, `Xiaohongshu body is ${xhsLength}/1000 characters`);
invariant(xhsMarkdown.includes(`- 正文字符数：${xhsLength}，低于 1000。`), "Xiaohongshu count note is stale");
for (const pattern of [/不是[\s\S]{0,40}而是/u, /我的判断/u, /我的答案/u, /最近/u]) {
  invariant(!pattern.test(xhsBody), `Xiaohongshu body contains banned phrasing: ${pattern}`);
}

const images = [
  ["01-cover.png", "46947a0c1c132b62ae8a62f9a180a28877f8a30ba55a80965b4d018dcce6f7a0"],
  ["02-when-to-ask.png", "8d3468dc127831230fc5f55367907151f9817c649c3a77b14314dfd24a774e9f"],
  ["03-three-steps.png", "62dc202500c9722903a04ca8c7c8e435695f0f07994edbf66578854c2a1edb79"],
  ["04-codex-deepseek-local.png", "330ccfd299ef2747b375754bf994ddc5e4d328e8a7ba268163e13b2ec01a4def"]
];
const imageReadme = read("social/xiaohongshu/images/README.md");
for (const [name, expectedHash] of images) {
  const bytes = readFileSync(path.join(root, "social", "xiaohongshu", "images", name));
  invariant(bytes.subarray(1, 4).toString("ascii") === "PNG", `${name} is not PNG`);
  invariant(bytes.readUInt32BE(16) === 1086 && bytes.readUInt32BE(20) === 1448, `${name} must be 1086x1448`);
  const digest = createHash("sha256").update(bytes).digest("hex");
  invariant(digest === expectedHash, `${name} digest mismatch`);
  invariant(imageReadme.includes(expectedHash), `${name} digest is missing from image README`);
}

const textExtensions = new Set([".js", ".json", ".jsonl", ".md", ".mjs", ".toml", ".yaml", ".yml"]);
for (const file of walk(root)) {
  if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
  const content = readFileSync(file, "utf8");
  const relative = path.relative(root, file);
  invariant(!/[A-Za-z]:[\\/](?:Users|Codex|Documents)/u.test(content), `${relative} contains a machine-specific absolute path`);
  invariant(!/(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,})/u.test(content), `${relative} contains a token-shaped literal`);
  if (path.extname(file).toLowerCase() !== ".md") continue;
  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu)) {
    const target = match[1].replace(/^<|>$/gu, "");
    if (/^(?:https?:\/\/|mailto:|#|codex:\/\/)/u.test(target)) continue;
    const local = target.split("#", 1)[0];
    if (!local) continue;
    invariant(existsSync(path.resolve(path.dirname(file), local)), `${relative} links to missing ${target}`);
  }
}

process.stdout.write(JSON.stringify({
  ok: true,
  version,
  x_weighted_characters: xWeighted,
  xiaohongshu_characters: xhsLength,
  images: images.length
}) + "\n");
