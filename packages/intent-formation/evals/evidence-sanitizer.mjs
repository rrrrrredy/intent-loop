export function createEvidenceSanitizer() {
  const sanitization = {
    control_characters_replaced: 0,
    local_paths_replaced: 0,
    secret_patterns_replaced: 0,
    strings_truncated: 0,
    note: "Published response and grade strings are not length-truncated. Control characters, machine-local paths, and common credential patterns are replaced and counted. Grader rationale and violation lengths are bounded by the published output schema before this step."
  };

  function countedReplace(text, pattern, replacement, key) {
    return text.replace(pattern, (...args) => {
      sanitization[key] += 1;
      return typeof replacement === "function" ? replacement(...args) : replacement;
    });
  }

  function sanitizeString(value) {
    let text = String(value);
    text = countedReplace(
      text,
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/gu,
      "�",
      "control_characters_replaced"
    );
    text = countedReplace(
      text,
      /(?:\\\\\?\\)?\b[A-Za-z]:[\\/][^\s"'<>|]+/gu,
      "[local path omitted]",
      "local_paths_replaced"
    );
    text = countedReplace(
      text,
      /(^|\s)\/(?:Users|home|tmp|private|var\/folders)\/[^\s"'<>]+/gu,
      (match, prefix) => prefix + "[local path omitted]",
      "local_paths_replaced"
    );
    for (const pattern of [
      /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/gu,
      /\bgh[pousr]_[A-Za-z0-9]{20,}\b/gu,
      /\bAKIA[0-9A-Z]{16}\b/gu,
      /\bBearer\s+[A-Za-z0-9._~+/-]{12,}=*\b/giu
    ]) {
      text = countedReplace(text, pattern, "[REDACTED]", "secret_patterns_replaced");
    }
    text = countedReplace(
      text,
      /\b((?:password|passwd|pwd|token|secret|api[_ -]?key)\s*[:=]\s*)[^\s,;]+/giu,
      (match, label) => label + "[REDACTED]",
      "secret_patterns_replaced"
    );
    return text;
  }

  function sanitizeValue(value) {
    if (typeof value === "string") return sanitizeString(value);
    if (Array.isArray(value)) return value.map(sanitizeValue);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, sanitizeValue(item)])
      );
    }
    return value;
  }

  return { sanitization, sanitizeString, sanitizeValue };
}
