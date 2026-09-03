import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { verifyAnnotatedTag } from "./verify-annotated-tag.mjs";

test("release tag verification rejects lightweight and wrong-target tags", (context) => {
  const repository = mkdtempSync(path.join(os.tmpdir(), "intent-tag-test-"));
  context.after(async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        await rm(repository, { recursive: true, force: true });
        return;
      } catch (error) {
        const retryable = ["EBUSY", "ENOTEMPTY", "EPERM"].includes(error?.code);
        if (!retryable || attempt === 19) throw error;
        await delay(250);
      }
    }
  });
  const git = (args) => execFileSync("git", args, {
    cwd: repository,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
  git(["init", "--quiet"]);
  git(["config", "user.name", "Intent Formation Test"]);
  git(["config", "user.email", "test@example.invalid"]);
  writeFileSync(path.join(repository, "proof.txt"), "one\n", "utf8");
  git(["add", "proof.txt"]);
  git(["commit", "--quiet", "-m", "first"]);
  const first = git(["rev-parse", "HEAD"]);
  git(["tag", "v0.0.1"]);
  assert.throws(
    () => verifyAnnotatedTag(repository, "v0.0.1", first),
    /annotated tag object/u
  );

  git(["tag", "-a", "v0.0.2", "-m", "release"]);
  assert.deepEqual(verifyAnnotatedTag(repository, "v0.0.2", first), {
    tag: "v0.0.2",
    commit: first
  });
  writeFileSync(path.join(repository, "proof.txt"), "two\n", "utf8");
  git(["add", "proof.txt"]);
  git(["commit", "--quiet", "-m", "second"]);
  const second = git(["rev-parse", "HEAD"]);
  assert.throws(
    () => verifyAnnotatedTag(repository, "v0.0.2", second),
    /does not resolve/u
  );
});
