# Step: Discovery

Dispatch one `discovery` worker (capable tier) per `references/agents/discovery.md`:
it validates the contract and resolves the target SDK. Setup already proved the
repo is in scope — the contract exists and an app depends on `expo` — so
discovery declines nothing. There is no separate plan file: the contract is
what the run executes.

Record `target` from its verdict, write the `verdict` event and its journal
line, and carry its warnings into the final report. A `blocked` verdict holds
the run here: raise its `summary` and `options` as the open question
(`references/schemas/verdict.md`). Every contract fix belongs to the
`expo-monorepo-upgrade-setup` skill, so no worker patches one mid-run.

## What the contract check returns

The worker runs `scripts/check-contract.mjs`, which parses the root
`expo-upgrade.yaml` and every per-app file the `apps:` index names, and prints
one JSON object. Every later step dispatches from it:

| Field | What it holds |
| --- | --- |
| `ok`, `summary` | whether the contract is usable, and its one-line count |
| `errors[]` | a missing mandatory key, an unusable entry, a declared path that does not exist |
| `warnings[]` | an unknown key, a kind its section does not take, an Expo app missing from the index — each ignored, the run continues |
| `apps[]` | every app the `apps:` index names: `name`, `path`, `platforms`, and the file it came from |
| `gates[]` | every gate the run dispatches: `id`, `app`, `tier`, `platforms` (the cells it covers), `path`, its command or pipeline fields, and any `expect`, `flow_selector`, `timeout_s`, `concurrency_groups` |
| `prep[]` | the preparation entries `operations` workers run, each by `name` |
| `bump` | this repo's whole bump procedure — a mandatory key, so `ok` never comes back true without it |
