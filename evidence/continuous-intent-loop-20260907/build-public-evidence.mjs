// Bounded archival of the two approved continuous-loop cases; no model/network calls.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const candidate = 'c970c28f208f1055ca5983702ff042eafc9c7669';
const privateManifestSha = '1503ca34936ed859fbbeb72bc6d5e25008b5036c1b4ca14559586f90feca4be0';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sort = rows => [...rows].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
const descriptorHash = rows => sha(JSON.stringify(sort(rows.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })))) + '\n');
const json = async name => JSON.parse(await readFile(path.join(here, name), 'utf8'));
const uuid = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/giu;
const opaque = /\b(?:rec|evt)_[0-9a-f]{32}\b/giu;
const cleanAnsi = value => value.replace(/\x1b\][^\x07]*(?:\x07)/gu, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/gu, '').replaceAll('\r', '');
function assertPublic(name, bytes) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  assert(!bytes.subarray(0, 3).equals(Buffer.from([239, 187, 191])), `${name}: BOM`);
  assert(!text.includes('\r') && text.endsWith('\n'), `${name}: LF/final newline`);
  for (const pattern of [uuid, opaque, /\b[A-Za-z]:[\\/]/u, /(?:^|[\s"'(])\/+\b(?:Users|home|tmp|mnt|var|etc|opt|usr|private|Volumes)\//u, /\\\\[A-Za-z0-9_.-]+\\[A-Za-z0-9_$.-]+/u, /(?:sk|gh[pousr])[-_][A-Za-z0-9]{20,}/u, /\bBearer\s+[A-Za-z0-9._-]{16,}/u, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u]) {
    pattern.lastIndex = 0;
    assert(!pattern.test(text), `${name}: disallowed public pattern ${pattern.source}`);
  }
  if (name.endsWith('.json')) {
    const inspect = value => {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        assert(!/^(?:auth|authorization|authentication|access_token|refresh_token|id_token|api_key|password|cookie|environment)(?:_|$)/iu.test(key), `${name}: excluded field ${key}`);
        inspect(child);
      }
    };
    inspect(JSON.parse(text));
  }
}
async function publicFiles(dir = here, prefix = '') {
  const rows = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    assert(!entry.isSymbolicLink(), 'No links in archive');
    const rel = prefix + entry.name;
    if (entry.isDirectory()) rows.push(...await publicFiles(path.join(dir, entry.name), rel + '/'));
    else {
      assert(entry.isFile(), 'Only ordinary files');
      const bytes = await readFile(path.join(dir, entry.name));
      assertPublic(rel, bytes);
      rows.push({ path: rel, bytes: bytes.length, sha256: sha(bytes) });
    }
  }
  return sort(rows);
}
function git(repo, args) {
  const result = spawnSync('git', ['-C', repo, ...args], { maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  assert.equal(result.status, 0, result.stderr?.toString());
  return result.stdout;
}
async function build(source, repo) {
  assert(source && repo, 'Usage: --build <private-source-directory> <repository-directory>');
  source = path.resolve(source);
  assert.notEqual(source, here);
  const manifestBytes = await readFile(path.join(source, 'evidence-manifest.json'));
  assert.equal(sha(manifestBytes), privateManifestSha, 'Pinned private manifest');
  const privateManifest = JSON.parse(manifestBytes);
  assert.equal(privateManifest.file_count, 53);
  const readSource = async name => {
    const descriptor = privateManifest.files.find(row => row.path === name);
    assert(descriptor && !name.includes('..') && !path.isAbsolute(name));
    const bytes = await readFile(path.join(source, name));
    assert.equal(bytes.length, descriptor.bytes, name);
    assert.equal(sha(bytes), descriptor.sha256, name);
    return bytes;
  };
  const sourceJson = async name => JSON.parse(await readSource(name));
  for (const row of privateManifest.files) await readSource(row.path);
  const plan = await sourceJson('approved-cases.json');
  const originalChecks = await sourceJson('verified-loop-results.json');
  const installed = await sourceJson('installed-fingerprints.json');
  const fixed = await sourceJson('source-fingerprints.json');
  const trust = await sourceJson('normal-trust-ui.json');
  const nativeCleanup = await sourceJson('native-cleanup-results.json');
  const filesystem = await sourceJson('cleanup-filesystem.json');
  const harness = await sourceJson('verification-harness-notes.json');
  assert.equal(originalChecks.candidate, candidate);
  const originals = [];
  for (const chosen of plan.cases) for (let index = 0; index < chosen.prompts.length; index++) {
    const stem = `${chosen.id}-${String(index + 1).padStart(2, '0')}`;
    const meta = await sourceJson(stem + '.meta.json');
    const capture = await sourceJson(stem + '.capture.json');
    const events = (await readSource(stem + '.events.jsonl')).toString('utf8').trim().split(/\r?\n/u).map(JSON.parse);
    const answer = (await readSource(stem + '.answer.md')).toString('utf8');
    assert.equal(meta.prompt, chosen.prompts[index]);
    originals.push({ stem, meta, capture, events, answer });
  }
  const ids = new Map();
  for (const row of originals) {
    ids.set(row.meta.session_id, `task-${row.meta.case_id}`);
    assert.equal(row.capture.native_turn_contexts.length, 1);
    ids.set(row.capture.native_turn_contexts[0].turn_id, `turn-${row.stem}`);
  }
  ids.set(trust.onboarding_task_id, 'task-onboarding-01');
  let recordCount = 0;
  for (const row of originals) for (const event of row.events) {
    const record = event.item?.result?.structured_content?.data?.record;
    if (event.type === 'item.completed' && record && !ids.has(record.record_id)) ids.set(record.record_id, `record-${String(++recordCount).padStart(2, '0')}`);
  }
  const cwd = originals.find(row => row.meta.case_id === 'case08').meta.cwd;
  const redactText = value => {
    let text = value;
    for (const [raw, replacement] of ids) text = text.replaceAll(raw, replacement);
    for (const variant of new Set([cwd, cwd.replaceAll('\\', '/'), cwd.replaceAll('\\', '\\\\')])) text = text.replaceAll(variant, 'artifacts');
    text = text.replaceAll('artifacts\\', 'artifacts/');
    text = text.replace(/^"[^"\n]*pwsh\.exe"(?= -Command )/u, '"pwsh"');
    return text;
  };
  const redact = value => typeof value === 'string' ? redactText(value) : Array.isArray(value) ? value.map(redact) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, redact(child)])) : value;
  const selectRecord = record => Object.fromEntries(['record_id', 'statement', 'role', 'epistemic_status', 'source_ref', 'scope', 'scope_ref', 'supersedes', 'user_confirmed', 'feedback_class', 'status'].filter(key => key in record).map(key => [key, record[key]]));
  const turns = [], captures = [], calls = [];
  for (const row of originals) {
    const { meta, capture, events, answer, stem } = row;
    const items = events.filter(event => event.type === 'item.completed').map(event => event.item);
    const nativeTurn = capture.native_turn_contexts[0];
    const currentTurn = capture.hook_contexts.find(hook => hook.kind === 'continuity_context' && hook.data?.turn_id)?.data.turn_id ?? null;
    turns.push(redact({ id: `turn-${stem}`, case_id: meta.case_id, turn: meta.turn, task_ref: meta.session_id, prompt: meta.prompt, final_answer: answer, assistant_messages: items.filter(item => item.type === 'agent_message').map(item => ({ id: item.id, text: item.text })), model: meta.model, effort: meta.effort, candidate: meta.candidate, native_context: { turn_id: nativeTurn.turn_id, model: nativeTurn.model, effort: nativeTurn.effort }, native_mode: meta.argv.includes('resume') ? 'resume' : 'exec', new_cli_process: true, tool_approval: meta.approval, normal_hook_trust: meta.normal_hook_trust, hook_trust_bypass: meta.hook_trust_bypass, argv_contains_bypass: meta.argv.some(arg => arg.includes('bypass')), completed: events.some(event => event.type === 'turn.completed'), exit_code: meta.exit_code, elapsed_ms: meta.elapsed_ms, usage: events.find(event => event.type === 'turn.completed')?.usage, file_tool_items: items.filter(item => ['command_execution', 'file_change'].includes(item.type)) }));
    captures.push(redact({ turn_ref: `turn-${stem}`, task_ref: meta.session_id, current_turn_id: currentTurn, hook_contexts: capture.hook_contexts.map(({ kind, text, data, parse_error }) => ({ kind, text, data, parse_error })), private_ledger_bytes: capture.state_ledger_bytes, private_ledger_sha256: capture.state_ledger_sha256, persisted_task_refs: [...new Set(capture.state_events.map(event => event.task_id))] }));
    for (const item of items.filter(item => item.type === 'mcp_tool_call')) {
      const result = item.result.structured_content;
      calls.push(redact({ turn_ref: `turn-${stem}`, current_turn_id: currentTurn, item_id: item.id, server: item.server, tool: item.tool, arguments: item.arguments, result: { ok: result.ok, source: result.source, receipt_id: result.receipt_id, content: item.result.content, record: selectRecord(result.data.record), snapshot: { exists: result.data.snapshot.exists, task_id: result.data.snapshot.task_id, mode: result.data.snapshot.mode, records: result.data.snapshot.records.map(selectRecord), active_record_ids: result.data.snapshot.active_records.map(record => record.record_id) } }, error: item.error, status: item.status }));
    }
  }
  // The remainder builds fixed-Git fingerprints and the small publication set.
  const outputs = new Map();
  const put = (name, value) => outputs.set(name, Buffer.from(JSON.stringify(value, null, 2) + '\n'));
  put('cases.json', { schema_version: 1, candidate, case_count: 2, user_turn_count: 6, cases: plan.cases.map(({ id, title }) => ({ id, title })), prompt_comparison_with_frozen_plan: 'All six exact strings matched the retained pre-run plan.', turns });
  put('continuity-evidence.json', { schema_version: 1, candidate, interpretation: 'Selected actual Hook text/data and native MCP arguments/results; runtime identifiers consistently substituted, not fabricated events.', native_event_field_boundary: 'Non-null Hook output matches the native turn context; fixed source binds ordinary continuity only to event.turn_id. This is indirect field evidence, not a separately recorded raw Hook input event.', captures, mcp_calls: calls });
  assert.equal(installed.fixed_commit, candidate);
  assert.equal(fixed.fixed_commit, candidate);
  const comparisons = [];
  const trees = installed.trees.map(tree => {
    const prefix = `plugins/${tree.name}/`;
    const names = git(repo, ['ls-tree', '-r', '--name-only', candidate, '--', prefix]).toString('utf8').trim().split('\n').map(name => name.slice(prefix.length));
    assert.deepEqual(names.sort(), tree.files.map(row => row.path).sort());
    const files = tree.files.map(row => {
      const bytes = git(repo, ['show', `${candidate}:${prefix}${row.path}`]);
      const fixedRow = { path: row.path, bytes: bytes.length, sha256: sha(bytes) };
      const sourceRow = fixed.files.find(file => file.path === prefix + row.path);
      assert.equal(sourceRow?.sha256, fixedRow.sha256);
      assert.equal(sourceRow?.bytes, fixedRow.bytes);
      assert.deepEqual(row, fixedRow, `${prefix}${row.path}`);
      comparisons.push({ path: prefix + row.path, installed_bytes: row.bytes, installed_sha256: row.sha256, fixed_git_bytes: fixedRow.bytes, fixed_git_sha256: fixedRow.sha256, match: true });
      return row;
    });
    assert.equal(descriptorHash(files), tree.descriptor_tree_sha256);
    assert.equal(files.reduce((sum, row) => sum + row.bytes, 0), tree.bytes);
    return { name: tree.name, version: tree.version, file_count: files.length, bytes: tree.bytes, installed_descriptor_sha256: descriptorHash(files), fixed_git_descriptor_sha256: descriptorHash(files), git_tree_object_id: git(repo, ['rev-parse', `${candidate}:${prefix.slice(0, -1)}`]).toString('utf8').trim(), files };
  });
  for (const row of [...fixed.files, ...fixed.owned_sources, ...fixed.unchanged_boundary]) {
    const bytes = git(repo, ['show', `${candidate}:${row.path}`]);
    assert.equal(sha(bytes), row.sha256, row.path);
    if (row.bytes !== undefined) assert.equal(bytes.length, row.bytes, row.path);
  }
  put('installation-verification.json', { schema_version: 1, candidate, comparison_source: 'Recorded pre-cleanup installed bytes rechecked against immutable fixed Git blobs, not the present worktree.', installed_file_count: comparisons.length, fixed_source_file_count: fixed.files.length, descriptor_algorithm: installed.algorithm, git_object_format: git(repo, ['rev-parse', '--show-object-format']).toString('utf8').trim(), trees, comparisons: sort(comparisons), fixed_source_files: fixed.files, reviewed_owned_sources: fixed.owned_sources, reviewed_diff_sha256: fixed.reviewed_diff_sha256, previously_reviewed_unchanged_boundary: fixed.unchanged_boundary, later_policy_bytes_tested: false });
  const artifacts = [];
  for (const row of originalChecks.artifacts) {
    const bytes = await readSource(row.path);
    assert.equal(sha(bytes), row.sha256);
    outputs.set(row.path, bytes);
    const fixture = plan.cases[1].fixtures[path.basename(row.path)];
    artifacts.push({ ...row, original_fixture_sha256: fixture === undefined ? null : sha(Buffer.from(fixture)) });
  }
  const overview = cleanAnsi(trust.records.find(row => row.action === 'verify all active in overview').terminal_excerpt).split('\n').filter(line => /^\s*(?:SessionStart|UserPromptSubmit)\s/u.test(line)).map(line => line.trimEnd()).join('\n');
  assert(/SessionStart\s+1\s+1/u.test(overview));
  assert(/UserPromptSubmit\s+2\s+2/u.test(overview));
  const trustRows = trust.records.filter(row => row.action.startsWith('trust reviewed')).map(row => {
    const text = cleanAnsi(row.terminal_excerpt);
    return { action: row.action, exact_selected_fields: [/Event\s+\w+/u, /Matcher\s+resume\|compact/u, /MCP Server\s+intent_formation_policy/u, /MCP Tool\s+get_intent_policy/u, /Trust\s+Trusted/u].flatMap(pattern => text.match(pattern)?.[0] ?? []) };
  });
  const warnings = [];
  for (const row of originals) {
    const stderr = (await readSource(row.stem + '.stderr.txt')).toString('utf8');
    warnings.push({ turn_ref: `turn-${row.stem}`, exact_warning_text_without_timestamp: stderr.trim().split(/\r?\n/u).filter(Boolean).map(line => redactText(line.slice(line.indexOf('WARN')))) });
  }
  put('verification.json', { schema_version: 1, candidate, classification: originalChecks.classification, case_count: 2, user_requests: 6, model: 'gpt-5.6-sol', effort: 'low', automatic_mcp_successes: 5, manual_hook_successes: 1, extra_model_or_grader_requests: 0, content_retries: 0, compaction_requests: 0, strict_no_history_causal_isolation: false, baseline: false, historical_19_offline_checks_included: false, later_policy_bytes_tested: false, checks: originalChecks.checks, failed_checks: originalChecks.failed_checks, exact_receipt_correspondence: redact(originalChecks.receipts), artifacts, input_fixture_contents: plan.cases[1].fixtures, failed_model_tool_items: redact(originalChecks.failed_model_tool_items), normal_trust: { cli_version: trust.cli_version, node_version: '22.19.0', normal_per_hook_trust: trust.normal_per_hook_trust, hook_trust_bypass: trust.hook_trust_bypass, no_model_prompt_during_onboarding: trust.model_prompts_submitted === 0, non_administrator_sandbox: trust.non_administrator_sandbox, selection_disclosure: 'Only exact relevant trust fields and the two final Active rows; ANSI, local command paths, account banners, unrelated UI and animation omitted.', reviewed_hooks: trustRows, exact_final_active_rows: overview, sandbox_ready_observed: trust.records.some(row => row.terminal_excerpt.includes('Sandbox ready')), later_tool_approval: 'approve-for-me; distinct from normal Hook trust' }, host_warnings: warnings, local_harness_correction: harness, retained_friction: [
    { id: 'non-git-verification', observation: 'The file task ran git status and git diff outside a repository. One command failed and also produced an irrelevant comparison of different inputs. Independent byte checks, not that Git attempt, establish unchanged inputs.', attribution: 'Observed agent verification error; no claim the plugin caused it.' },
    { id: 'feedback-lifetime', observation: 'Layout-only feedback remained at task scope after the purpose changed. No wrong goal or answer was observed, but retaining one-off execution feedback raises a sparsity/lifetime question.' },
    { id: 'small-request-overhead', observation: 'Small answers still involved State writes and short preparatory commentary. No matched timing baseline establishes a time saving.' },
    { id: 'installation-ui', observation: 'Workspace trust, three Hook reviews and non-administrator sandbox setup were required; TERM=dumb made navigation awkward. Official plugin listing reported both local plugins enabled but warned that a remote catalog response could not be parsed. Remote query/account fields are omitted.' },
    { id: 'native-empty-delete', observation: 'Two real model tasks were deleted successfully; a no-prompt onboarding task returned a generic native delete failure. Exact cleanup outcomes are retained separately.' }
  ] });
  put('cleanup.json', { schema_version: 1, candidate, all_six_model_requests_exited: nativeCleanup.all_six_model_requests_exited, commands: redact(nativeCleanup.commands), session_files_remaining: nativeCleanup.session_files_remaining, filesystem: { targets: filesystem.targets, official_model_task_deletions: filesystem.official_model_task_deletions, empty_onboarding_deletion_failed: filesystem.empty_onboarding_deletion_failed, official_plugin_removals: filesystem.official_plugin_removals, official_marketplace_removals: filesystem.official_marketplace_removals, session_files_after_native_delete: filesystem.session_files_after_native_delete, synthetic_runtime_state_removed: filesystem.synthetic_runtime_state_removed, removed_only_exact_scoped_directories: filesystem.removed_only_exact_scoped_directories }, boundary: 'After closing all model processes, official removals succeeded without a file-in-use error. The failed empty-onboarding deletion is not counted as a success. Exact isolated home/source/workspace removal and absence are recorded; only redacted synthetic evidence remains public.' });
  for (const [name, bytes] of outputs) assertPublic(name, bytes);
  for (const [name, bytes] of outputs) {
    await mkdir(path.dirname(path.join(here, name)), { recursive: true });
    await writeFile(path.join(here, name), bytes);
  }
  const artifactHashes = (await publicFiles()).filter(row => row.path !== 'manifest.json');
  const manifest = { schema_version: 1, candidate, source_preservation: { original_manifest_sha256: privateManifestSha, original_manifest_bytes: manifestBytes.length, original_file_count: 53, all_original_file_hashes_verified_before_and_after: true, originals_modified: false, source_hashes_are_provenance_not_public_access: true }, source_hashes: privateManifest.files, redactions: { native_identifiers: 'Task and turn UUIDs become task-case07/task-case08/task-onboarding-01 and turn-caseNN-NN. Record IDs become record-01 through record-05 in creation order. No reversible raw-ID map is published.', retained_equalities: 'The same substitutions apply across prompts/answers, Hook JSON and text, MCP arguments/results, supersedes references and native cleanup.', receipts: 'All six IF receipt strings remain unchanged; they are success receipts, not runtime UUIDs.', paths: 'Machine-specific output links and file changes become artifacts-relative paths; the command executable path becomes pwsh. Other local paths and host fields are omitted.', selected_fields: 'Prompts and final answers are complete apart from disclosed path substitutions. All assistant messages and file-tool completions are retained. MCP arguments/content and relevant record/snapshot fields are retained, excluding duplicated display summaries and timestamps. Hook text/data are retained. Raw ledgers, environment and account material are not published.', source_manifest: 'The sealed pre-run plan still has its original prepared status; execution identity comes from actual metadata, not a rewritten plan.' }, validation: { model_requests_added_by_archival: 0, cases: 2, user_turns: 6, live_consistency_checks: 15, successful_automatic_mcp_writes: 5, successful_manual_hook_results: 1, installed_files_match_fixed_git: 27, fixed_source_files_match_fixed_git: 28, normal_hook_trust: true, bypass_invocations: 0, no_history_causal_isolation: false, efficacy_baseline: false, later_policy_bytes_tested: false, redaction_scan_boundary: 'Pattern scanning and explicit field selection are not a universal secrecy proof.' }, artifact_hash_algorithm: 'SHA256 of actual published bytes; manifest excludes itself.', artifacts: artifactHashes };
  const publicManifest = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  assertPublic('manifest.json', publicManifest);
  for (const row of privateManifest.files) await readSource(row.path);
  assert.equal(sha(await readFile(path.join(source, 'evidence-manifest.json'))), privateManifestSha);
  await writeFile(path.join(here, 'manifest.json'), publicManifest);
}

