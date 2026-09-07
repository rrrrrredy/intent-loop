import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Author-side checks only. No model, product, grader, network, or dependency.
const root = path.dirname(fileURLToPath(import.meta.url));
const input = path.join(root, 'author-80.jsonl');
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const normalize = text => text.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
const raw = fs.readFileSync(input, 'utf8');
check(!raw.startsWith('\uFEFF'), 'JSONL must not contain a BOM');
check(raw.endsWith('\n'), 'JSONL must end with a newline');
const lines = raw.trimEnd().split(/\r?\n/u);
const cases = lines.map((line, index) => {
  try { return JSON.parse(line); }
  catch (error) { errors.push(`Line ${index + 1}: ${error.message}`); return null; }
}).filter(Boolean);
check(lines.every(line => line.trim().length > 0), 'JSONL contains a blank line');
check(cases.length === 80, `Expected 80 cases; got ${cases.length}`);

const distribution = { poorly_expressed: 15, unformed: 15, conflict: 15, preference_after_result: 15, clear: 20 };
const prefixes = { poorly_expressed: 'pe', unformed: 'uf', conflict: 'co', preference_after_result: 'pr', clear: 'cl' };
const feedbackExpected = { keep: 6, implementation_change: 4, intent_change: 4, uncertain: 1 };
const moves = new Set(['question', 'comparison', 'sample', 'direct_delivery']);
const requiredFields = ['id', 'class', 'language', 'domain', 'initial_prompt', 'expected_first_move', 'final_requirements', 'unacceptable_first', 'decision_at_risk', 'follow_up'];
const intentOverrideIds = new Set(['fc-uf-002', 'fc-uf-005', 'fc-uf-007', 'fc-uf-008', 'fc-uf-009', 'fc-uf-015']);
const intentOverrides = {};
const ids = new Set();
const domains = new Set();
const classCounts = {};
const languageCounts = {};
const languageByClass = {};
const feedbackCounts = {};
const moveCounts = {};
const moveByClass = {};
let excerptCount = 0;
let initialExcerpts = 0;
let followUpExcerpts = 0;
let followUpCount = 0;

for (const row of cases) {
  const tag = String(row.id ?? '<missing id>');
  const hasIntentOverride = Object.hasOwn(row, 'intent_move_explicitly_requested');
  const expectedKeys = [...requiredFields, ...(row.class === 'preference_after_result' ? ['feedback_kind'] : []), ...(hasIntentOverride ? ['intent_move_explicitly_requested'] : [])].sort();
  check(JSON.stringify(Object.keys(row).sort()) === JSON.stringify(expectedKeys), `${tag}: wrong fields`);
  check(hasIntentOverride === intentOverrideIds.has(row.id), `${tag}: unexpected or missing intent-request override`);
  if (hasIntentOverride) {
    check(typeof row.intent_move_explicitly_requested === 'boolean' && row.intent_move_explicitly_requested === false, `${tag}: intent-request override must be boolean false`);
    intentOverrides[row.id] = row.intent_move_explicitly_requested;
  }
  check(Object.hasOwn(distribution, row.class), `${tag}: invalid class`);
  check(['en', 'zh'].includes(row.language), `${tag}: invalid language`);
  check(moves.has(row.expected_first_move), `${tag}: invalid first move`);
  check(new RegExp(`^fc-${prefixes[row.class] ?? 'invalid'}-\\d{3}$`, 'u').test(tag), `${tag}: id prefix or format`);
  check(!ids.has(tag), `${tag}: duplicate id`);
  ids.add(tag);
  for (const field of ['domain', 'initial_prompt', 'decision_at_risk']) {
    check(typeof row[field] === 'string' && row[field].trim().length > 0, `${tag}: empty ${field}`);
  }
  if (typeof row.domain === 'string') {
    check(/^[a-z][a-z0-9_]+$/u.test(row.domain), `${tag}: domain must be a short snake_case label`);
    check(!domains.has(normalize(row.domain)), `${tag}: duplicate domain`);
    domains.add(normalize(row.domain));
  }
  check(Array.isArray(row.final_requirements) && row.final_requirements.length > 0, `${tag}: no final requirements`);
  check(Array.isArray(row.unacceptable_first), `${tag}: unacceptable_first is not an array`);
  for (const value of row.unacceptable_first ?? []) {
    check(typeof value === 'string' && value.trim().length > 0, `${tag}: empty unacceptable action`);
  }
  if (row.class === 'clear') {
    check(row.follow_up === null, `${tag}: clear case has a follow-up`);
    check(row.expected_first_move === 'direct_delivery', `${tag}: clear case is not direct delivery`);
  } else {
    check(typeof row.follow_up === 'string' && row.follow_up.trim().length > 0, `${tag}: missing fixed follow-up`);
    followUpCount += 1;
  }
  if (row.language === 'zh') check(/\p{Script=Han}/u.test(row.initial_prompt ?? ''), `${tag}: no Chinese in Chinese prompt`);
  if (row.class === 'preference_after_result') {
    check(Object.hasOwn(feedbackExpected, row.feedback_kind), `${tag}: invalid feedback kind`);
    feedbackCounts[row.feedback_kind] = (feedbackCounts[row.feedback_kind] ?? 0) + 1;
  }
  for (const requirement of row.final_requirements ?? []) {
    excerptCount += 1;
    const validString = typeof requirement === 'string' && Array.from(requirement.replace(/\s/gu, '')).length >= 12;
    check(validString, `${tag}: trivial or non-string requirement`);
    if (!validString) continue;
    const fromInitial = row.initial_prompt.includes(requirement);
    const fromFollowUp = typeof row.follow_up === 'string' && row.follow_up.includes(requirement);
    check(fromInitial || fromFollowUp, `${tag}: requirement is not one exact contiguous user-message excerpt: ${JSON.stringify(requirement)}`);
    if (fromInitial) initialExcerpts += 1;
    else if (fromFollowUp) followUpExcerpts += 1;
  }
  classCounts[row.class] = (classCounts[row.class] ?? 0) + 1;
  languageCounts[row.language] = (languageCounts[row.language] ?? 0) + 1;
  languageByClass[row.class] ??= { en: 0, zh: 0 };
  languageByClass[row.class][row.language] += 1;
  moveCounts[row.expected_first_move] = (moveCounts[row.expected_first_move] ?? 0) + 1;
  moveByClass[row.class] ??= {};
  moveByClass[row.class][row.expected_first_move] = (moveByClass[row.class][row.expected_first_move] ?? 0) + 1;
}

