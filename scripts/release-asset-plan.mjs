import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function byCodeUnit(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function localReleaseAssets(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => ({
      name: entry.name,
      digest: "sha256:" + createHash("sha256")
        .update(readFileSync(path.join(directory, entry.name)))
        .digest("hex")
    }))
    .sort((left, right) => byCodeUnit(left.name, right.name));
}

export function planReleaseAssets(release, localAssets) {
  if (!release || typeof release !== "object" || Array.isArray(release)) {
    throw new TypeError("one existing release object is required");
  }
  if (!release.prerelease) throw new Error("existing release is not a prerelease");
  if (!Array.isArray(release.assets)) throw new TypeError("release assets must be an array");

  const localNames = new Set(localAssets.map((asset) => asset.name));
  if (localNames.size !== localAssets.length) throw new Error("duplicate local asset names");
  const remoteByName = new Map();
  for (const asset of release.assets) {
    if (remoteByName.has(asset.name)) throw new Error("duplicate remote asset " + asset.name);
    remoteByName.set(asset.name, asset);
  }
  const unexpected = [...remoteByName.keys()].filter((name) => !localNames.has(name));
  if (unexpected.length > 0) {
    throw new Error("refusing to remove unexpected release assets: " + unexpected.join(", "));
  }

  const deleteAssetIds = [];
  const uploadNames = [];
  const mismatches = [];
  for (const local of localAssets) {
    const remote = remoteByName.get(local.name);
    if (!remote) {
      uploadNames.push(local.name);
      continue;
    }
    if (remote.digest !== local.digest) {
      mismatches.push(local.name);
      deleteAssetIds.push(remote.id);
      uploadNames.push(local.name);
    }
  }

  if (!release.draft) {
    if (release.immutable !== true) {
      throw new Error("published release is not immutable");
    }
    if (uploadNames.length > 0) {
      throw new Error("immutable release assets differ: " + uploadNames.join(", "));
    }
    return {
      action: "verify_published",
      release_id: release.id,
      delete_asset_ids: [],
      upload_names: [],
      mismatches: []
    };
  }

  return {
    action: "update_draft",
    release_id: release.id,
    delete_asset_ids: deleteAssetIds,
    upload_names: uploadNames,
    mismatches
  };
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function main() {
  const releasePath = option("--release");
  const artifactsPath = option("--artifacts");
  const outputPath = option("--output");
  if (!releasePath || !artifactsPath || !outputPath) {
    throw new Error("usage: release-asset-plan --release <json> --artifacts <dir> --output <json>");
  }
  const release = JSON.parse(readFileSync(releasePath, "utf8"));
  const plan = planReleaseAssets(release, localReleaseAssets(artifactsPath));
  writeFileSync(outputPath, JSON.stringify(plan, null, 2) + "\n", "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
