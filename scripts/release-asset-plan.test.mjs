import assert from "node:assert/strict";
import test from "node:test";
import { planReleaseAssets } from "./release-asset-plan.mjs";

const local = [
  { name: "a.tgz", digest: "sha256:aaa" },
  { name: "SHA256SUMS", digest: "sha256:bbb" }
];

test("a matching immutable release is verified without mutation", () => {
  assert.deepEqual(
    planReleaseAssets({
      id: 7,
      draft: false,
      prerelease: true,
      immutable: true,
      assets: [
        { id: 1, ...local[0] },
        { id: 2, ...local[1] }
      ]
    }, local),
    {
      action: "verify_published",
      release_id: 7,
      delete_asset_ids: [],
      upload_names: [],
      mismatches: []
    }
  );
});

test("a draft replaces only known mismatches and uploads missing assets", () => {
  assert.deepEqual(
    planReleaseAssets({
      id: 8,
      draft: true,
      prerelease: true,
      immutable: false,
      assets: [{ id: 11, name: "a.tgz", digest: "sha256:old" }]
    }, local),
    {
      action: "update_draft",
      release_id: 8,
      delete_asset_ids: [11],
      upload_names: ["a.tgz", "SHA256SUMS"],
      mismatches: ["a.tgz"]
    }
  );
});

test("unexpected assets and immutable drift fail closed", () => {
  assert.throws(
    () => planReleaseAssets({
      id: 9,
      draft: true,
      prerelease: true,
      assets: [{ id: 12, name: "manual-note.txt", digest: "sha256:x" }]
    }, local),
    /refusing to remove unexpected/u
  );
  assert.throws(
    () => planReleaseAssets({
      id: 10,
      draft: false,
      prerelease: true,
      immutable: true,
      assets: [{ id: 13, name: "a.tgz", digest: "sha256:old" }]
    }, local),
    /immutable release assets differ/u
  );
});
