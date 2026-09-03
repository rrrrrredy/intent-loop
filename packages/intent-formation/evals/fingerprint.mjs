import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function treeFingerprint(root) {
  const files = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile()) files.push(target);
      else throw new Error("fingerprinted tree may contain only regular files and directories");
    }
  }
  await visit(root);
  files.sort((left, right) => left.localeCompare(right, "en"));
  const digest = createHash("sha256");
  let bytes = 0;
  for (const filePath of files) {
    const contents = await readFile(filePath);
    const relative = path.relative(root, filePath).split(path.sep).join("/");
    digest.update(relative, "utf8");
    digest.update("\0", "utf8");
    digest.update(contents);
    digest.update("\0", "utf8");
    bytes += contents.length;
  }
  return { sha256: digest.digest("hex"), file_count: files.length, bytes };
}

export function gitArchiveFingerprint(gitRoot, commit, pathspec) {
  const contents = execFileSync(
    "git",
    ["archive", "--format=tar", commit, pathspec],
    { cwd: gitRoot, encoding: null, maxBuffer: 50 * 1024 * 1024 }
  );
  return {
    format: "git-archive-tar",
    pathspec,
    sha256: sha256(contents),
    bytes: contents.length
  };
}

export function gitTreeFingerprint(gitRoot, commit, pathspec) {
  const normalizedPathspec = pathspec.replaceAll("\\", "/").replace(/\/$/u, "");
  const listing = execFileSync(
    "git",
    ["ls-tree", "-r", "-z", commit, "--", normalizedPathspec],
    { cwd: gitRoot, encoding: null, maxBuffer: 10 * 1024 * 1024 }
  ).toString("utf8");
  const prefix = normalizedPathspec + "/";
  const entries = listing.split("\0").filter(Boolean).map((line) => {
    const tab = line.indexOf("\t");
    if (tab < 0) throw new Error("git tree entry is malformed");
    const [mode, type, object] = line.slice(0, tab).split(" ");
    const fullPath = line.slice(tab + 1);
    if (type !== "blob" || mode === "120000") {
      throw new Error("candidate plugin tree may contain only regular files");
    }
    if (!fullPath.startsWith(prefix)) {
      throw new Error("candidate plugin tree escaped its pathspec");
    }
    return { object, relative: fullPath.slice(prefix.length) };
  });
  entries.sort((left, right) => left.relative.localeCompare(right.relative, "en"));
  const digest = createHash("sha256");
  let bytes = 0;
  for (const entry of entries) {
    const contents = execFileSync("git", ["cat-file", "blob", entry.object], {
      cwd: gitRoot,
      encoding: null,
      maxBuffer: 50 * 1024 * 1024
    });
    digest.update(entry.relative, "utf8");
    digest.update("\0", "utf8");
    digest.update(contents);
    digest.update("\0", "utf8");
    bytes += contents.length;
  }
  return { sha256: digest.digest("hex"), file_count: entries.length, bytes };
}
