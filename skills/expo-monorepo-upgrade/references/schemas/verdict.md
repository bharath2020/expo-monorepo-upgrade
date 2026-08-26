# Agent verdict

Every preflight, procedure, general review, checkpoint, recovery, generic, or
reporting agent writes one JSON object to its assigned `verdict.json`, then returns
that same JSON alone. Logs and detailed findings stay on disk. An orchestrator
accepts the result only after its schema and evidence bindings are valid.

## Shape

```json
{
  "schema_version": 1,
  "dispatcher_id": null,
  "unit_id": "post-validation--apps-example--ios--validation",
  "procedure_ref": "apps[0].platforms.ios.validation",
  "stage": "post_validation",
  "profile_id": "observation",
  "harness": "claude",
  "model": "claude-sonnet-5",
  "reasoning_effort": "medium",
  "profile_selection": "preferred",
  "profile_selection_reason": "Claude compatibility passed preflight.",
  "profile_evidence_paths": ["reports/<run-id>/units/preflight/attempt-1/dispatch-1/verdict.json"],
  "status": "red",
  "summary": "The iOS build failed while linking ExpoModulesCore.",
  "duration_seconds": 214,
  "source_sha_before": "<sha>",
  "source_sha_after": "<sha>",
  "input_candidate_diff_sha256": null,
  "base_prompt_sha256": "<sha256>",
  "brief_sha256": "<sha256>",
  "evidence_paths": ["reports/<run-id>/units/<unit-id>/attempt-1/dispatch-1/output.log"],
  "clusters": [
    {
      "fingerprint": "link-expo-modules-core-missing-symbol",
      "risk_tier": "high",
      "risk_basis": "The missing native symbol prevents application startup.",
      "grouping_basis": null,
      "repair_targets": ["ios/Rainbow/AppDelegate.swift"],
      "summary": "ExpoModulesCore is missing a symbol required by the app target.",
      "failure_evidence": "The linker evidence is cited in findings.md.",
      "evidence_paths": ["reports/<run-id>/units/<unit-id>/attempt-1/dispatch-1/findings.md"]
    }
  ],
  "changes": {
    "files": [],
    "commit_sha": null,
    "candidate_snapshot_path": null,
    "candidate_diff_sha256": null
  },
  "result": null,
  "blocker": null,
  "recommendation": "Dispatch this app's ordered repair queue to a cluster orchestrator."
}
```

## Common invariants

- `status` is `green`, `red`, or `blocked`.
- `harness` is `codex` or `claude`; `profile_selection` is `preferred`,
  `fallback`, or `human_escalation`. A fallback or escalation has a non-empty
  reason and evidence path.
- Identity, harness, model, reasoning effort, profile selection and evidence,
  source SHA, prompt hashes, candidate input hash, and dispatcher id equal the
  immutable brief and state record.
  `dispatcher_id` is non-null only for an agent dispatched by one single-cluster
  dispatcher.
- Every evidence path exists inside the run directory and is repository-relative.
- `green` has no clusters or blocker, except an authoritative green procedure may
  separately carry its complete empty same-scope cluster set.
- `red` has one or more clusters and no blocker. An observation or authoritative
  rerun reports the complete cluster set produced by its one app-scoped procedure.
- `blocked` has a non-null blocker and may include already diagnosed clusters.
- Fingerprints are stable lowercase slugs meaningful only within their literal app
  and optional platform scope.
- Observation and authoritative-procedure agents categorize clusters through
  [failure clustering](../failure-clustering.md). Every cluster records
  `risk_tier`, `risk_basis`, `repair_targets`, and `grouping_basis`; the grouping
  basis is `null` for one repair target and evidence-backed for multiple targets.

## Cluster dispatcher results

A cluster dispatcher writes `dispatchers/<dispatcher-id>/result.json` and returns
that same JSON alone. It is not an agent verdict. It contains:

- schema version, dispatcher id, literal app path, input-state SHA-256, and the
  complete supplied ordered queue identity;
- dispatcher harness, model, effort, profile selection, and every child profile it
  selected;
- exactly one `selected_cluster`, equal to the supplied queue head;
- `status` equal to `ready_for_checkpoint`, `blocked`, or `cancelled`;
- repair, code-review, code-change-principles-review, and authoritative-procedure
  verdict paths, using `null` for gates that did not validly open;
