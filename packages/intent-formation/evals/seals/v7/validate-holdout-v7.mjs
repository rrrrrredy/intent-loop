import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const root = path.dirname(fileURLToPath(import.meta.url));
const names = {
  corpus: 'holdout-80-v7.jsonl',
  manifest: 'holdout-manifest-v7.json',
  method: 'holdout-method-v7.md',
  validator: 'validate-holdout-v7.mjs',
};
const allowed = new Set(Object.values(names));
const specifications = {
  poorly_expressed: { count: 15, prefix: 'pe', move: 'question' },
  unformed: { count: 15, prefix: 'un', move: 'comparison' },
  conflict: { count: 15, prefix: 'co', move: 'question' },
  preference_after_result: { count: 15, prefix: 'pr', move: 'sample' },
  clear: { count: 20, prefix: 'cl', move: 'silent' },
};
const baseFields = ['id', 'class', 'language', 'domain', 'initial_prompt',
  'expected_first_move', 'final_requirements', 'unacceptable_first'];
const contentFields = ['initial_prompt', 'final_requirements', 'unacceptable_first',
  'decision_at_risk', 'follow_up'];
const expectedFeedback = { keep: 6, implementation_change: 4, intent_change: 4, uncertain: 1 };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readArtifact(name) {
  assert(allowed.has(name), 'Attempted to read an artifact outside the fixed allowlist.');
  const bytes = fs.readFileSync(path.join(root, name));
  assert(bytes.length > 0, name + ': empty file');
  assert(!(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf), name + ': UTF-8 BOM');
  assert(!bytes.includes(13), name + ': CR found; require LF only');
  assert(bytes.at(-1) === 10, name + ': missing terminal LF');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return { bytes, text, sha256: createHash('sha256').update(bytes).digest('hex') };
}

function nonemptyString(value, context) {
  assert(typeof value === 'string' && value.trim().length > 0, context + ': nonempty string required');
}

function normalizeCase(record) {
  return contentFields.flatMap((field) => {
    const value = record[field];
    return value === undefined ? [] : Array.isArray(value) ? value : [value];
  }).join(' ').normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
}

function tokenSet(text) {
  const result = new Set();
  let run = '';
  const flush = () => {
    if (run) result.add(run);
    run = '';
  };
  for (const char of text) {
    if (/\p{Script=Han}/u.test(char)) {
      flush();
      result.add(char);
    } else if (/[\p{L}\p{N}]/u.test(char)) {
      run += char;
    } else {
      flush();
    }
  }
  flush();
  return result;
}

function fourGrams(text) {
  const chars = Array.from(text);
  const grams = new Map();
  for (let i = 0; i + 4 <= chars.length; i++) {
    const gram = chars.slice(i, i + 4).join('');
    grams.set(gram, (grams.get(gram) ?? 0) + 1);
  }
  return { grams, size: Math.max(0, chars.length - 3) };
}

function intersectionSize(a, b) {
  let count = 0;
  for (const value of a) if (b.has(value)) count++;
  return count;
}

function comparePrepared(a, b) {
  const tokensCommon = intersectionSize(a.tokens, b.tokens);
  const gramsCommon = intersectionSize(a.four.grams.keys(), b.four.grams);
  let gramsCommonWithCounts = 0;
  for (const [gram, count] of a.four.grams) {
    gramsCommonWithCounts += Math.min(count, b.four.grams.get(gram) ?? 0);
  }
  return {
    token_set_jaccard: tokensCommon / (a.tokens.size + b.tokens.size - tokensCommon),
    character_4gram_dice: 2 * gramsCommon / (a.four.grams.size + b.four.grams.size),
    character_4gram_multiset_dice: 2 * gramsCommonWithCounts / (a.four.size + b.four.size),
  };
}

