# Moving from Intent Loop v0.2

Intent Formation v0.3 is a product reorientation in the existing repository. Intent Loop v0.2 emphasized a structured requirement ledger. Intent Formation emphasizes the user-visible moment before costly work: continue when clear, ask one useful question when a choice changes the next action, compare concrete directions when vocabulary is missing, and use a small sample when preference needs a result.

The old and new plugins use different names and data roots. v0.3 does not silently import v0.2 state because doing so could turn old inferred or structured records into authority for a different product.

## Replace the old Codex plugin

~~~shell
codex plugin remove intent-loop@intent-loop
codex plugin marketplace remove intent-loop
codex plugin marketplace add rrrrrredy/intent-loop --ref v0.3.0-beta.1
codex plugin add intent-formation@intent-loop
~~~

Install `intent-formation-state@intent-loop` only if you want the new sparse state controls.

Package removal does not delete old v0.2 data. Inspect and remove the old `plugin-data/intent-loop` directory yourself only after confirming that no export or audit record is still needed. v0.3 writes under `plugin-data/intent-formation`.

## Replace the DeepSeek bundle

~~~shell
dsh plugin --profile headless remove dsh-intent-loop
dsh plugin --profile headless add github:rrrrrredy/intent-loop#v0.3.0-beta.1
~~~

The new package identity is `dsh-intent-formation`. No v0.2 efficacy claim carries forward; v0.3 publishes a new frozen study and a separate compatibility boundary for DeepSeek.
