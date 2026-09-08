# Moving from Intent Loop v0.2

Intent Formation v0.3 is a product reorientation in the existing repository. Intent Loop v0.2 emphasized a structured requirement ledger. Intent Formation emphasizes the user-visible moment before costly work: continue when clear, ask one useful question when a choice changes the next action, compare concrete directions when vocabulary is missing, and use a small sample when preference needs a result.

The old and new plugins use different names and data roots. v0.3 does not silently import v0.2 state because doing so could turn old inferred or structured records into authority for a different product.

## No released migration target yet

There is no v0.3 tag or installer. Keep a working v0.2 installation and its data in place. Do not remove it in anticipation of a new release.

Developers can use the [fixed-commit source trial](source-trial.md) in a separate disposable Codex environment without changing their v0.2 installation. This is source testing, not a supported migration. Only plan replacement after a released target exists and you have verified its installation and behavior separately.

Source testing does not require deleting any v0.2 data. Keep its `plugin-data/intent-loop` directory and exports intact. Any future intentional retirement needs a separate backup and cleanup decision. v0.3 source writes under `plugin-data/intent-formation`.

## DeepSeek source checks

Keep the old bundle in place until there is a released replacement. The new source package identity is `dsh-intent-formation`; its [temporary lifecycle check](../dsh/README.md#source-verification) does not require removing the old bundle or supplying a model API key. No v0.2 efficacy claim carries forward, and the failed Codex confirmation does not establish DeepSeek benefit.