function validateCorpus(corpus) {
  const lines = corpus.text.slice(0, -1).split('\n');
  assert(lines.length === 80, 'Expected exactly 80 JSONL records; got ' + lines.length);
  const records = lines.map((line, i) => {
    assert(line.trim().length > 0, 'Blank JSONL line ' + (i + 1));
    try { return JSON.parse(line); }
    catch { throw new Error('Invalid JSON at line ' + (i + 1)); }
  });
  const classCounts = Object.fromEntries(Object.keys(specifications).map((key) => [key, 0]));
  const languages = { en: 0, 'zh-CN': 0 };
  const byClass = Object.fromEntries(Object.keys(specifications).map((key) => [key, { en: 0, 'zh-CN': 0 }]));
  const feedback = Object.fromEntries(Object.keys(expectedFeedback).map((key) => [key, 0]));
  const domains = new Map();
  const ids = new Set();

  for (const [index, record] of records.entries()) {
    const at = 'Line ' + (index + 1);
    assert(record && typeof record === 'object' && !Array.isArray(record), at + ': object required');
    assert(Object.hasOwn(specifications, record.class), at + ': invalid class');
    const spec = specifications[record.class];
    const expectedFields = [...baseFields];
    if (record.class !== 'clear') expectedFields.push('decision_at_risk', 'follow_up');
    if (record.class === 'preference_after_result') expectedFields.push('feedback_label');
    assert(isDeepStrictEqual(Object.keys(record), expectedFields), at + ': field order or field set differs');
    for (const field of expectedFields) {
      if (field !== 'final_requirements') nonemptyString(record[field], at + ' ' + field);
    }
    assert(Array.isArray(record.final_requirements) && record.final_requirements.length > 0,
      at + ': final_requirements must be a nonempty array');
    for (const requirement of record.final_requirements) {
      nonemptyString(requirement, at + ' final requirement');
      assert(record.initial_prompt.includes(requirement) || (record.follow_up ?? '').includes(requirement),
        record.id + ': final requirement is not a verbatim contiguous visible excerpt: ' + requirement);
    }
    assert(new Set(record.final_requirements).size === record.final_requirements.length,
      record.id + ': duplicate final requirement');
    const number = ++classCounts[record.class];
    const expectedId = 'v7-' + spec.prefix + '-' + String(number).padStart(3, '0');
    assert(record.id === expectedId, at + ': expected ID ' + expectedId);
    assert(!ids.has(record.id), at + ': duplicate ID');
    ids.add(record.id);
    assert(record.expected_first_move === spec.move, record.id + ': wrong expected_first_move');
    assert(Object.hasOwn(languages, record.language), record.id + ': invalid language');
    languages[record.language]++;
    byClass[record.class][record.language]++;
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.domain), record.id + ': invalid domain');
    domains.set(record.domain, (domains.get(record.domain) ?? 0) + 1);
    assert(domains.get(record.domain) <= 2, record.id + ': domain used more than twice');
    if (record.class === 'preference_after_result') {
      assert(Object.hasOwn(feedback, record.feedback_label), record.id + ': invalid feedback_label');
      feedback[record.feedback_label]++;
    }
    if (record.class !== 'clear') {
      const minimum = record.language === 'en' ? 20 : 8;
      assert(Array.from(record.follow_up).length >= minimum, record.id + ': frozen follow-up too short');
    }
    for (const field of ['initial_prompt', ...(record.class === 'clear' ? [] : ['follow_up'])]) {
      if (record.language === 'zh-CN') {
        assert((record[field].match(/\p{Script=Han}/gu) ?? []).length >= 8,
          record.id + ': Chinese prompt lacks Chinese text');
      } else {
        assert((record[field].match(/[A-Za-z]/g) ?? []).length >= 20,
          record.id + ': English prompt lacks English text');
        assert(!/\p{Script=Han}/u.test(record[field]), record.id + ': unexpected Han text in English prompt');
      }
    }
    const text = normalizeCase(record);
    assert(!/(?:https?:\/\/|www\.)/i.test(text), record.id + ': URL in scenario text');
    assert(!/[a-z]:[\\/]/i.test(text), record.id + ': absolute Windows path');
    assert(!/(?:^|\s)\\\\/.test(text), record.id + ': UNC path');
    assert(!/(?:^|[\s"(])\/(?:users|home|tmp|etc|var|opt|mnt|media|root|usr|workspace)(?:\/|\b)/i.test(text),
      record.id + ': absolute Unix path');
  }

  for (const [key, spec] of Object.entries(specifications)) {
    assert(classCounts[key] === spec.count, key + ': incorrect case count');
    assert(byClass[key]['zh-CN'] === 4 && byClass[key].en === spec.count - 4,
      key + ': incorrect within-class language distribution');
  }
  assert(languages.en === 60 && languages['zh-CN'] === 20, 'Incorrect total language distribution');
  assert(isDeepStrictEqual(feedback, expectedFeedback), 'Incorrect preference feedback distribution');
  assert(domains.size >= 40, 'Fewer than 40 domains');

  const prepared = records.map((record) => {
    const text = normalizeCase(record);
    return { id: record.id, tokens: tokenSet(text), four: fourGrams(text) };
  });
  const thresholds = { token_set_jaccard: 0.65, character_4gram_dice: 0.72,
    character_4gram_multiset_dice: 0.72 };
  const maxima = Object.fromEntries(Object.keys(thresholds).map((key) => [key, { value: -1, pair: [] }]));
  let pairs = 0;
  for (let i = 0; i < prepared.length; i++) {
    for (let j = i + 1; j < prepared.length; j++) {
      pairs++;
      const similarity = comparePrepared(prepared[i], prepared[j]);
      for (const [metric, value] of Object.entries(similarity)) {
        assert(Number.isFinite(value), 'Non-finite similarity');
        const pair = [prepared[i].id, prepared[j].id];
        if (value > maxima[metric].value) maxima[metric] = { value, pair };
        assert(value < thresholds[metric], metric + ' threshold reached by ' + pair.join(' / ') + ': ' + value);
      }
    }
  }
  return {
    case_count: records.length,
    distributions: { class: classCounts, language: languages, language_by_class: byClass, feedback_label: feedback },
    domains: { distinct: domains.size, max_cases_per_domain: Math.max(...domains.values()),
      counts: Object.fromEntries([...domains.entries()].sort(([a], [b]) => a.localeCompare(b, 'en'))) },
    internal_similarity: {
      pair_count: pairs,
      content_fields: contentFields,
      normalization: 'NFKC, lowercase, whitespace collapsed to one space, trim; fields joined with one space',
      tokenization: 'Individual Han code points; contiguous non-Han Unicode letter/number runs; token sets',
      character_4grams: 'Four consecutive Unicode code points including spaces and punctuation; set Dice primary, multiset Dice additionally checked',
      thresholds,
      maxima,
    },
  };
}

