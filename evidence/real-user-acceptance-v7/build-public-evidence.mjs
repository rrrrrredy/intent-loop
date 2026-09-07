import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const commit = '16c4b199cda677b9cb19898096d1bcc161b7215c';
const earlierCommit = '2b9101f9fc99ab0874f05a5d1e80b03b070de6a0';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async file => JSON.parse(await readFile(file,'utf8'));
const put = async (name,data) => writeFile(path.join(here,name),JSON.stringify(data,null,2)+'\n');
const sorted = rows => rows.sort((a,b)=>a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
const descriptorHash = rows => sha(JSON.stringify(sorted(rows.map(x=>({path:x.path,bytes:x.bytes,sha256:x.sha256}))))+'\n');
const expectedFiles = ['README.md','build-public-evidence.mjs','cases.json','hook-evidence.json','verification.json','installation-verification.json','cleanup.json','artifacts/inventory.csv','artifacts/totals.csv','manifest.json'].sort();
const uuid = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/giu;
const recordId = /\brec_[0-9a-f]{32}\b/gu;
const exportId = /\bintent-[0-9a-f]{24}-[0-9a-f]{16}-[0-9a-f]{8}\.json\b/gu;

function assertPublicText(text,name) {
  assert(!/\b[A-Za-z]:[\\/]/u.test(text),'Windows absolute path: '+name);
  assert(!/(?:^|[\s"'(])\/+(?:Users|home|tmp|mnt|var|etc|opt|usr|private|Volumes)\//mu.test(text),'Machine POSIX absolute path: '+name);
  assert(!/\\\\[A-Za-z0-9_.-]+\\[A-Za-z0-9_$.-]+/u.test(text),'UNC path: '+name);
  assert(!new RegExp(uuid.source,'iu').test(text),'Runtime UUID: '+name);
  assert(!new RegExp(recordId.source,'u').test(text),'Original State record ID: '+name);
  assert(!new RegExp(exportId.source,'u').test(text),'Original State export ID: '+name);
  assert(!/sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u.test(text),'Potential secret: '+name);
}
async function publishedFiles(directory=here) {
  const files=[];
  for (const entry of await readdir(directory,{withFileTypes:true})) {
    const file=path.join(directory,entry.name);
    if (entry.isDirectory()) files.push(...await publishedFiles(file));
    else { assert(entry.isFile(),'Non-regular entry'); files.push(path.relative(here,file).replaceAll('\\','/')); }
  }
  return files.sort();
}
async function scanFiles() {
  const rows=[];
  for (const name of await publishedFiles()) {
    const bytes=await readFile(path.join(here,name));
    assert(!(bytes[0]===0xef && bytes[1]===0xbb && bytes[2]===0xbf),'BOM: '+name);
    const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    assert(!text.includes('\r') && text.endsWith('\n'),'LF encoding: '+name);
    assertPublicText(text,name);
    if (name!=='manifest.json') rows.push({path:name,bytes:bytes.length,sha256:sha(bytes)});
  }
  return rows;
}
function git(repo,args) {
  const result=spawnSync('git',['-C',repo,...args],{encoding:null,windowsHide:true,maxBuffer:8*1024*1024});
  assert.equal(result.status,0,'Fixed Git object read failed');
  return result.stdout;
}

async function verify() {
  assert.deepEqual(await publishedFiles(),expectedFiles,'Unexpected public files');
  const manifest=await json(path.join(here,'manifest.json'));
  assert.deepEqual(await scanFiles(),manifest.artifacts,'Published hash/bytes mismatch');
  const cases=(await json(path.join(here,'cases.json'))).cases;
  const turns=cases.flatMap(x=>x.turns);
  assert.equal(cases.length,6); assert.equal(turns.length,22);
  assert.equal(new Set(turns.map(x=>x.id)).size,22);
  assert(turns.every(x=>x.model==='gpt-5.6-sol' && x.reasoning_effort==='low' && x.completed && x.exit_code===0 && x.prompt && x.answer));
  const hooks=(await json(path.join(here,'hook-evidence.json'))).results;
  assert.equal(hooks.length,12); assert.equal(hooks.filter(x=>x.result.ok).length,10);
  const receipts=new Set();
  for (const hook of hooks) {
    const answer=turns.find(x=>x.id===hook.turn_id)?.answer;
    assert(answer); assert.equal(hook.result.source,'intent_formation_hook');
    if (hook.result.ok) { assert(/^IF-[A-F0-9]{8}$/u.test(hook.result.receipt_id)); assert(answer.includes(hook.result.receipt_id)); receipts.add(hook.result.receipt_id); }
    else { assert(!hook.result.receipt_id); assert(!/\bIF-[A-F0-9]{8}\b/u.test(answer)); }
  }
  assert.equal(receipts.size,10);
  const installation=await json(path.join(here,'installation-verification.json'));
  assert.equal(installation.candidate,commit);
  assert.equal(installation.trees.reduce((n,x)=>n+x.files.length,0),27);
  for (const tree of installation.trees) {
    assert(tree.files.every(x=>x.match && x.installed_bytes===x.fixed_git_bytes && x.installed_sha256===x.fixed_git_sha256));
    assert.equal(descriptorHash(tree.files.map(x=>({path:x.path,bytes:x.installed_bytes,sha256:x.installed_sha256}))),tree.installed_descriptor_tree_sha256);
    assert.equal(tree.installed_descriptor_tree_sha256,tree.fixed_commit_descriptor_tree_sha256);
  }
  const cleanup=await json(path.join(here,'cleanup.json'));
  const deletions=cleanup.native_commands.filter(x=>x.argv[0]==='delete');
  assert.equal(deletions.filter(x=>x.exit_code===0).length,6);
  assert.equal(deletions.filter(x=>x.exit_code!==0).length,2);
  assert(cleanup.native_commands.filter(x=>x.argv[0]==='plugin').every(x=>x.exit_code===0));
  assert(cleanup.final_cleanup.temporary_home_absent && cleanup.final_cleanup.synthetic_workspace_absent);
  const verification=await json(path.join(here,'verification.json'));
  assert.equal(verification.normal_trust.hook_trust_bypass_invocations,0);
  assert.equal(verification.historical_offline_components.checks.length,19);
  assert.equal(verification.historical_offline_components.model_interactions,0);
  for (const value of Object.values(verification.checks.after_forget)) assert.equal(value,0);
  for (const file of verification.file_artifacts) { const bytes=await readFile(path.join(here,file.path)); assert.equal(bytes.length,file.bytes); assert.equal(sha(bytes),file.sha256); }
  console.log(JSON.stringify({result:'PASS',public_files:10,cases:6,user_turns:22,hook_successes:10,hook_unsuccessful:2,exact_unique_receipts:10,fixed_commit_file_matches:27,native_model_session_deletions:6,native_empty_onboarding_deletion_failures:2,encoding_scan:'PASS',absolute_paths_uuid_common_secrets_scan:'PASS'}));
}

async function build(source,repo) {
  assert(source && repo,'Supply private-source-directory and repository-directory');
  const raw=await json(path.join(source,'verified-live-results.json'));
  const installation=await json(path.join(source,'installed-fingerprints.json'));
  const native=await json(path.join(source,'native-cleanup-results.json'));
  const cleanup=await json(path.join(source,'cleanup-filesystem.json'));
  const trust=await json(path.join(source,'normal-trust-ui.json'));
  const sourceManifest=await json(path.join(source,'evidence-manifest.json'));
  const earlierSource=path.resolve(source,'..','usage-evidence','local-acceptance-results-v7.json');
  const earlier=await json(earlierSource);
  assert.equal(installation.candidate,commit); assert.equal(trust.candidate,commit);
  assert.equal(raw.turns.length,22); assert.equal(earlier.candidate,earlierCommit);
  assert.equal(earlier.checks.length,19);
  const caseIds=[...new Set(raw.turns.map(x=>x.case_id))].sort();
  assert.equal(caseIds.length,6);

  const substitutions=new Map();
  for (const turn of raw.turns) substitutions.set(turn.session_id,'session-'+turn.case_id);
  let onboarding=0;
  for (const call of native.commands.filter(x=>x.argv[0]==='delete')) {
    if (!substitutions.has(call.argv[2])) substitutions.set(call.argv[2],'onboarding-'+String(++onboarding).padStart(2,'0'));
  }
  const userContent=raw.turns.flatMap(x=>[x.prompt,x.answer]).join('\n');
  let recordNumber=0,exportNumber=0,runtimeNumber=0;
  for (const id of userContent.match(recordId)??[]) if (!substitutions.has(id)) substitutions.set(id,'record-'+String(++recordNumber).padStart(2,'0'));
  for (const id of userContent.match(exportId)??[]) if (!substitutions.has(id)) substitutions.set(id,'export-'+String(++exportNumber).padStart(2,'0')+'.json');
  for (const id of JSON.stringify(raw.hookResults).match(uuid)??[]) if (!substitutions.has(id)) substitutions.set(id,'runtime-'+String(++runtimeNumber).padStart(2,'0'));
  const sourcePaths=new Set(raw.turns.map(x=>x.cwd));
  function sanitizeString(value) {
    let text=value;
    for (const sourcePath of sourcePaths) {
      for (const variant of new Set([sourcePath,sourcePath.replaceAll('\\','/'),sourcePath.replaceAll('/','\\')])) text=text.split(variant).join('artifacts');
    }
    for (const [original,replacement] of substitutions) text=text.split(original).join(replacement);
    assertPublicText(text,'transformed string');
    return text;
  }
  function sanitize(value) {
    if (typeof value==='string') return sanitizeString(value);
    if (Array.isArray(value)) return value.map(sanitize);
    if (value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([key,child])=>[key,sanitize(child)]));
    return value;
  }
  const titles=['Real CSV aggregation','Reusable order/payment rule','Unformed paper-model tool direction','Incompatible deletion requirements','Goal change after a small sample','Receipt-backed State lifecycle'];
  const cases=caseIds.map((id,index)=>({id,title:titles[index],turns:raw.turns.filter(x=>x.case_id===id).map(x=>({id:id+'-turn'+String(x.turn).padStart(2,'0'),turn:x.turn,prompt:sanitizeString(x.prompt),answer:sanitizeString(x.answer),model:x.model,reasoning_effort:x.effort,completed:x.completed,exit_code:x.exit_code}))}));
  const allTurns=cases.flatMap(x=>x.turns);
  const hookResults=raw.hookResults.map(hook=>{
    const candidates=raw.turns.filter(x=>x.session_id===hook.session_id && Date.parse(hook.timestamp)>=Date.parse(x.started_at) && Date.parse(hook.timestamp)<=Date.parse(x.completed_at));
    assert.equal(candidates.length,1,'Hook must match exactly one invocation interval');
    const turn=candidates[0];
    if (hook.answer_turn!==null) assert.equal(turn.turn,hook.answer_turn);
    const id=turn.case_id+'-turn'+String(turn.turn).padStart(2,'0');
    const result=sanitize(hook.result),answer=allTurns.find(x=>x.id===id).answer;
    if (result.ok) assert(answer.includes(result.receipt_id));
    else assert(!result.receipt_id && !/\bIF-[A-F0-9]{8}\b/u.test(answer));
    return {turn_id:id,result,exact_success_receipt_matches_answer:result.ok ? answer.includes(result.receipt_id) : null,success_receipt_absent:!result.ok ? !result.receipt_id : null};
  });

  assert.equal(git(repo,['cat-file','-t',commit]).toString('utf8').trim(),'commit');
  const gitObjectFormat=git(repo,['rev-parse','--show-object-format']).toString('utf8').trim();
  const trees=[];
  for (const tree of installation.trees) {
    const prefix='plugins/'+tree.name+'/';
    const fixedNames=git(repo,['ls-tree','-r','--name-only',commit,'--','plugins/'+tree.name]).toString('utf8').trim().split('\n').map(x=>x.slice(prefix.length)).sort();
    assert.deepEqual(fixedNames,tree.files.map(x=>x.path).sort());
    const fixedDescriptors=[],files=[];
    for (const installed of tree.files) {
      const blob=git(repo,['show',commit+':'+prefix+installed.path]);
      const fixed={path:installed.path,bytes:blob.length,sha256:sha(blob)};
      assert.equal(installed.bytes,fixed.bytes,'Installed/fixed length mismatch');
      assert.equal(installed.sha256,fixed.sha256,'Installed/fixed digest mismatch');
      fixedDescriptors.push(fixed);
      files.push({path:installed.path,installed_bytes:installed.bytes,fixed_git_bytes:fixed.bytes,installed_sha256:installed.sha256,fixed_git_sha256:fixed.sha256,match:true});
    }
    assert.equal(descriptorHash(tree.files),tree.tree_sha256);
    assert.equal(descriptorHash(fixedDescriptors),tree.tree_sha256);
    trees.push({plugin:tree.name,version:tree.version,file_count:files.length,installed_descriptor_tree_sha256:tree.tree_sha256,fixed_commit_descriptor_tree_sha256:descriptorHash(fixedDescriptors),git_tree_object_id:git(repo,['rev-parse',commit+':plugins/'+tree.name]).toString('utf8').trim(),files});
  }
  assert.equal(trees.reduce((n,x)=>n+x.file_count,0),27);
  const sourceNames=['verified-live-results.json','installed-fingerprints.json','native-cleanup-results.json','cleanup-filesystem.json','normal-trust-ui.json','sandbox-onboarding.json','user-feedback-live-v7.md','inventory.before.csv','totals.actual.csv','evidence-manifest.json'];
  const sourceHashes=[];
  for (const name of sourceNames) {
    const bytes=await readFile(path.join(source,name));
    if (name!=='evidence-manifest.json') {
      const original=sourceManifest.files.find(x=>x.path===name);
      assert(original,'Source not in private manifest');
      assert.equal(bytes.length,original.bytes); assert.equal(sha(bytes),original.sha256,'Private source changed');
    }
    sourceHashes.push({source_id:'live-'+name,file_name:name,bytes:bytes.length,sha256:sha(bytes),private_manifest_match:name!=='evidence-manifest.json'});
  }
  const earlierBytes=await readFile(earlierSource);
  assert.equal(sha(earlierBytes),'851987392a1ff54f9b255f7f7aae71e1b8fd7f2751e45d19fe301e62381d984e');
  sourceHashes.push({source_id:'earlier-offline-components',file_name:'local-acceptance-results-v7.json',bytes:earlierBytes.length,sha256:sha(earlierBytes),original_recorded_hash_match:true});
  const nativeCommands=native.commands.map(call=>({argv:sanitize(call.argv),exit_code:call.exit_code,stdout:sanitizeString(call.stdout),stderr:sanitizeString(call.stderr),error:call.error}));
  const cleanupPublic={
    all_model_invocations_already_exited:native.all_model_invocations_already_exited,
    native_commands:nativeCommands,
    model_session_deletions:{succeeded:6,failed:0},
    no_prompt_onboarding_deletions:{succeeded:0,failed:2,session_files_observed:0,failure_reason:'Native command returned only a generic failure; no more specific cause is inferred.'},
    session_files_remaining_after_native_cleanup:native.session_files_remaining.length,
    official_uninstalls:cleanup.native_plugin_uninstall,
    local_windows_file_in_use_error:cleanup.windows_file_in_use_error_observed_in_this_isolation,
    final_cleanup:{
      temporary_home_absent:cleanup.verification.home_absent,
      synthetic_workspace_absent:cleanup.verification.workspace_absent,
      original_authorized_authentication_source_preserved:cleanup.verification.source_auth_exists,
      temporary_authentication_copy_removed_with_home:true,
      evidence_preserved:cleanup.verification.feedback_evidence_exists,
      method:'Exact resolved child targets checked for containment before native PowerShell literal-path removal.'
    },
    sealed_holdout_files_unchanged:sourceManifest.all_four_sealed_hashes_unchanged
  };
  const input=await readFile(path.join(source,'inventory.before.csv'));
  const output=await readFile(path.join(source,'totals.actual.csv'));
  const verification={
    candidate:commit,run_date:'2026-09-07',
    evidence_type:'Small uncontrolled real-host synthetic user exercise; not comparative efficacy evidence',
    baseline:false,model:'gpt-5.6-sol',reasoning_effort:'low',
    checks:raw.verification,
    actual_turn_contexts:raw.sessions.map(session=>({
      case_id:raw.turns.find(x=>x.session_id===session.session_id).case_id,
      turn_count:session.turn_count,models:session.models,reasoning_efforts:session.efforts,
      exact_core_policy_context_present:session.exact_core_policy_contexts>0
    })),
    file_artifacts:[
      {path:'artifacts/inventory.csv',bytes:input.length,sha256:sha(input),role:'Synthetic input; before/after source hash matched'},
      {path:'artifacts/totals.csv',bytes:output.length,sha256:sha(output),role:'Actual model-created output'}
    ],
    normal_trust:{
      method:trust.method,hook_trust_bypass_invocations:0,manual_private_trust_config_edits:0,
      final_ui:{SessionStart:{installed:1,active:1},UserPromptSubmit:{installed:2,active:2}},
      terminal_caveat:trust.terminalCaveat,
      sandbox:'Normal UI non-administrator setup; unelevated; no administrator installation',
      automatic_command_approval:'approve-for-me; distinct from normal Hook trust',
      host_versions:{codex_cli:'0.153.4',node:'22.19.0'}
    },
    off_control_contexts:raw.offContexts.map(x=>({case_id:'case06',text:x.text})),
    host_warnings:{
      powershell_shell_snapshot_unsupported:sourceManifest.shell_snapshot_warnings,
      rollout_flush_thread_not_found:sourceManifest.rollout_flush_warnings
    },
    historical_offline_components:{
      candidate:earlierCommit,model_interactions:0,separate_from_live_chat:true,
      checks:earlier.checks.map((x,index)=>({
        index:index+1,name:x.name,passed:x.passed,
        ...(index===18?{scope_caveat:'The task had already returned to standard before forget. This old assertion alone does not prove removal of an active off marker.'}:{})
      }))
    },
    limitations:[
      'No baseline, causal efficacy attribution or grading API; no transfer to later policy.',
      'The live reviewer read implementation for safety; this phase was not implementation-blind.',
      'Frozen 80-case contents/results were not read or run in these cases.',
      'Public tag installation was not tested; only pre-release local source installation was used.',
      'Private slash show remains unsupported; earlier process-local MCP tests are not new live chat evidence.',
      'Native empty-onboarding deletion errors remain failures despite whole-home cleanup.'
    ]
  };
  await mkdir(path.join(here,'artifacts'),{recursive:true});
  await put('cases.json',{candidate:commit,redaction:'Only disclosed consistent machine-path and opaque-ID substitutions; no user or final-answer prose omitted.',cases});
  await put('hook-evidence.json',{
    candidate:commit,source:'Actual trusted developer-role Hook result messages extracted before private session deletion',
    success_count:10,unsuccessful_count:2,results:hookResults
  });
  await put('installation-verification.json',{
    candidate:commit,comparison_source:'Immutable Git objects at this exact commit, not the worktree',
    descriptor_tree_algorithm:'SHA256(UTF8(compact JSON of path-sorted objects with keys path, bytes, sha256 in that order) + LF)',
    git_object_format:gitObjectFormat,tree_ids_are_not_descriptor_sha256:true,matched_file_count:27,trees
  });
  await put('verification.json',verification);
  await put('cleanup.json',cleanupPublic);
  await writeFile(path.join(here,'artifacts/inventory.csv'),input);
  await writeFile(path.join(here,'artifacts/totals.csv'),output);
  const artifacts=await scanFiles();
  await put('manifest.json',{
    schema_version:1,candidate:commit,
    source_preservation:'Private sources were read-only and matched original recorded hashes; original paths and reversible identifier mappings are not published.',
    source_hashes:sourceHashes,
    redactions:{
      machine_output_link:'Replaced with relative artifacts/totals.csv',
      runtime_ids:'Omitted or consistently labeled; no reversible mapping published',
      state_record_ids:'Stable record-NN labels',opaque_export_id:'Stable export-NN.json label',
      receipt_ids:'All ten success receipt IDs retained exactly',unrelated_context:'Not published'
    },
    validation:{
      fixed_commit_file_matches:27,synthetic_cases:6,user_turns:22,success_hook_results:10,unsuccessful_hook_results:2,
      hook_trust_bypass:0,baseline:false,grading_api_runs:0,source_hashes_verified:true,
      public_text_scan:'No absolute machine paths, runtime UUIDs, original opaque State IDs or listed common secret patterns; limited pattern scan is not a universal secrecy proof.'
    },
    artifact_hash_algorithm:'SHA256 of actual bytes; manifest excludes itself to avoid a self-hash cycle',
    artifacts
  });
  await verify();
}

if (process.argv[2]==='--build') await build(process.argv[3],process.argv[4]);
else if (process.argv[2]==='--verify') await verify();
else throw new Error('Use --verify or --build <private-source-directory> <repository-directory>');
