# Schema: ledger — state.json + events.jsonl + journal.md

The orchestrator-owned control plane. `state.json` is current truth, one writer,
rewritten after every verdict; `events.jsonl` is an append-only typed log, never
rewritten; `journal.md` is their human-readable narrative. Workers write facts
(findings); only the orchestrator writes here.

## state.json fields

| Field | Type | Meaning |
| --- | --- | --- |
| `run_id` | string | Unique run identifier, e.g. `run-2026-08-14T19-05Z` |
| `target_requested` | string | The target exactly as asked for: `next`, `55`, `latest`, or `canary` — written by setup, matched by resume detection |
| `target` | string \| null | Concrete target SDK discovery resolved; `null` until discovery's verdict lands |
| `backend` | string | The dispatch backend this run selected — `herdr` or `harness` (`references/dispatch-backends.md`) — written at the first dispatch; a resume reconciles against this same backend before re-dispatching anything |
| `phase` | string | Current phase: `discovery`\|`baseline`\|`bump`\|`loop1`\|`loop2`\|`loop3`\|`final-verify`\|`report`\|`complete`\|`declined`; `references/orchestration-model.md` maps each to its SKILL.md step. Two are terminal: `complete` marks a run that will run nothing further, `declined` one setup's scope check found out of scope (`references/setup.md`) |
| `decline_reason` | string \| null | Setup's decline text, written with the terminal `declined` phase, so a declined run leaves a structured record; `null` in every other phase |
| `matrix` | object | `app → platform → gate_id → status` (`pending`\|`green`\|`red`\|`blocked`) — the whole-matrix view only the orchestrator holds |
| `baseline` | object | Same shape, statuses `green`\|`red`\|`skipped` — gate results on the pre-upgrade SDK; a `skipped` cell holds `{status: "skipped", cause}` rather than a bare status, `cause` naming in one phrase why the gate measured nothing — a test task the runner proved ran nothing, say (`references/gates.md`) — so the record can be read straight off the ledger. A T3 gate carries no cell at all — baseline skips the full suite (`references/baseline.md`). The reference for never blaming the upgrade for pre-existing failures |
| `clusters` | object | `fingerprint → {status, diagnosis, affected[], findings_path}` — the live cluster registry |
| `attempts` | object | `fingerprint → count` of fix attempts spent so far (cap 3, then `blocked`) |
| `builds` | object | `"<app-slug>_<platform>" → commit_sha`, both segments slugged per `references/worker-briefs.md`'s path convention — the commit each app's last build was produced from; a suite validates only against a build containing every commit it covers |
| `budgets` | object | `gate_id → {baseline_s, timeout_s}`, both computed by baseline from the gate's measured run (`references/baseline.md`). A gate earns an entry from its first measured run, so a skipped gate holds none until one lands |
| `flakes` | object[] | One per e2e pass-on-retry: `{flow, app, platform, attempt, at}` — `flow` the flow file's slug (`references/worker-briefs.md`'s path convention), recorded as this run observed it (`references/e2e.md`) |
| `open_questions` | object[] | Unanswered escalations: `{id, question, options[], recommendation, raised_at}` — on a worker-raised block, `question` is the verdict's `summary` and `options`/`recommendation` come across verbatim (`references/schemas/verdict.md`) |
| `decisions` | object[] | Answered escalations: `{id, question, answer, decided_at}`. `id` is the `question_id` of the escalation it answers, or `auto-<n>` numbered from 1 for a decision the run recorded without asking — the form keeps it from inventing an id that names no question |
| `checkpoints` | object[] | One per commit landed on the upgrade branch — the bump, every validated fix, the docs commit: `{commit_sha, phase, at, description}`, appended in lockstep with the `committed` event. The newest entry is every fix worker's rollback target (`references/fix-loop.md`), so a missing fix entry here would make a later rollback silently discard landed fixes |
| `last_heartbeat` | string \| null | Timestamp the orchestrator stamped at its most recent wait stretch while a worker was in flight (`references/dispatch-backends.md`), beside the journal's heartbeat line; it dates the run's last sign of life, so a stalled run is visible without reading a pane. `null` until the first wait |

## Matrix and baseline keys

Both maps are keyed by the coverage the contract check gives each gate —
its `app` and `platforms` (`references/discovery.md`): app name, then a platform name or
`"*"` (a check with no platform axis), then the gate id. A gate writes only the cells it covers — an app×platform pair
it does not cover has no cell at all, and that absence is how "not applicable here" is recorded.
`builds` and `flakes` stay keyed by concrete app and platform: they describe artifacts and
flows, not gate coverage.

