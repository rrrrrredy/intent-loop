import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..", "..");
const lockPath = path.join(repositoryRoot, "package-lock.json");
const checkOnly = process.argv.includes("--check");
if (!existsSync(lockPath)) throw new Error("package-lock.json is missing; run npm install first");

const manifest = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8"));
const lock = JSON.parse(await readFile(lockPath, "utf8"));
const embeddedSbom = JSON.parse(await readFile(
  path.join(repositoryRoot, "plugins", "intent-loop", "SBOM.cdx.json"),
  "utf8"
));
const embeddedNotices = await readFile(
  path.join(repositoryRoot, "plugins", "intent-loop", "THIRD_PARTY_NOTICES.md"),
  "utf8"
);

function installedRuntimePackages() {
  const packages = [];
  for (const location of Object.keys(lock.packages).sort()) {
    if (!location.startsWith("node_modules/")) continue;
    const packageDirectory = path.join(repositoryRoot, ...location.split("/"));
    const packageJsonPath = path.join(packageDirectory, "package.json");
    if (!existsSync(packageJsonPath)) continue;
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    if (typeof packageJson.name !== "string" || typeof packageJson.version !== "string") continue;
    packages.push({
      name: packageJson.name,
      version: packageJson.version,
      license: typeof packageJson.license === "string" ? packageJson.license : "NOASSERTION",
      directory: packageDirectory
    });
  }
  return packages;
}

function purl(name, version) {
  const encodedName = name.startsWith("@") ? `%40${name.slice(1)}` : name;
  return `pkg:npm/${encodedName}@${version}`;
}

function componentFor(pkg) {
  return {
    type: "library",
    name: pkg.name,
    version: pkg.version,
    licenses: [{ license: { id: pkg.license } }],
    purl: purl(pkg.name, pkg.version),
    "bom-ref": purl(pkg.name, pkg.version)
  };
}

function deterministicUuid(seed) {
  const bytes = Buffer.from(createHash("sha256").update(seed).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function identity(component) {
  return `${component.name}@${component.version}`;
}

function normalizeNoticeText(text) {
  return text
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

const installed = installedRuntimePackages();
const merged = new Map();
for (const component of embeddedSbom.components ?? []) merged.set(identity(component), component);
for (const pkg of installed) merged.set(identity(pkg), componentFor(pkg));
const components = [...merged.values()].sort((left, right) => identity(left).localeCompare(identity(right)));
const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.6",
  serialNumber: `urn:uuid:${deterministicUuid(`${manifest.name}@${manifest.version}`)}`,
  version: 1,
  metadata: {
    component: {
      type: "application",
      name: manifest.name,
      version: manifest.version,
      licenses: [{ license: { id: manifest.license } }],
      purl: purl(manifest.name, manifest.version),
      "bom-ref": purl(manifest.name, manifest.version)
    }
  },
  components
};

function findLicenseText(pkg) {
  for (const filename of [
    "LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE", "COPYING",
    "license", "license.md", "license.txt", "licence", "copying"
  ]) {
    const target = path.join(pkg.directory, filename);
    if (existsSync(target)) return normalizeNoticeText(readFileSync(target, "utf8"));
  }
  throw new Error(`runtime dependency ${pkg.name}@${pkg.version} has no packaged license text`);
}

const embeddedIdentities = new Set((embeddedSbom.components ?? []).map(identity));
const additional = installed
  .filter((pkg) => !embeddedIdentities.has(`${pkg.name}@${pkg.version}`))
  .sort((left, right) => `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`));
const noticeSections = additional.map((pkg) => [
  `## ${pkg.name} ${pkg.version}`,
  "",
  `Declared license: ${pkg.license}`,
  "",
  "```text",
  findLicenseText(pkg),
  "```"
].join("\n"));
const notices = [
  "# DeepSeek Harness bundle third-party notices",
  "",
  "The bundled Intent Loop MCP runtime retains the notices below. The DeepSeek Harness adapter adds the separately listed runtime dependencies.",
  "",
  normalizeNoticeText(embeddedNotices),
  ...(noticeSections.length === 0 ? [] : ["", "# Additional adapter dependencies", "", ...noticeSections]),
  ""
].join("\n");

const outputs = [
  [path.join(repositoryRoot, "dsh", "SBOM.cdx.json"), `${JSON.stringify(sbom, null, 2)}\n`],
  [path.join(repositoryRoot, "dsh", "THIRD_PARTY_NOTICES.md"), notices]
];
for (const [target, content] of outputs) {
  if (checkOnly) {
    const current = await readFile(target, "utf8");
    assert.equal(current, content, `${path.relative(repositoryRoot, target)} is stale; run npm run generate:dsh-legal`);
  } else {
    await writeFile(target, content, "utf8");
  }
}
process.stdout.write(JSON.stringify({
  ok: true,
  check: checkOnly,
  components: components.length,
  additional_notices: additional.length
}) + "\n");
