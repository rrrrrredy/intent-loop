import { createHash, randomUUID } from "node:crypto";
import { realpathSync, statSync } from "node:fs";
import path from "node:path";

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function canonicalProjectRoot(projectRoot: string): string {
  if (!projectRoot.trim()) {
    throw new Error("project_root must not be empty");
  }
  if (!path.isAbsolute(projectRoot)) {
    throw new Error("project_root must be an absolute local path");
  }
  if (
    process.platform === "win32" &&
    (/^[\\/]{2}/u.test(projectRoot) || /^[\\/]\?\?[\\/]/u.test(projectRoot))
  ) {
    throw new Error("project_root must not use a Windows UNC or device namespace");
  }
  const resolved = realpathSync.native(projectRoot);
  if (!statSync(resolved).isDirectory()) {
    throw new Error("project_root must resolve to an existing local directory");
  }
  return process.platform === "win32" ? resolved.toLocaleLowerCase("en-US") : resolved;
}

export function projectIdForRoot(projectRoot: string): string {
  return sha256(`intent-loop-project-v1\0${canonicalProjectRoot(projectRoot)}`);
}

export function hostSessionHash(sessionId: string): string {
  return sha256(`intent-loop-session-v1\0${sessionId}`);
}