## events.jsonl

One JSON object per line, timestamped, append-only; every line carries `type` and `at`, plus:

| Event | Extra fields | Meaning |
| --- | --- | --- |
| `dispatched` | `worker, role, task` | Orchestrator spawned a worker |
| `verdict` | `worker, role, gate, app, platform, status` | A verdict landed; `role` names the role that sent it, and `gate`/`app`/`platform` carry the coverage keys (`"*"` included) or `null` from a role that runs no gate — `discovery`, `bump`, `reviewer`, `fix`, `operations` (`references/schemas/verdict.md`) |
| `committed` | `commit_sha, cluster \| phase` | A checkpoint or fix landed on the branch |
| `escalated` | `question_id, question` | A question was raised; that lane pauses |
| `answered` | `question_id, answer` | A question was answered; decision recorded |
| `flake` | `flow, app, platform, attempt` | An e2e flow passed on clean retry |
| `blocked` | `fingerprint, reason` | A cluster exhausted its attempt cap |
| `worker_lost` | `worker, role, evidence` | A dispatched worker was ruled died-rather-than-still-running; `evidence` is the one-line basis for that ruling (`references/orchestration-model.md`), and the re-dispatch follows this event |
| `phase_started` / `phase_closed` | `phase` | Phase boundary |
| `backend_selected` | `backend` | The dispatch backend this run chose (`references/orchestration-model.md`), written at the first dispatch beside `state.json.backend` — it is the event that backend's journal line writes in lockstep with |

`role` names a worker role from `references/orchestration-model.md`'s index.

## Resume procedure

1. Read `state.json` for the matching `target_requested`, and the contract files at the
   repo root (`references/discovery.md`).
2. Rebuild the picture from that pair alone, with no conversation context:
   phase, matrix, open clusters, attempts, budgets, questions, and decisions
   from the ledger; tiers, commands, and coverage from the contract.
3. Continue at the first non-green cell in matrix order (`T0` before `T1` before
   `T2` before `T3`, app by app), replaying no green gate and no closed cluster.

## journal.md style

Written in lockstep with `events.jsonl`: one short, timestamped, plain-English
sentence per event, every identifier explained:

```
19:42 — iOS build for the storefront app failed with 1 error cluster (expo-modules-core pod mismatch); dispatching a fix worker (attempt 1/3).
```

## Fixture (state.json)

Illustrative only — a fictional repo, never a starting point for a real ledger.

```json
{
  "run_id": "run-2026-08-14T19-05Z",
  "target_requested": "next",
  "target": "55",
  "decline_reason": null, "backend": "herdr", "last_heartbeat": "2026-08-14T19:38:44Z",
  "phase": "loop1",
  "matrix": { "@acme/storefront": { "*": { "typecheck": "green" }, "ios": { "build.ios": "red", "e2e": "pending" }, "android": { "build.android": "green", "e2e": "green" } } },
  "baseline": { "@acme/storefront": { "*": { "typecheck": "green" }, "ios": { "build.ios": "green", "e2e": "green" }, "android": { "build.android": "green", "e2e": "green" } } },
  "clusters": { "ios-build-missing-symbol-moduleregistry": { "status": "in-progress", "diagnosis": "expo-modules-core pod pinned below SDK 55's ABI.", "affected": ["@acme/storefront×ios"], "findings_path": "reports/run-2026-08-14T19-05Z/clusters/ios-build-missing-symbol-moduleregistry/attempt-1/findings.md" } },
  "attempts": { "ios-build-missing-symbol-moduleregistry": 1 },
  "builds": { "acme-storefront_android": "d4b8a71" },
  "budgets": { "build.ios": { "baseline_s": 210, "timeout_s": 900 }, "e2e": { "baseline_s": 95, "timeout_s": 900 } },
  "flakes": [{ "flow": "checkout", "app": "@acme/storefront", "platform": "ios", "attempt": 1, "at": "2026-08-14T18:40:12Z" }],
  "open_questions": [],
  "decisions": [],
  "checkpoints": [{ "commit_sha": "1c9a44d", "phase": "bump", "at": "2026-08-14T18:12:03Z", "description": "Bump expo to ~55.0.0 at root and in the storefront app." }]
}
```
