import { IntentLoopError } from "./errors.js";

interface PatternRule {
  kind: string;
  pattern: RegExp;
}

const RULES: PatternRule[] = [
  { kind: "private-key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/giu },
  { kind: "bearer", pattern: /\bBearer\s+[A-Za-z0-9._~+\/-]{12,}={0,2}\b/giu },
  { kind: "openai-key", pattern: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{16,}\b/gu },
  { kind: "github-token", pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/gu },
  { kind: "aws-key", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/gu },
  { kind: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/gu },
  {
    kind: "credential",
    pattern: /["'](?:password|passwd|secret|api[_-]?key|access[_-]?token)["']\s*:\s*(?:"(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*'|[^\s,;"']+)/giu
  },
  {
    kind: "credential",
    pattern: /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*(?:"(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*'|[^\s,;"']+)/giu
  },
  { kind: "high-entropy-token", pattern: /\b(?=[A-Za-z0-9_\/-]{32,}\b)(?=[A-Za-z0-9_\/-]*[A-Za-z])(?=[A-Za-z0-9_\/-]*\d)[A-Za-z0-9_\/-]{32,}\b/gu }
];

const CREDENTIAL_KEY = /^(?:password|passwd|secret|api[_-]?key|access[_-]?token)$/iu;

export interface RedactionResult {
  text: string;
  count: number;
  kinds: string[];
}

function applyRules(input: string, rules: PatternRule[] = RULES): RedactionResult {
  let text = input;
  let count = 0;
  const kinds = new Set<string>();
  for (const rule of rules) {
    text = text.replace(rule.pattern, () => {
      count += 1;
      kinds.add(rule.kind);
      return `[REDACTED:${rule.kind}]`;
    });
  }
  return { text, count, kinds: [...kinds].sort() };
}

function redactJson(input: string): RedactionResult | null {
  const trimmed = input.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  let count = 0;
  const kinds = new Set<string>();
  const visit = (value: unknown): unknown => {
    if (typeof value === "string") {
      const result = applyRules(value, RULES.filter((rule) => rule.kind !== "credential"));
      count += result.count;
      for (const kind of result.kinds) kinds.add(kind);
      return result.text;
    }
    if (Array.isArray(value)) return value.map(visit);
    if (value !== null && typeof value === "object") {
      const output: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (CREDENTIAL_KEY.test(key)) {
          output[key] = "[REDACTED:credential]";
          count += 1;
          kinds.add("credential");
        } else {
          output[key] = visit(child);
        }
      }
      return output;
    }
    return value;
  };
  return { text: JSON.stringify(visit(parsed)), count, kinds: [...kinds].sort() };
}

export function redactText(input: string): RedactionResult {
  return redactJson(input) ?? applyRules(input);
}

export function atomicStatement(input: string, maxLength = 500): RedactionResult {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new IntentLoopError("INVALID_STATEMENT", "statement must be non-empty");
  }
  if (input.length > 4000) {
    throw new IntentLoopError("RAW_PROMPT_REJECTED", "statement is too long for an atomic intent claim");
  }
  if (/[\r\n]/u.test(input)) {
    throw new IntentLoopError("RAW_PROMPT_REJECTED", "an atomic intent claim must be a single line");
  }
  const result = redactText(input.trim());
  if (result.text.length > maxLength) {
    throw new IntentLoopError("INVALID_STATEMENT", `statement exceeds ${maxLength} characters after redaction`);
  }
  return result;
}

export function minimalExcerpt(input: string | undefined): string | undefined {
  if (input === undefined || input.trim().length === 0) {
    return undefined;
  }
  const redacted = redactText(input.trim()).text.replace(/\s+/gu, " ");
  return redacted.length <= 160 ? redacted : `${redacted.slice(0, 159)}…`;
}

export function findSensitiveKinds(input: string): string[] {
  return redactText(input).kinds;
}

export function findKnownCredentialKinds(input: string): string[] {
  return redactText(input).kinds.filter((kind) => kind !== "high-entropy-token");
}