function describeFiles(artifacts) {
  return Object.fromEntries(Object.entries(artifacts).map(([name, artifact]) =>
    [name, { sha256: artifact.sha256, bytes: artifact.bytes.length }]));
}

function makeManifest(stats, artifacts) {
  return {
    schema_version: 'v7',
    status: 'sealed',
    corpus: names.corpus,
    ...stats,
    authoring: {
      independent: true,
      basis: 'Blind assignment and its manifest self-hash clarification only',
      synthetic_only: true,
      product_implementation_read: false,
      old_corpus_read: false,
      other_context_read: false,
      product_evaluation_started: false,
      arm_runs_before_seal: 0,
      grader_runs_before_seal: 0,
      model_eval_runs_before_seal: 0,
    },
    validation: {
      mode: 'Mechanical internal checks only; no product, arm, grader, or model calls',
      command: 'node validate-holdout-v7.mjs',
      final_requirements_are_visible_verbatim_excerpts: true,
      all_pairwise_similarity_thresholds_satisfied: true,
      encoding: 'UTF-8 without BOM, LF only, terminal LF',
    },
    files: describeFiles(artifacts),
    manifest_hash_policy: 'Coordinator clarification: manifest embeds hashes for the other three files only. The final report supplies ordinary byte hashes and byte lengths for all four files.',
  };
}

try {
  const args = process.argv.slice(2);
  assert(args.length === 0 || (args.length === 1 && args[0] === '--prepare-manifest'),
    'Usage: node validate-holdout-v7.mjs [--prepare-manifest]');
  const artifacts = Object.fromEntries([names.corpus, names.method, names.validator]
    .map((name) => [name, readArtifact(name)]));
  const stats = validateCorpus(artifacts[names.corpus]);
  const expectedManifest = makeManifest(stats, artifacts);
  if (args[0] === '--prepare-manifest') {
    process.stdout.write(JSON.stringify(expectedManifest, null, 2) + '\n');
  } else {
    const manifestArtifact = readArtifact(names.manifest);
    const manifest = JSON.parse(manifestArtifact.text);
    assert(isDeepStrictEqual(manifest, expectedManifest),
      'Manifest does not match current corpus statistics, provenance declaration, file hashes, or byte lengths.');
    process.stdout.write(JSON.stringify({
      result: 'PASS',
      checks: ['exact schema and field order', 'class/language/feedback distributions', 'IDs and domains',
        'nonempty fields', 'visible verbatim requirements', 'UTF-8/LF', 'follow-up length and language',
        'no scenario URLs or absolute paths', 'all 3160 internal pairs below thresholds', 'manifest hashes and statistics'],
      case_count: stats.case_count,
      distributions: stats.distributions,
      domains: { distinct: stats.domains.distinct, max_cases_per_domain: stats.domains.max_cases_per_domain },
      internal_similarity: stats.internal_similarity,
      files: describeFiles({ ...artifacts, [names.manifest]: manifestArtifact }),
    }, null, 2) + '\n');
  }
} catch (error) {
  process.stderr.write('FAIL: ' + error.message + '\n');
  process.exitCode = 1;
}
