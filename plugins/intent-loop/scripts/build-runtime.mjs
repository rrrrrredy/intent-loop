import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(scriptDirectory, "..");
const repositoryRoot = path.resolve(pluginRoot, "../..");
const runtimeDirectory = path.join(pluginRoot, "runtime");
const packageMetadata = JSON.parse(await readFile(path.join(pluginRoot, "package.json"), "utf8"));
const embeddedInventory = JSON.parse(await readFile(path.join(scriptDirectory, "embedded-packages.json"), "utf8"));
const banner = "/*! Intent Loop " + packageMetadata.version + " | Apache-2.0 | See ../LICENSE and ../THIRD_PARTY_NOTICES.md */";

await mkdir(runtimeDirectory, { recursive: true });

const common = {
  absWorkingDir: pluginRoot,
  bundle: true,
  legalComments: "eof",
  metafile: true,
  minify: false,
  platform: "node",
  format: "esm",
  target: "node20",
  banner: { js: banner }
};

const server = await build({
  ...common,
  entryPoints: ["src/server.ts"],
  outfile: "runtime/server.mjs"
});
const hook = await build({
  ...common,
  entryPoints: ["src/hook.ts"],
  outfile: "runtime/hook.mjs"
});

async function normalizeGeneratedText(filePath) {
  const text = await readFile(filePath, "utf8");
  const normalized = text
    .replaceAll("\r\n", "\n")
    .replace(/[ \t]+(?=\n)/gu, "")
    .replace(/\n*$/u, "\n");
  await writeFile(filePath, normalized, "utf8");
}

await Promise.all([
  normalizeGeneratedText(path.join(runtimeDirectory, "server.mjs")),
  normalizeGeneratedText(path.join(runtimeDirectory, "hook.mjs"))
]);

function packageNameForInput(inputPath) {
  const normalized = inputPath.replaceAll("\\", "/");
  const marker = "node_modules/";
  const index = normalized.lastIndexOf(marker);
  if (index < 0) return null;
  const remainder = normalized.slice(index + marker.length);
  const parts = remainder.split("/");
  if (parts[0]?.startsWith("@")) return parts.length >= 2 ? parts[0] + "/" + parts[1] : null;
  return parts[0] ?? null;
}

async function packageNotice(packageName) {
  const packageDirectory = path.join(pluginRoot, "node_modules", ...packageName.split("/"));
  const metadata = JSON.parse(await readFile(path.join(packageDirectory, "package.json"), "utf8"));
  const licenseCandidates = ["LICENSE", "LICENSE.md", "LICENSE.txt", "license", "license.md"];
  let licenseText = "License text not bundled by the package.";
  for (const candidate of licenseCandidates) {
    try {
      licenseText = (await readFile(path.join(packageDirectory, candidate), "utf8")).trim();
      break;
    } catch (error) {
      const code = error instanceof Error && "code" in error ? String(error.code) : "";
      if (code !== "ENOENT") throw error;
    }
  }
  const repository = typeof metadata.repository === "string"
    ? metadata.repository
    : metadata.repository?.url ?? "";
  return [
    "## " + metadata.name + " " + metadata.version,
    "",
    "License: " + (metadata.license ?? "UNKNOWN"),
    ...(repository ? ["Repository: " + repository] : []),
    "",
    licenseText,
    ""
  ].join("\n");
}

function embeddedPackagesIn(text) {
  const found = new Map();
  const pattern = /node_modules\/\.pnpm\/([^/]+)\/node_modules\/((?:@[^/]+\/)?[^/]+)/gu;
  for (const match of text.matchAll(pattern)) {
    const encoded = match[1];
    const name = match[2];
    if (!encoded || !name) continue;
    const encodedName = name.replace("/", "+");
    if (!encoded.startsWith(`${encodedName}@`)) continue;
    const suffix = encoded.slice(encodedName.length + 1);
    const version = suffix.split("_")[0];
    found.set(name, version);
  }
  return found;
}

function npmPurl(name, version) {
  if (name.startsWith("@")) {
    const [scope, packageName] = name.slice(1).split("/");
    return `pkg:npm/%40${scope}/${packageName}@${version}`;
  }
  return `pkg:npm/${name}@${version}`;
}