- candidate snapshot/hash when ready, the authoritative complete same-scope
  cluster set, all evidence paths, blocker, and recommendation.

It never reports a result for a second cluster. `ready_for_checkpoint` requires a
green repair, exactly two green reviews, and a green complete original procedure
rerun, all bound to the same candidate identity.

## Procedure agents

Observation agents do not edit tracked files or Git. When bound to a candidate,
their input hash identifies the exact uncommitted diff they observed.

A changelog procedure agent uses procedure reference `changelogs` and stage
`changelog_download`. It reports only `green` or `blocked`, never `red`; has an
empty cluster set and no source changes or candidate; and leaves both source SHA
fields equal to the verified bump checkpoint. Its `result` binds the target SDK,
owner-supplied additional sources, starting source checkpoint, bump checkpoint,
exact `reports/<run-id>/changelogs` directory, index, manifest and manifest
SHA-256, requested and final sources, version coverage, and complete file/hash
map. Green requires every recorded path and hash to validate. Missing coverage,
an invalid source, or a conflicting existing directory is blocked and cannot open
post-bump validation.

A green bump agent has a non-empty file list, no commit SHA, an immutable candidate
snapshot and hash, and equal source SHA fields. It leaves the candidate uncommitted.

A green repair agent has the same change shape: non-empty files, no commit SHA,
snapshot and hash, and equal source SHA fields. A red repair restores only its own
iteration changes to the input candidate; if it cannot prove restoration, it is
blocked.

## General review agents

Review procedure references are `audit.code-review` and
`audit.code-change-principles`. They may be dispatched only after the source repair
verdict is green. They report no source changes or commits and bind their verdict
to `input_candidate_diff_sha256`.

Their harness/model/effort must match the candidate-author rule in
[harness and model selection](../harness-and-model-selection.md). A code review
uses the opposite model family when Claude is eligible; otherwise both verdicts
record the degraded all-Codex selection.

A red review places each required change in `clusters` as a scope-local review
comment with exact diff evidence. A changed candidate invalidates both reviewers'
prior verdicts.

## General checkpoint agents

Checkpoint procedure reference is `checkpoint.finalize`. Its input candidate hash
must equal the accepted candidate. A green verdict has the exact candidate file
list and a non-null commit SHA; `source_sha_after` equals that commit. It cites
verification of parent, trailers, file set, and diff hash.

For a bump checkpoint, review and authoritative-validation inputs are
`not_required`. For a repair checkpoint, the verdict cites both green reviews and
the green authoritative rerun bound to the same candidate hash with the target
fingerprint absent. The checkpoint agent never edits candidate content.

## Generic workers

Either orchestrator may dispatch a fresh general worker for a bounded
skill-defined task. There is no fixed generic-worker role, procedure-reference
namespace, or operation catalog. The rendered brief defines the task identity,
immutable inputs, allowed paths, forbidden actions, and expected `result` shape.

A generic worker reports no source change or commit unless its bounded assignment
is checkpoint finalization. For a control-plane write, `result` includes the input
and written state paths and SHA-256 values, evidence inputs, app/platform scope,
and queue before/after when a queue is affected. A green verdict requires every
declared output and reread hash to match. A blocked verdict must not leave a
partial mutation. The worker never decides the next workflow transition unless it
was explicitly dispatched as an orchestrator rather than a general worker.

## Other general agents

Preflight uses `preflight.inspect` and changes neither source nor state. Reporting
uses `report.render`, writes only its assigned `report.json` and `summary.md`, and
changes neither source nor state. Both bind their outputs to the immutable input
state and brief identities.

## Commit-recovery agents

A commit-before-verdict recovery agent uses
`recovery.commit-before-verdict`. Its `changes` identify the existing commit it
inspected; the agent did not create it. It returns green only when the existing
commit exactly matches the previously accepted candidate and checkpoint dispatch
evidence. Otherwise it returns blocked.

## Malformed or missing results

Reject a verdict when any required field, status invariant, source identity,
prompt hash, candidate binding, or evidence path fails. Follow the one-time
identical transport redispatch rule in
[general prompt rendering](../general-prompt-rendering.md); never repair a malformed
result in orchestrator memory.
