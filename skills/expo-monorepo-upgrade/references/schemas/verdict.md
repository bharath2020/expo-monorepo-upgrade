# Schema: verdict

The fixed compact report every worker sends back to the orchestrator on completion. Full logs and
artifacts stay on disk under `reports/<run-id>/`; the verdict carries the summary plus paths.

## Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `status` | string | `green` (gate passed, clusters empty) \| `red` (failures need the fix loop) \| `blocked` (this worker goes no further: an exhausted attempt cap, a policy-forbidden fix as the only path, or a contract that cannot carry the run — the dispatching step decides what follows, escalation for a lane and a decline for the run) |
| `gate` | string \| null | The `gates[].id` this verdict reports on, from the contract check (`references/discovery.md`); `null` from a role that runs no gate |
| `app` | string \| null | The app coverage key this dispatch was scoped to: an app name, `"*"` when one run covers every app, `null` from a role that runs no gate |
| `platform` | string \| null | The platform coverage key: a platform name, `"*"` when one run covers every platform, `null` from a role that runs no gate |
| `duration_s` | number | Wall-clock seconds the run this verdict reports took, timed by the worker itself and reported as a whole second rounded up, minimum 1, so a budget derived from it is reproducible; `references/baseline.md` reads it into `budgets[gate_id].baseline_s` |
| `clusters` | object[] | Failures grouped by fingerprint; empty array when `status` is `green` |
| `commit_sha` | string \| null | Commit SHA if this worker committed (fix workers only; `null` otherwise) |
| `summary` | string | `blocked` only: what you tried, what stopped you, and the evidence behind it — the context a human needs to choose |
| `options` | string[] | `blocked` only: the concrete, mutually exclusive actions that would unblock this, each phrased as something a human can approve or refuse |
| `recommendation` | string | One-line next step for the orchestrator; on a `blocked` verdict, which of your `options` you would take and why |

`app` and `platform` repeat the dispatch's coverage keys verbatim, so the orchestrator
writes the matching `matrix`/`baseline` cell without translating.

## Verdicts from non-gate roles

`discovery`, `bump`, `reviewer`, `fix`, `operations`, and `report` report on a role's work
rather than one gate's cell: all six send `gate`, `app`, and `platform` as `null` and fill
`status`, `duration_s`, `clusters`, `commit_sha`, and `recommendation` as usual, so the ledger's
`verdict` event always has a `status` to copy and its `role` names who reported.
Two carry extra fields. `discovery` adds `target_sdk`, landing in the ledger's
`target`; `report` adds `artifact_paths`, the `report.json`, `summary.md`,
and learnings-doc paths it wrote (`references/agents/report.md`), its `commit_sha` being the docs
commit. A `fix` worker's `clusters` come back empty on a clean fix, and carry the fingerprints its
own re-validation surfaced on an attempt it rolled back (`references/agents/fix.md`).

`analyst` is the one role outside this shape: it sends `status` — `green` when it answered,
`blocked` when the cited evidence cannot settle it — and its paragraph in `recommendation`, alone.

## A blocked verdict is the escalation

Whatever the role, `blocked` means a human has to choose, so the verdict carries the whole
question: `summary` for context, `options` for the choices, `recommendation` for the default.
The orchestrator raises exactly those (`references/orchestration-model.md`) — it never
reconstructs them, because the worker that hit the wall is the one that knows what would lift it.
Two or three options, each an action rather than a direction: "approve X", not "consider X".

## clusters[]

| Field | Type | Meaning |
| --- | --- | --- |
| `fingerprint` | string | Stable dedup key, a filesystem-safe slug (lowercase alphanumeric + hyphens, e.g. `ios-build-missing-symbol-moduleregistry`) — same missing symbol, gradle task, or pod collapses to one slug; the human-readable detail belongs in `diagnosis`, never in the slug |
| `diagnosis` | string | One-line root-cause statement |
| `count` | number | Raw failure occurrences this cluster absorbed |
| `affected` | string[] | App×platform pairs this cluster touches, e.g. `"@acme/storefront×ios"` |
| `findings_path` | string | Full write-up at `reports/<run-id>/clusters/<fingerprint>/attempt-N/findings.md` |
| `evidence_paths` | string[] | Raw logs/artifacts on disk backing the diagnosis |

