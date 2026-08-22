# Schema: report.json

Written once by the `report` worker at SKILL.md step 8, assembled purely from the whole
ledger — `state.json`, `events.jsonl`, and `journal.md` — plus the worker-written cluster
findings, never from orchestrator memory. `summary.md` is free prose derived from this file.

## Top-level fields

| Field | Type | Meaning |
| --- | --- | --- |
| `overview` | object | Run summary; see **overview** below |
| `clusters` | object[] | Cluster catalog, one entry per fingerprint the run touched |
| `decisions` | object[] | Every escalated question, its answer, and its effect on the outcome |
| `timeline` | object[] | Phase/gate durations, baseline vs. post-upgrade |
| `follow_ups` | object[] | Deprecations noticed, non-fatal warnings, suggested next actions |

## overview

| Field | Type | Meaning |
| --- | --- | --- |
| `from_sdk` / `to_sdk` | string | SDK versions the run bumped from and to |
| `apps` | string[] | App names covered by this run |
| `platforms` | string[] | Platforms covered, from each app's contract entry |
| `duration_s` / `commit_count` | number | Total run wall-clock time; commits landed on the upgrade branch |
| `lane_outcomes` | object | `"<app-slug>_<platform>" → "green"\|"blocked"` final state, keyed like the ledger's `builds` (`references/worker-briefs.md`'s path convention) |

## clusters[]

| Field | Type | Meaning |
| --- | --- | --- |
| `fingerprint` | string | Dedup key, same as in the ledger's cluster registry |
| `diagnosis` | string | One-line root cause |
| `affected` | object | `{apps[], platforms[], gates[]}` |
| `fix` | object | `{files_touched[], diff_summary, commit_shas[]}` — omitted/empty when `status` is `blocked` |
| `attempts_used` | number | Fix attempts spent (max 3) |
| `validation` | string | Narrowest check that proved the cluster fixed |
| `evidence_paths` | string[] | Findings and raw-log paths |
| `status` | string | `fixed` \| `blocked` |
| `pre_existing` | boolean | `true` when the cluster's gate was already red in `state.json.baseline`; pre-existing failures are never attributed to the upgrade |
| `recommended_next_step` | string | Human-actionable next step; present when `status` is `blocked` |

## decisions[]

| Field | Type | Meaning |
| --- | --- | --- |
| `question` | string | The escalated question as raised |
| `answer` | string | The human's answer |
| `changed_outcome` | string | Where and how the answer changed the run's result |

## timeline[]

| Field | Type | Meaning |
| --- | --- | --- |
| `phase` | string | Phase name, e.g. `loop1` |
| `gate` | string \| null | Gate id when this row is gate-level, else `null` for a phase-level row |
| `duration_s` | number | Measured duration |
| `baseline_s` | number \| null | Phase-1 baseline duration for the same gate, for comparison |

## follow_ups[]

| Field | Type | Meaning |
| --- | --- | --- |
| `type` | string | `deprecation` \| `warning` \| `suggested_action` |
| `description` | string | One-line follow-up in plain language |

## Fixture

Illustrative only — a fictional live run showing the shapes, never a starting point for a real report.

```json
{
  "overview": {
    "from_sdk": "54", "to_sdk": "55", "apps": ["@acme/storefront"], "platforms": ["ios", "android"], "duration_s": 9840, "commit_count": 3,
    "lane_outcomes": { "acme-storefront_ios": "green", "acme-storefront_android": "green" }
  },
  "clusters": [{ "fingerprint": "ios-build-missing-symbol-moduleregistry", "diagnosis": "expo-modules-core pod pinned below SDK 55's ABI.", "affected": { "apps": ["@acme/storefront"], "platforms": ["ios"], "gates": ["build.ios"] }, "fix": { "files_touched": ["apps/storefront/ios/Podfile.lock"], "diff_summary": "Refreshed the pod lock to the expo-modules-core release on the SDK 55 grid.", "commit_shas": ["8f2c1a9"] }, "attempts_used": 1, "validation": "build.ios rerun clean for the storefront app", "evidence_paths": ["reports/run-2026-08-14T19-05Z/clusters/ios-build-missing-symbol-moduleregistry/attempt-1/findings.md"], "status": "fixed", "pre_existing": false }],
  "decisions": [{ "question": "The storefront's avatar picker used expo-image-picker's legacy result shape; SDK 55 changed it. Adapt the call site or pin the old API?", "answer": "Adapt the call site to the new result shape.", "changed_outcome": "Kept storefront-checkout on the current SDK's supported API instead of a version pin that would block future upgrades." }],
  "timeline": [{ "phase": "baseline", "gate": null, "duration_s": 640, "baseline_s": null }, { "phase": "loop1", "gate": "build.ios", "duration_s": 245, "baseline_s": 210 }],
  "follow_ups": [{ "type": "deprecation", "description": "expo-image-picker's legacy result shape is removed in SDK 56; no more grace period after this upgrade." }, { "type": "suggested_action", "description": "Open a PR from upgrade/sdk-55 now that the final verify is green." }]
}
```