const bundledInputs = [...Object.keys(server.metafile.inputs), ...Object.keys(hook.metafile.inputs)];
const packageNames = [...new Set(bundledInputs.map(packageNameForInput).filter(Boolean))].sort();
if (!packageNames.includes("@modelcontextprotocol/server") || !packageNames.includes("zod")) {
  throw new Error("third-party notice generation did not discover required bundled packages");
}
const notices = [
  "# Third-party notices",
  "",
  "The distributable runtime bundles the following third-party packages. Their licenses apply to their respective code.",
  ""
];
for (const packageName of packageNames) notices.push(await packageNotice(packageName));

const embeddedFound = new Map();
for (const inputPath of bundledInputs) {
  const absoluteInput = path.isAbsolute(inputPath) ? inputPath : path.resolve(pluginRoot, inputPath);
  let inputText = "";
  try {
    inputText = await readFile(absoluteInput, "utf8");
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : "";
    if (code !== "ENOENT") throw error;
  }
  for (const [name, version] of embeddedPackagesIn(inputText)) embeddedFound.set(name, version);
}
const embeddedExpected = new Map(embeddedInventory.map((item) => [item.name, item.version]));
const foundSignature = [...embeddedFound].sort().map(([name, version]) => `${name}@${version}`);
const expectedSignature = [...embeddedExpected].sort().map(([name, version]) => `${name}@${version}`);
if (JSON.stringify(foundSignature) !== JSON.stringify(expectedSignature)) {
  throw new Error(`embedded package inventory mismatch: found=${foundSignature.join(",")} expected=${expectedSignature.join(",")}`);
}
notices.push(await readFile(path.join(pluginRoot, "third_party", "EMBEDDED_LICENSES.md"), "utf8"));

await writeFile(path.join(pluginRoot, "THIRD_PARTY_NOTICES.md"), notices.join("\n").trim() + "\n", "utf8");
const directComponents = [];
for (const packageName of packageNames) {
  const packageDirectory = path.join(pluginRoot, "node_modules", ...packageName.split("/"));
  const metadata = JSON.parse(await readFile(path.join(packageDirectory, "package.json"), "utf8"));
  directComponents.push({
    type: "library",
    "bom-ref": npmPurl(metadata.name, metadata.version),
    name: metadata.name,
    version: metadata.version,
    purl: npmPurl(metadata.name, metadata.version),
    licenses: [{ license: { id: metadata.license ?? "NOASSERTION" } }],
    scope: "required",
    properties: [{ name: "intent-loop:bundle-source", value: "esbuild-input" }]
  });
}
const embeddedComponents = embeddedInventory.map((item) => ({
  type: "library",
  "bom-ref": npmPurl(item.name, item.version),
  name: item.name,
  version: item.version,
  purl: npmPurl(item.name, item.version),
  licenses: [{ license: { id: item.license } }],
  scope: "required",
  externalReferences: [{ type: "vcs", url: item.repository }],
  properties: [{ name: "intent-loop:bundle-source", value: "mcp-sdk-prebundle" }]
}));
const components = [...directComponents, ...embeddedComponents].sort((left, right) => left.purl.localeCompare(right.purl));
const rootPurl = npmPurl(packageMetadata.name, packageMetadata.version);
const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.6",
  version: 1,
  metadata: {
    component: {
      type: "application",
      "bom-ref": rootPurl,
      name: packageMetadata.name,
      version: packageMetadata.version,
      purl: rootPurl,
      licenses: [{ license: { id: packageMetadata.license } }]
    }
  },
  components,
  dependencies: [
    { ref: rootPurl, dependsOn: components.map((component) => component["bom-ref"]).sort() },
    ...components.map((component) => ({ ref: component["bom-ref"], dependsOn: [] }))
  ]
};
await writeFile(path.join(pluginRoot, "SBOM.cdx.json"), `${JSON.stringify(sbom, null, 2)}\n`, "utf8");
await copyFile(path.join(repositoryRoot, "LICENSE"), path.join(pluginRoot, "LICENSE"));
await copyFile(path.join(repositoryRoot, "NOTICE"), path.join(pluginRoot, "NOTICE"));

process.stdout.write(JSON.stringify({
  ok: true,
  version: packageMetadata.version,
  outputs: ["runtime/server.mjs", "runtime/hook.mjs"],
  bundled_packages: components.length
}) + "\n");