for (const [kind, count] of Object.entries(distribution)) {
  check(classCounts[kind] === count, `${kind}: expected ${count} cases`);
  check(languageByClass[kind]?.zh === 4, `${kind}: expected 4 Chinese cases`);
  check(languageByClass[kind]?.en === count - 4, `${kind}: wrong English count`);
  const expectedIds = Array.from({ length: count }, (_, i) => `fc-${prefixes[kind]}-${String(i + 1).padStart(3, '0')}`);
  check(expectedIds.every(id => ids.has(id)), `${kind}: missing sequential id`);
}
for (const [kind, count] of Object.entries(feedbackExpected)) check(feedbackCounts[kind] === count, `${kind}: expected ${count} feedback cases`);
check(languageCounts.en === 60 && languageCounts.zh === 20, 'Expected 60 English and 20 Chinese cases');
check(domains.size === 80, 'Expected 80 distinct domain labels');
check(followUpCount === 60, 'Expected 60 fixed follow-ups');

const tokenPattern = /\p{Script=Han}|(?:(?!\p{Script=Han})[\p{L}\p{N}])+/gu;
const tokens = text => new Set(normalize(text).match(tokenPattern) ?? []);
const grams = text => {
  const points = Array.from(normalize(text));
  return new Set(Array.from({ length: Math.max(0, points.length - 3) }, (_, i) => points.slice(i, i + 4).join('')));
};
const overlap = (a, b) => { let n = 0; for (const item of a) if (b.has(item)) n += 1; return n; };
const jaccard = (a, b) => { const n = overlap(a, b); return a.size + b.size - n === 0 ? 0 : n / (a.size + b.size - n); };
const dice = (a, b) => a.size + b.size === 0 ? 0 : 2 * overlap(a, b) / (a.size + b.size);
const views = {
  scenario_text: cases.map(row => [row.id, [
    row.initial_prompt,
    ...row.final_requirements,
    ...row.unacceptable_first,
    row.decision_at_risk,
    row.follow_up,
  ].filter(value => typeof value === 'string').join(' ')]),
};
const similarities = {};
for (const [name, texts] of Object.entries(views)) {
  const signatures = texts.map(([id, text]) => ({ id, tokens: tokens(text), grams: grams(text) }));
  const maximum = {
    token_set_jaccard: { score: 0, ids: [] },
    codepoint_4gram_set_dice: { score: 0, ids: [] },
  };
  let pairs = 0;
  for (let i = 0; i < signatures.length; i += 1) {
    for (let j = i + 1; j < signatures.length; j += 1) {
      pairs += 1;
      const a = signatures[i];
      const b = signatures[j];
      const values = {
        token_set_jaccard: jaccard(a.tokens, b.tokens),
        codepoint_4gram_set_dice: dice(a.grams, b.grams),
      };
      for (const [metric, score] of Object.entries(values)) {
        if (score > maximum[metric].score) maximum[metric] = { score, ids: [a.id, b.id] };
        const threshold = metric === 'codepoint_4gram_set_dice' ? 0.72 : 0.65;
        check(score < threshold, `${name}: ${metric} ${score} reaches ${threshold} for ${a.id}/${b.id}`);
      }
    }
  }
  similarities[name] = { cases: signatures.length, pairs, maximum };
}

const report = {
  status: errors.length === 0 ? 'pass' : 'fail',
  case_count: cases.length,
  domain_count: domains.size,
  class_counts: classCounts,
  language_counts: languageCounts,
  language_by_class: languageByClass,
  follow_up_count: followUpCount,
  feedback_counts: feedbackCounts,
  expected_first_move_counts: moveCounts,
  expected_first_move_by_class: moveByClass,
  intent_move_explicitly_requested_overrides: intentOverrides,
  exact_excerpts: { total: excerptCount, initial_prompt: initialExcerpts, follow_up: followUpExcerpts },
  similarity_spec: {
    normalization: ['NFKC', 'lowercase', 'whitespace collapse'],
    token_regex: String(tokenPattern),
    scenario_fields_in_order: ['initial_prompt', 'final_requirements[]', 'unacceptable_first[]', 'decision_at_risk', 'follow_up'],
    join: 'single space before normalization; null follow-up omitted',
    character_grams: 'Unicode code point 4-gram sets',
  },
  thresholds: { token_set_jaccard: 0.65, codepoint_4gram_set_dice: 0.72, comparison: 'strictly below' },
  similarities,
  limitations: ['Substring checks do not prove semantic chronology.', 'Distinct labels and lexical distance do not prove semantic independence.', 'No products, graders, or models are executed.'],
  errors,
};
console.log(JSON.stringify(report, null, 2));
process.exitCode = errors.length === 0 ? 0 : 1;
