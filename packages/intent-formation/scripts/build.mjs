import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

const packageRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(packageRoot, "..", "..");
const outputDirectory = path.join(packageRoot, "dist");
const companionOutputDirectory = path.join(packageRoot, "companion", "dist");
const coreDistribution = path.join(repositoryRoot, "plugins", "intent-formation");
const stateDistribution = path.join(repositoryRoot, "plugins", "intent-formation-state");
const packageManifest = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
const coreManifest = JSON.parse(
  await readFile(path.join(packageRoot, ".codex-plugin", "plugin.json"), "utf8")
);
const stateManifest = JSON.parse(
  await readFile(path.join(packageRoot, "companion", ".codex-plugin", "plugin.json"), "utf8")
);

if (
  packageManifest.version !== coreManifest.version ||
  packageManifest.version !== stateManifest.version
) {
  throw new Error("package and plugin manifest versions must match before building");
}

await Promise.all([
  mkdir(outputDirectory, { recursive: true }),
  mkdir(companionOutputDirectory, { recursive: true })
]);

const commonBuild = {
  absWorkingDir: packageRoot,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  legalComments: "none",
  sourcemap: false,
  metafile: true
};

async function normalizeGeneratedText(filePath) {
  const source = await readFile(filePath, "utf8");
  const normalized = source.replace(/\r\n?/gu, "\n").replace(/[ \t]+$/gmu, "");
  if (normalized !== source) await writeFile(filePath, normalized, "utf8");
}

const stateServer = await build({
  ...commonBuild,
  entryPoints: [path.join(packageRoot, "server", "index.mjs")],
  outfile: path.join(outputDirectory, "intent-formation-server.mjs")
});
await normalizeGeneratedText(path.join(outputDirectory, "intent-formation-server.mjs"));
await copyFile(
  path.join(outputDirectory, "intent-formation-server.mjs"),
  path.join(companionOutputDirectory, "intent-formation-server.mjs")
);

const commandHook = await build({
  ...commonBuild,
  entryPoints: [path.join(packageRoot, "hooks", "intent-command.mjs")],
  outfile: path.join(companionOutputDirectory, "intent-command.mjs")
});
await normalizeGeneratedText(path.join(companionOutputDirectory, "intent-command.mjs"));

const resumeHook = await build({
  ...commonBuild,
  entryPoints: [path.join(packageRoot, "hooks", "intent-check.mjs")],
  outfile: path.join(companionOutputDirectory, "intent-resume.mjs")
});
await normalizeGeneratedText(path.join(companionOutputDirectory, "intent-resume.mjs"));

function packageNameForInput(inputPath) {
  const normalized = inputPath.replaceAll("\\", "/");
  const marker = "node_modules/";
  const index = normalized.lastIndexOf(marker);
  if (index < 0) return null;
  const parts = normalized.slice(index + marker.length).split("/");
  return parts[0]?.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0] || null;
}

function npmPurl(name, version) {
  if (name.startsWith("@")) {
    const [scope, packageName] = name.slice(1).split("/");
    return `pkg:npm/%40${scope}/${packageName}@${version}`;
  }
  return `pkg:npm/${name}@${version}`;
}