async function verify() {
  const manifest = await json('manifest.json');
  const actual = (await publicFiles()).filter(row => row.path !== 'manifest.json');
  assert.deepEqual(actual, manifest.artifacts, 'Actual published-byte inventory');
  assert.equal(manifest.candidate, candidate);
  assert.equal(manifest.source_preservation.original_manifest_sha256, privateManifestSha);
  assert.equal(manifest.source_hashes.length, 53);
  const cases = await json('cases.json');
  const evidence = await json('continuity-evidence.json');
  const verification = await json('verification.json');
  const install = await json('installation-verification.json');
  const cleanup = await json('cleanup.json');
  for (const object of [cases, evidence, verification, install, cleanup]) assert.equal(object.candidate, candidate);
  const turns = cases.turns;
  const byId = new Map(turns.map(turn => [turn.id, turn]));
  assert.equal(byId.size, 6);
  assert.equal(cases.cases.length, 2);
  const capture = turn => evidence.captures.find(row => row.turn_ref === turn);
  const calls = evidence.mcp_calls;
  const first = calls.find(call => call.turn_ref === 'turn-case07-02');
  const feedback = calls.find(call => call.tool === 'intent_feedback');
  const change = calls.find(call => call.tool === 'intent_correct');
  const unknown = calls.find(call => call.tool === 'intent_mark_unknown');
  const oldRecord = first.result.record, newRecord = change.result.record, unknownRecord = unknown.result.record;
  const four = capture('turn-case07-04'), five = capture('turn-case07-05'), control = capture('turn-case08-01');
  const start = capture('turn-case07-01').hook_contexts[0].data;
  const ordinary = turns.filter(turn => turn.case_id === 'case07' && turn.turn > 1);
  const csv = await readFile(path.join(here, 'artifacts/badge-status.csv'), 'utf8');
  const checks = {
    exactly_six_completed_approved_requests: turns.length === 6 && turns.every(turn => turn.completed && turn.exit_code === 0) && cases.prompt_comparison_with_frozen_plan.startsWith('All six exact strings matched'),
    exact_model_effort_and_candidate: turns.every(turn => turn.model === 'gpt-5.6-sol' && turn.effort === 'low' && turn.candidate === candidate && turn.native_context.model === turn.model && turn.native_context.effort === turn.effort),
    zero_hook_trust_bypass: turns.every(turn => turn.normal_hook_trust && !turn.hook_trust_bypass && !turn.argv_contains_bypass) && !verification.normal_trust.hook_trust_bypass,
    real_start_receipt: start.ok && start.source === 'intent_formation_hook' && /^IF-[A-F0-9]{8}$/u.test(start.receipt_id) && turns[0].final_answer.includes(start.receipt_id),
    native_ordinary_turn_id_present_and_matches: ordinary.every(turn => capture(turn.id).current_turn_id === turn.native_context.turn_id && turn.native_context.turn_id === turn.id),
    all_automatic_mcp_writes_have_verified_receipt: calls.length === 5 && calls.every(call => call.result.ok && call.result.source === 'intent_formation_mcp' && /^IF-[A-F0-9]{8}$/u.test(call.result.receipt_id) && call.status === 'completed' && call.error === null),
    all_write_sources_equal_actual_current_turn: calls.every(call => call.arguments.source_ref.ref === call.current_turn_id && call.result.record.source_ref.ref === call.current_turn_id && call.current_turn_id === call.turn_ref && call.result.record.source_ref.kind === 'user_turn'),
    execution_feedback_does_not_replace_goal: feedback.arguments.feedback_class === 'implementation_change' && feedback.result.record.feedback_class === 'implementation_change' && feedback.result.snapshot.active_record_ids.includes(oldRecord.record_id) && feedback.result.snapshot.records.some(record => record.record_id === oldRecord.record_id && record.role === 'desired_outcome' && record.statement === oldRecord.statement),
    changed_goal_supersedes_exact_old_goal: newRecord.supersedes.length === 1 && newRecord.supersedes[0] === oldRecord.record_id && ['role', 'scope', 'scope_ref'].every(key => newRecord[key] === oldRecord[key]) && unknown.result.snapshot.records.find(record => record.record_id === oldRecord.record_id)?.status === 'superseded',
    unresolved_icons_remain_unknown: unknownRecord.role === 'unknown' && unknownRecord.epistemic_status === 'unknown' && unknownRecord.user_confirmed === false,
    restored_goal_unknown_id_and_source: five.hook_contexts.length === 2 && five.hook_contexts.every(hook => hook.data.records.some(record => record.id === newRecord.record_id && record.source === newRecord.source_ref.ref) && hook.data.records.some(record => record.id === unknownRecord.record_id && record.status === 'unknown' && record.source === unknownRecord.source_ref.ref) && !hook.data.records.some(record => record.id === oldRecord.record_id)),
    restore_no_duplicate_state_write: five.private_ledger_sha256 === four.private_ledger_sha256 && !calls.some(call => call.turn_ref === five.turn_ref),
    control_no_state_context_or_write: control.hook_contexts.length === 0 && !calls.some(call => call.turn_ref === control.turn_ref) && control.private_ledger_sha256 === five.private_ledger_sha256 && !control.persisted_task_refs.includes('task-case08') && verification.checks.control_no_state_context_or_write,
    both_source_files_byte_unchanged: verification.artifacts.filter(row => row.source_unchanged !== null).every(row => row.source_unchanged && row.sha256 === row.original_fixture_sha256),
    correct_csv_row_order_and_values: csv === 'batch,status\nFox,ready\nMoth,not-ready\nReed,not-ready\nWren,ready\n'
  };
  assert.equal(Object.keys(checks).length, 15);
  assert.deepEqual(checks, verification.checks);
  assert(Object.values(checks).every(Boolean));
  assert.deepEqual(verification.failed_checks, []);
  assert.equal(evidence.captures.length, 6);
  assert.equal(evidence.captures.flatMap(row => row.hook_contexts).filter(row => row.kind === 'continuity_context').length, 8);
  const definitions = new Map(calls.map(call => [call.result.record.record_id, call.result.record]));
  assert.equal(definitions.size, 5);
  assert.equal(new Set([start.receipt_id, ...calls.map(call => call.result.receipt_id)]).size, 6);
  for (const row of evidence.captures) {
    assert(byId.has(row.turn_ref));
    assert.equal(row.task_ref, byId.get(row.turn_ref).task_ref);
    for (const hook of row.hook_contexts) {
      assert.equal(hook.parse_error, null);
      assert(hook.text.endsWith(JSON.stringify(hook.data)), 'Hook raw text and parsed JSON correspond');
      if (hook.kind !== 'continuity_context') continue;
      assert.equal(hook.data.task_id, row.task_ref);
      assert(hook.data.turn_id === null || hook.data.turn_id === row.turn_ref);
      for (const record of hook.data.records) {
        assert(definitions.has(record.id));
        assert.equal(record.source, definitions.get(record.id).source_ref.ref);
        assert.equal(record.text, definitions.get(record.id).statement);
        assert(byId.has(record.source));
      }
    }
  }
  for (const call of calls) {
    const record = call.result.record;
    assert(byId.get(call.turn_ref).prompt.includes(record.source_ref.excerpt));
    assert.equal(call.arguments.task_id, byId.get(call.turn_ref).task_ref);
    for (const id of record.supersedes) assert(definitions.has(id));
    const receipt = verification.exact_receipt_correspondence.find(row => row.receipt_id === call.result.receipt_id);
    assert(receipt);
    assert.equal(receipt.record_id, record.record_id);
    assert.deepEqual(receipt.source_ref, record.source_ref);
  }
  assert.equal(byId.get('turn-case07-05').native_mode, 'resume');
  assert(byId.get('turn-case07-05').new_cli_process);
  for (const turn of turns) assert.equal(turn.assistant_messages.at(-1).text.trimEnd(), turn.final_answer.trimEnd());
  for (const artifact of verification.artifacts) {
    const bytes = await readFile(path.join(here, artifact.path));
    assert.equal(bytes.length, artifact.bytes);
    assert.equal(sha(bytes), artifact.sha256);
  }
  const artifactPaths = new Set(verification.artifacts.map(row => row.path));
  for (const turn of turns) for (const item of turn.file_tool_items) {
    if (item.type === 'file_change') for (const change of item.changes) assert(artifactPaths.has(change.path), 'Published file-change reference');
  }
  for (const link of byId.get('turn-case08-01').final_answer.matchAll(/\]\(([^)]+)\)/gu)) assert(artifactPaths.has(link[1]), 'Published answer artifact link');
  assert.equal(install.installed_file_count, 27);
  assert.equal(install.fixed_source_file_count, 28);
  assert.equal(install.comparisons.length, 27);
  assert(install.comparisons.every(row => row.match && row.installed_sha256 === row.fixed_git_sha256 && row.installed_bytes === row.fixed_git_bytes));
  for (const tree of install.trees) {
    assert.equal(tree.files.length, tree.file_count);
    assert.equal(tree.files.reduce((sum, row) => sum + row.bytes, 0), tree.bytes);
    assert.equal(descriptorHash(tree.files), tree.installed_descriptor_sha256);
    assert.equal(tree.installed_descriptor_sha256, tree.fixed_git_descriptor_sha256);
  }
  assert.equal(cleanup.commands.filter(row => row.kind === 'model_task_delete' && row.exit_code === 0).length, 2);
  assert.equal(cleanup.commands.filter(row => row.kind === 'empty_onboarding_delete' && row.exit_code === 1).length, 1);
  assert.equal(cleanup.commands.filter(row => row.kind === 'plugin_remove' && row.exit_code === 0).length, 2);
  assert.equal(cleanup.commands.filter(row => row.kind === 'marketplace_remove' && row.exit_code === 0).length, 1);
  assert(cleanup.filesystem.targets.every(row => row.exists === false));
  assert.equal(cleanup.filesystem.session_files_after_native_delete, 0);
  assert.deepEqual(cleanup.session_files_remaining, []);
  assert.equal(verification.failed_model_tool_items.length, 1);
  assert.equal(verification.failed_model_tool_items[0].exit_code, 1);
  assert.equal(verification.baseline, false);
  assert.equal(verification.strict_no_history_causal_isolation, false);
  assert.equal(verification.historical_19_offline_checks_included, false);
  assert.equal(verification.later_policy_bytes_tested, false);
  console.log(JSON.stringify({ status: 'PASS', files: actual.length + 1, cases: 2, user_turns: 6, checks: 15, mcp_receipts: 5, manual_hook_receipts: 1, continuity_contexts: 8, fixed_git_installed_file_matches: 27, redaction_and_reference_checks: 'PASS', manifest_sha256: sha(await readFile(path.join(here, 'manifest.json'))), manifest_bytes: (await readFile(path.join(here, 'manifest.json'))).length }, null, 2));
}

if (process.argv[2] === '--build') await build(process.argv[3], process.argv[4]);
else assert.equal(process.argv[2], '--verify', 'Use --build or --verify');
await verify();
