import assert from "node:assert/strict";
import test from "node:test";

import { atomicStatement, findSensitiveKinds, minimalExcerpt, redactText } from "../src/redaction.js";

test("redacts seeded secrets before persistence", () => {
  const input = "Use sk-test-1234567890abcdef, Bearer abcdefghijklmnopqrstuvwxyz123456, and {\"password\":\"supersecretvalue\",\"api_key\":\"api-secret-value\"}";
  const result = redactText(input);
  assert.equal(result.text.includes("sk-test-1234567890abcdef"), false);
  assert.equal(result.text.includes("abcdefghijklmnopqrstuvwxyz123456"), false);
  assert.equal(result.text.includes("supersecretvalue"), false);
  assert.equal(result.text.includes("api-secret-value"), false);
  assert.ok(result.count >= 4);
  assert.deepEqual(findSensitiveKinds(input).sort(), result.kinds.sort());
});

test("rejects transcript-shaped and oversized atomic claims", () => {
  assert.throws(() => atomicStatement("user: do A\nassistant: okay\nuser: now B"), /single line/u);
  assert.throws(() => atomicStatement("x".repeat(501)), /exceeds 500/u);
});

test("source excerpts are redacted before deterministic truncation", () => {
  const excerpt = minimalExcerpt(`password=supersecretvalue ${"a".repeat(300)}`);
  assert.ok(excerpt !== undefined);
  assert.equal(excerpt.length, 160);
  assert.equal(excerpt.includes("supersecretvalue"), false);
  assert.equal(excerpt.endsWith("…"), true);
});

test("redacts complete JSON credential values with escapes and quoted values with spaces", () => {
  const escaped = redactText(String.raw`{"password":"abc\\\"TOPSECRETVALUE987","nested":{"api_key":"value with spaces"}}`);
  assert.equal(escaped.text.includes("TOPSECRETVALUE987"), false);
  assert.equal(escaped.text.includes("value with spaces"), false);
  assert.match(escaped.text, /\[REDACTED:credential\]/u);

  const text = redactText('password: "correct horse battery staple", keep this suffix');
  assert.equal(text.text.includes("correct horse battery staple"), false);
  assert.match(text.text, /keep this suffix/u);
  assert.doesNotMatch(text.text, /REDACTED:credential:[a-f0-9]/u);
});
