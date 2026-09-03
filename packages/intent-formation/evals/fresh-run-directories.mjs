import { lstat, mkdir, rm } from "node:fs/promises";
import path from "node:path";

function overlaps(left, right) {
  return left === right || left.startsWith(right + path.sep) || right.startsWith(left + path.sep);
}

export async function createFreshRunDirectories(directories) {
  const resolved = directories.map(({ label, target }) => ({
    label,
    target: path.resolve(target)
  }));
  for (let left = 0; left < resolved.length; left += 1) {
    for (let right = left + 1; right < resolved.length; right += 1) {
      if (overlaps(resolved[left].target, resolved[right].target)) {
        throw new Error(
          `${resolved[left].label} and ${resolved[right].label} must be separate directories`
        );
      }
    }
  }
  for (const item of resolved) {
    try {
      await lstat(item.target);
      throw new Error(`${item.label} must not already exist: ${item.target}`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  const created = [];
  try {
    for (const item of resolved) {
      await mkdir(path.dirname(item.target), { recursive: true });
      try {
        await mkdir(item.target);
        created.push(item.target);
      } catch (error) {
        if (error?.code === "EEXIST") {
          throw new Error(`${item.label} must not already exist: ${item.target}`);
        }
        throw error;
      }
    }
  } catch (error) {
    for (const target of created.reverse()) {
      await rm(target, { recursive: true, force: true });
    }
    throw error;
  }
}
