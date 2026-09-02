import { createHash } from "node:crypto";

const secretPatterns = [
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]{12,}=*\b/gi,
  /\b((?:password|passwd|pwd|token|secret|api[_ -]?key)\s*[:=]\s*)[^\s,;]+/gi
];

export function hashText(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

export function redactSecrets(value) {
  let text = String(value);
  let redactionCount = 0;

  for (const pattern of secretPatterns) {
    text = text.replace(pattern, (match, label) => {
      redactionCount += 1;
      return label ? label + "[REDACTED]" : "[REDACTED]";
    });
  }

  return { text, redactionCount };
}

export function boundedText(value, name, maximum, options = {}) {
  if (typeof value !== "string") {
    throw new TypeError(name + " must be a string");
  }

  const text = options.preserveWhitespace ? value : value.trim();
  if (!options.allowEmpty && text.length === 0) {
    throw new TypeError(name + " must not be empty");
  }
  if (text.length > maximum) {
    throw new RangeError(name + " must be at most " + maximum + " characters");
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) {
    throw new TypeError(name + " contains unsupported control characters");
  }

  return text;
}