## Gate artifact paths

A gate-runner or monitor writes its combined stdout and stderr to `output.log` and its own
`verdict.json` beside it, in
`reports/<run-id>/gates-<phase>/<gate-slug>/<app-slug>/<platform-slug>/` — slugged per
`references/worker-briefs.md`'s path convention, where a `"*"` key becomes the segment `all`.
`<phase>` is the ledger phase this dispatch runs under (`references/schemas/ledger.md`), carried
uniformly: `gates-baseline`, `gates-loop1`, `gates-final`, and so on for every phase, so a later
phase re-running a gate leaves the earlier phase's evidence standing instead of overwriting the
record the report rests on. A run writing bare `gates/` for baseline predates this rule and is
superseded by it. `evidence_paths` cites `output.log` under that name.

## Fixtures

Illustrative only — a fictional repo. A `red` verdict from a `gate-runner` on the `build.ios` gate (T1), scoped to one app after a bump to SDK 55:

```json
{
  "status": "red",
  "gate": "build.ios",
  "app": "@acme/storefront",
  "platform": "ios",
  "duration_s": 214,
  "clusters": [
    { "fingerprint": "ios-build-missing-symbol-moduleregistry", "count": 1, "affected": ["@acme/storefront×ios"],
      "diagnosis": "expo-modules-core pod pinned below SDK 55's ABI; ModuleRegistry symbol not found at link time.",
      "findings_path": "reports/run-2026-08-14T19-05Z/clusters/ios-build-missing-symbol-moduleregistry/attempt-1/findings.md",
      "evidence_paths": ["reports/run-2026-08-14T19-05Z/gates-loop1/build-ios/acme-storefront/ios/output.log"] }
  ],
  "commit_sha": null,
  "recommendation": "Dispatch a fix worker to align expo-modules-core to the SDK 55 pod version, then re-run build.ios for the storefront app."
}
```

A `green` verdict from a platform-less gate — `typecheck` has no platform axis, so `platform` is `"*"` and one cell per app is written:

```json
{
  "status": "green",
  "gate": "typecheck",
  "app": "@acme/storefront",
  "platform": "*",
  "duration_s": 41,
  "clusters": [],
  "commit_sha": null,
  "recommendation": "T0 is green; clear to dispatch the T1 gates."
}
```

A `blocked` verdict from a `fix` worker whose only remaining fix is escalation-listed (B12),
carrying the question a human has to answer:

```json
{
  "status": "blocked", "gate": null, "app": null, "platform": null,
  "duration_s": 640, "commit_sha": null,
  "clusters": [{ "fingerprint": "ios-svg-abi-mismatch", "count": 1, "affected": ["@acme/storefront×ios"],
    "diagnosis": "react-native-svg 15.8.0 links against the pre-SDK-55 ExpoModulesCore ABI; no released version targets 55.",
    "findings_path": "reports/run-2026-08-14T19-05Z/clusters/ios-svg-abi-mismatch/attempt-3/findings.md",
    "evidence_paths": ["reports/run-2026-08-14T19-05Z/gates-loop1/build-ios/acme-storefront/ios/output.log"] }],
  "summary": "Three attempts spent. Upstream 15.9.0 carries the fix but is unreleased; every path that builds today needs a forked pin, which B7 and the escalation list forbid without a decision.",
  "options": [
    "Pin react-native-svg to the maintainer's sdk-55 branch for this run",
    "Drop ios from the storefront app's platforms and finish the upgrade on android",
    "Stop here and resume when 15.9.0 ships"
  ],
  "recommendation": "Pin the branch: it is one resolutions entry, the diff is upstream's own, and the pin comes out when 15.9.0 lands."
}
```

A `green` verdict from `discovery`, the non-gate shape — the three coverage fields
are `null`, and `target_sdk` sits alongside them:

```json
{
  "status": "green", "gate": null, "app": null, "platform": null,
  "duration_s": 92, "clusters": [], "commit_sha": null,
  "target_sdk": "55",
  "recommendation": "Resolved next to SDK 55; contract complete — 1 app, 2 platforms, 6 gates (2 T0, 2 T1, 1 T2, 1 T3); no warnings, no drift. Clear to baseline."
}
```
