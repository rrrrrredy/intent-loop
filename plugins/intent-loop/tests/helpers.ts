import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { TestContext } from "node:test";

export async function testWorkspace(t: TestContext): Promise<{ root: string; data: string; project: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "intent-loop-test-"));
  const data = path.join(root, "data");
  const project = path.join(root, "project");
  await mkdir(data, { recursive: true });
  await mkdir(project, { recursive: true });
  t.after(async () => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }));
  return { root, data, project };
}

export function requestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