function deterministicUuid(seed) {
  const bytes = Buffer.from(createHash("sha256").update(seed).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function runtimePackage(name) {
  const directory = path.join(packageRoot, "node_modules", ...name.split("/"));
  const metadata = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
  return {
    name: metadata.name,
    version: metadata.version,
    license: typeof metadata.license === "string" ? metadata.license : "NOASSERTION",
    directory
  };
}

async function licenseText(pkg) {
  for (const filename of [
    "LICENSE",
    "LICENSE.md",
    "LICENSE.txt",
    "LICENCE",
    "COPYING",
    "license",
    "license.md",
    "license.txt"
  ]) {
    const candidate = path.join(pkg.directory, filename);
    if (existsSync(candidate)) return (await readFile(candidate, "utf8")).trim();
  }
  throw new Error(`${pkg.name}@${pkg.version} has no packaged license text`);
}

const packageNames = [...new Set(
  [stateServer, commandHook, resumeHook]
    .flatMap((result) => Object.keys(result.metafile.inputs))
    .map(packageNameForInput)
    .filter(Boolean)
)].sort();
const runtimePackages = await Promise.all(packageNames.map(runtimePackage));
const components = runtimePackages.map((pkg) => ({
  type: "library",
  name: pkg.name,
  version: pkg.version,
  licenses: [{ license: { id: pkg.license } }],
  purl: npmPurl(pkg.name, pkg.version),
  "bom-ref": npmPurl(pkg.name, pkg.version),
  scope: "required"
}));

function sbom(name, version, includedComponents) {
  const rootRef = npmPurl(name, version);
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    serialNumber: `urn:uuid:${deterministicUuid(rootRef)}`,
    version: 1,
    metadata: {
      component: {
        type: "application",
        name,
        version,
        licenses: [{ license: { id: "Apache-2.0" } }],
        purl: rootRef,
        "bom-ref": rootRef
      }
    },
    components: includedComponents,
    dependencies: [
      { ref: rootRef, dependsOn: includedComponents.map((item) => item["bom-ref"]).sort() },
      ...includedComponents.map((item) => ({ ref: item["bom-ref"], dependsOn: [] }))
    ]
  };
}

const coreNotices = [
  "# Third-party notices",
  "",
  "The Intent Formation core runtime uses Node.js built-ins and project source only.",
  "The optional Intent Formation State companion has its own SBOM and third-party notices.",
  ""
].join("\n");
const stateNoticeSections = [];
for (const pkg of runtimePackages) {
  stateNoticeSections.push(
    `## ${pkg.name} ${pkg.version}`,
    "",
    `Declared license: ${pkg.license}`,
    "",
    "```text",
    await licenseText(pkg),
    "```",
    ""
  );
}
const stateNotices = [
  "# Intent Formation State third-party notices",
  "",
  "The bundled state server and command hooks include the packages listed below.",
  "",
  ...stateNoticeSections
].join("\n");

await Promise.all([
  writeFile(path.join(packageRoot, "THIRD_PARTY_NOTICES.md"), coreNotices, "utf8"),
  writeFile(
    path.join(packageRoot, "SBOM.cdx.json"),
    JSON.stringify(sbom("intent-formation", packageManifest.version, []), null, 2) + "\n",
    "utf8"
  ),
  writeFile(
    path.join(packageRoot, "companion", "THIRD_PARTY_NOTICES.md"),
    stateNotices,
    "utf8"
  ),
  writeFile(
    path.join(packageRoot, "companion", "SBOM.cdx.json"),
    JSON.stringify(
      sbom("intent-formation-state", packageManifest.version, components),
      null,
      2
    ) + "\n",
    "utf8"
  )
]);

async function copyEntry(sourceRoot, destinationRoot, sourceRelative, destinationRelative = sourceRelative) {
  const source = path.join(sourceRoot, sourceRelative);
  const destination = path.join(destinationRoot, destinationRelative);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
  await normalizeGeneratedText(destination);
}

for (const target of [coreDistribution, stateDistribution]) {
  const resolved = path.resolve(target);
  if (!resolved.startsWith(path.join(repositoryRoot, "plugins") + path.sep)) {
    throw new Error(`refusing to replace unexpected distribution path ${resolved}`);
  }
  await rm(resolved, { recursive: true, force: true });
  await mkdir(resolved, { recursive: true });
}

for (const relativePath of [
  ".codex-plugin/plugin.json",
  ".mcp.json",
  "hooks/hooks.json",
  "server/policy.mjs",
  "src/constants.mjs",
  "src/policy.mjs",
  "skills/intent-formation/SKILL.md",
  "skills/intent-formation/agents/openai.yaml",
  "assets/intent-formation.svg",
  "README.md",
  "LICENSE",
  "NOTICE",
  "THIRD_PARTY_NOTICES.md",
  "SBOM.cdx.json"
]) {
  await copyEntry(packageRoot, coreDistribution, relativePath);
}

for (const [sourceRelative, destinationRelative] of [
  ["companion/.codex-plugin/plugin.json", ".codex-plugin/plugin.json"],
  ["companion/.mcp.json", ".mcp.json"],
  ["companion/hooks/hooks.json", "hooks/hooks.json"],
  ["companion/skills/intent-state-control/SKILL.md", "skills/intent-state-control/SKILL.md"],
  ["companion/skills/intent-state-control/agents/openai.yaml", "skills/intent-state-control/agents/openai.yaml"],
  ["companion/dist/intent-formation-server.mjs", "dist/intent-formation-server.mjs"],
  ["companion/dist/intent-command.mjs", "dist/intent-command.mjs"],
  ["companion/dist/intent-resume.mjs", "dist/intent-resume.mjs"],
  ["companion/README.md", "README.md"],
  ["companion/LICENSE", "LICENSE"],
  ["companion/NOTICE", "NOTICE"],
  ["companion/THIRD_PARTY_NOTICES.md", "THIRD_PARTY_NOTICES.md"],
  ["companion/SBOM.cdx.json", "SBOM.cdx.json"]
]) {
  await copyEntry(packageRoot, stateDistribution, sourceRelative, destinationRelative);
}

process.stdout.write(JSON.stringify({
  ok: true,
  version: packageManifest.version,
  build_id: randomUUID(),
  state_components: components.length,
  distributions: [
    path.relative(repositoryRoot, coreDistribution),
    path.relative(repositoryRoot, stateDistribution)
  ]
}) + "\n");
