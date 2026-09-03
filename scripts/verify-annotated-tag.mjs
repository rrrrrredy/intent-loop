import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function verifyAnnotatedTag(repository, tagName, expectedCommit) {
  if (!/^v[0-9][A-Za-z0-9._-]*$/u.test(tagName)) {
    throw new TypeError("release tag has an unsupported name");
  }
  if (!/^[a-f0-9]{40}$/u.test(expectedCommit)) {
    throw new TypeError("expected commit must be a full lowercase Git object id");
  }
  const run = (args) => execFileSync("git", args, {
    cwd: path.resolve(repository),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
  const ref = "refs/tags/" + tagName;
  if (run(["cat-file", "-t", ref]) !== "tag") {
    throw new Error("release ref must be an annotated tag object");
  }
  const peeled = run(["rev-parse", tagName + "^{commit}"]);
  if (peeled !== expectedCommit) {
    throw new Error("annotated release tag does not resolve to the workflow commit");
  }
  return { tag: tagName, commit: peeled };
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function main() {
  const tag = option("--tag");
  const commit = option("--commit");
  if (!tag || !commit) throw new Error("usage: verify-annotated-tag --tag <tag> --commit <sha>");
  process.stdout.write(JSON.stringify(verifyAnnotatedTag(process.cwd(), tag, commit)) + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
