# Run state and recovery

The run must be reconstructable without conversation history or a live agent. Keep
the control plane under `reports/<run-id>/`. The main orchestrator reads durable
results only to decide the next dispatch; it never writes this directory or run
state. Every authoritative state, queue, event, journal, or prompt-record mutation
is a bounded task delegated by an orchestrator to a fresh generic worker. There is
no dedicated state-worker role or fixed operation catalog. Procedure, review,
checkpoint, recovery, reporting, and cluster-dispatcher roles write only their
assigned immutable outputs and authorized repository changes.

## Layout

```text
reports/<run-id>/
├── state.json
├── events.jsonl
├── journal.md
├── contract.snapshot.yaml
├── changelogs/
│   ├── index.md
│   ├── manifest.json
│   └── sources/*.md
├── prompts/<unit-id>/attempt-<n>/dispatch-<m>.md
├── candidates/<unit-or-cluster-id>/iteration-<n>/
│   ├── candidate.patch
│   ├── files.json
│   └── untracked/...
├── units/<unit-id>/attempt-<n>/dispatch-<m>/
│   ├── output.log
│   ├── findings.md
│   ├── verdict.json
│   └── artifacts/...
├── dispatchers/<dispatcher-id>/result.json
├── report.json
└── summary.md
```

A generic worker assigned a control-plane update writes `state.json` atomically
after the decided transition and appends one event and one short journal line for
that same update. Its brief carries the expected input-state SHA-256, exact allowed
paths, and expected outputs; its verdict returns the written state hash. Stale
writers block instead of merging. Never rely on an in-memory plan as the only
record.

## State schema

Use `schema_version: 1` and these top-level fields:

| Field | Meaning |
| --- | --- |
| `run_id`, `repository_root` | Stable run identity and absolute repository root |
| `source_sdk`, `target_sdk` | Concrete source resolved before the bump and concrete target supplied by the user |
| `changelog_references` | Status, exact download directory, source and target SDKs, owner-supplied additional sources, source and bump checkpoints, index and manifest paths, manifest SHA-256, requested/final URLs, file hashes, and version coverage |
| `source_sha`, `branch`, `checkpoint_sha` | Starting revision, upgrade branch, latest accepted commit |
| `contract_path`, `contract_sha256`, `contract_snapshot` | Immutable contract identity |
| `main_profile`, `harness_capabilities` | Required orchestrator profile plus preflighted Codex, Claude Code, Herdr, instruction, and skill compatibility evidence |
| `phase`, `status` | Current stage and `running`, `complete`, `blocked`, or `cancelled` |
| `units` | Procedure and skill-defined worker units |
| `clusters` | Scope-qualified fingerprint to cluster record |
| `cluster_queues` | Durable ordered app queues; the active dispatcher selects the head |
| `cluster_dispatchers` | Dispatcher-id map of input queue head, selected cluster, status, heartbeat, and result path |
| `active_candidate` | Sole uncommitted bump or repair candidate, owner, snapshot, hash, and files |
| `locks` | Active resource lock to unit or dispatcher id |
| `in_flight` | Active agent handle, harness, model, effort, profile selection, additional directories, process evidence, heartbeat, brief, and verdict paths; completed assignments are removed after reconciliation |
| `herdr` | Workspace, tab, orchestrator pane, active-only two-row worker-grid pane ids, next row-first position, and historical closed pane ids |
| `checkpoints` | Ordered verified commits and checkpoint-worker evidence |
| `decisions`, `open_questions` | Durable human and orchestration decisions |
| `started_at`, `updated_at` | UTC timestamps |

For a normal run, initialize `changelog_references.status` as `pending`. After the
green changelog verdict is independently reread, record this shape atomically:

```json
{
  "status": "ready",
  "directory": "reports/<run-id>/changelogs",
  "source_sdk": "<source-sdk>",
  "target_sdk": "<target-sdk>",
  "additional_sources": "none",
  "source_sha": "<starting-source-sha>",
  "bump_checkpoint_sha": "<verified-bump-checkpoint-sha>",
  "index_path": "reports/<run-id>/changelogs/index.md",
  "manifest_path": "reports/<run-id>/changelogs/manifest.json",
  "manifest_sha256": "<sha256>",
  "requested_and_final_sources": [],
  "version_coverage": {},
  "file_hashes": {}
}
```

Use the literal recorded source list instead of `none` when supplied. A
`--test-run` records `status: not_applicable_test_run` and no directory or file
identity.

A unit record contains:

```json
{
  "procedure_ref": "apps[0].platforms.ios.validation",
  "description": "Build and validate the iOS application.",
  "stage": "post_validation",
  "app_path": "apps/example",
  "platform": "ios",
  "dispatcher_id": null,
  "profile_id": "observation",
  "harness": "claude",
  "model": "claude-sonnet-5",
  "reasoning_effort": "medium",
  "profile_selection": "preferred",
  "profile_selection_reason": "Claude compatibility passed preflight.",
  "profile_evidence_paths": ["reports/<run-id>/units/preflight/attempt-1/dispatch-1/verdict.json"],
  "status": "pending",
  "procedure_attempt": 0,
  "procedure_attempt_cap": 1,
  "transport_dispatch": 0,
  "transport_dispatch_cap": 2,
  "source_sha": "<sha>",
  "input_candidate_diff_sha256": null,
  "prompt_path": null,
  "base_prompt_sha256": null,
  "brief_sha256": null,
  "verdict_path": null,
  "output_candidate_snapshot_path": null,
  "output_candidate_diff_sha256": null,
  "duration_seconds": null,
  "evidence_paths": []
}
```

Unit statuses are `pending`, `running`, `green`, `red`, `blocked`, `ineligible`, or
`stale`. An omitted YAML procedure creates no unit. Missing evidence is never
green.

Each cluster record contains app/platform scope, fingerprint, source procedure,
baseline relationship, risk tier and basis, grouping basis, queue position, active
dispatcher id, repair attempt count, candidate hashes and author profile, two
reviewer profiles and verdicts, authoritative reruns, checkpoint SHA, and next
action. Queue statuses are `queued`, `selected`, `repairing`, `reviewing`,
`validating`, `ready_for_checkpoint`, `closed`, `resolved_by_overlap`, or `blocked`.

A dispatcher record contains the supplied app queue identity and records exactly
its head as the selected cluster. It cannot skip or reorder entries and cannot
select a second cluster. Status is `running`, `ready_for_checkpoint`, `blocked`,
`cancelled`, or `retired`. It also records its harness, model, effort, profile
selection reason/evidence, and every child profile it selected.

## Events

Every JSONL event has `type` and UTC `at`. Use at least:

- `run_started`, `run_resumed`, `phase_started`, `phase_closed`;
- `profile_selected`, `profile_escalated`, `unit_rendered`, `unit_dispatched`,
  `heartbeat`, `worker_lost`, `verdict`, `pane_closed`, `worker_grid_compacted`;
- `clusters_discovered`, `cluster_queued`, `cluster_selected`;
- `dispatcher_started`, `dispatcher_heartbeat`, `dispatcher_result`,
  `dispatcher_retired`;
- `repair_dispatched`, `candidate_created`, `candidate_revised`;
- `changelogs_downloaded`, `changelog_reference_gap`;
- `reviews_dispatched`, `review_verdict`, `candidate_validated`;
- `checkpoint_dispatched`, `checkpoint_created`, `checkpoint_recovered`,
  `checkpoint_rejected`;
- `cluster_fixed`, `cluster_blocked`, `resolved_by_overlap`, `flake`;
- `question_opened`, `question_answered`, `contract_changed`;
- `run_completed`, `run_blocked`, `run_cancelled`.

Name the unit, dispatcher, cluster, scope, attempt, source SHA, and evidence paths
that apply.

## Resume

1. Use the preflight agent's unfinished-run identities matching repository root and
   target SDK. If several match, ask which one to resume.
2. Use the fresh preflight verdict's YAML hash. If it differs from the snapshot,
   decide to block the old run and dispatch a generic worker to record
   `contract_changed`. The edited YAML is a fresh contract for a new run; there is
   no update, migration, or in-place replan.
3. The main orchestrator decides how to reconcile every in-flight agent before
   judging checkout cleanliness. A valid verdict wins. Otherwise rejoin a live
   agent or its process.
   After accepting and recording a valid result, close its matching pane and
   compact the active grid before another dispatch.
4. Redispatch only after verdict, agent, and process are all absent and a
   generic worker has recorded `worker_lost`. Reconcile any uncommitted
   candidate or commit-before-verdict window first.
5. Once no mutation owns the checkout, dispatch a fresh read-only recovery agent
   to require HEAD to equal `checkpoint_sha` and allow source changes only when
   they exactly match `active_candidate`. Any other mismatch blocks; never reset,
   clean, stash, or discard by guess.
6. When a later verified checkpoint may affect evidence scope, the main
   orchestrator decides the affected units and dispatches a generic worker to mark
   them stale.
7. Rejoin an active cluster dispatcher when possible. If it selected a head before
   disappearing, reconstruct that same cluster's decision position from durable
   worker verdicts and dispatch a replacement bound to that selection. If no
   selection was recorded, dispatch the current ordered queue and require the
   replacement to select its head.
8. For changelog state, re-read the recorded directory, manifest, and complete
   file/hash map before any later dispatch. If a settled green changelog verdict
   exists but its state write is missing, dispatch a fresh read-only recovery agent
   to validate the exact request and checkpoint identity before recording it. An
   absent, partial, conflicting, or changed directory blocks; never overwrite,
   delete, merge, or redownload it during recovery.
9. Continue at the earliest unsettled prerequisite. Do not replay green work or
   spend a repair attempt for an identical transport redispatch. Preserve its
   harness, model, and effort; resolve a new profile only for a new substantive
   attempt under the recorded policy.

## Candidate recovery

A green bump or repair agent never commits. Before it returns, it preserves the
full tracked patch, candidate-owned untracked manifest/content, file list, and
SHA-256 in its assigned outputs.

On resume, dispatch a fresh read-only recovery agent to recompute the working
candidate from its starting checkpoint. If it matches the recorded output hash,
resume the earliest missing gate: bump checkpoint, repair reviews, authoritative
rerun, or repair checkpoint. If it matches a lost repair agent's input hash,
dispatch a generic worker to record that no accepted change landed and use the
identical transport redispatch. Any other diff blocks reconciliation.

## Checkpoint finalization

Neither orchestrator stages or commits. The main orchestrator dispatches a fresh
general checkpoint agent using the skill-defined base task and appended stage
prompt below, rendered through
[general prompt rendering](general-prompt-rendering.md).

- For `bump`, require the green bump candidate; reviews and authoritative
  validation are `not_required`.
- For `repair`, require a green repair verdict, two green review verdicts, and a
  green authoritative procedure verdict, all bound to the same candidate hash,
  with the target cluster absent.

```markdown
# Create one verified upgrade checkpoint

- Run: <run-id>
- Candidate kind: <bump|repair>
- Source unit: <unit-id>
- Cluster: <cluster-id-or-null>
- Starting checkpoint: <source-sha>
- Candidate snapshot: <immutable-candidate-directory>
- Candidate diff SHA-256: <sha256>
- Candidate files: <exact-files>
- Source success verdict: <path>
- Code-review verdict: <path-or-not-required>
- Code-change-principles verdict: <path-or-not-required>
- Authoritative validation verdict: <path-or-not-required>
- Commit trailers: <literal-run-unit-and-base-prompt-trailers>

Verify every required input for this candidate kind, then create exactly one
checkpoint without changing candidate content.
```

### Appended checkpoint prompt

```markdown
Do not edit source content or run a repository procedure. Recompute the live
tracked patch and candidate-owned untracked manifest and require an exact match
with Candidate diff SHA-256 and Candidate files. For a repair, require both green
review verdicts and the authoritative green verdict to bind to that same hash and
require the target cluster to be absent. For a bump, reviews and authoritative
validation are not required. Stage only Candidate files, commit once with the
supplied trailers, then verify parent, file set, trailers, and parent-to-commit
diff hash. Return green with the commit SHA only when every check matches;
otherwise return blocked without altering candidate content or discarding files.

Write `findings.md` with these exact sections:

1. `Candidate binding` — candidate kind, Starting checkpoint, candidate snapshot,
   diff SHA-256, file list, and required verdict identities.
2. `Verification` — live candidate, gate, parent, file-set, and trailer checks.
3. `Commit` — created commit SHA and parent-to-commit diff hash, or `none`.
4. `Result` — green with the verified commit identity, otherwise blocked with the
   exact failed proof and safe next action.

Then write `verdict.json` in the supplied verdict shape. On green, make `changes`
contain the exact candidate files and commit SHA; match all source bindings,
evidence, status, and blocker to `findings.md`; and return that JSON alone.
```

After accepting the checkpoint verdict, the main orchestrator dispatches a fresh
generic worker to record a bump checkpoint or to record and reconcile a repair
checkpoint. Only that bounded worker assignment advances `checkpoint_sha`.

For a repair, that generic worker retires the completed dispatcher and reconciles
the returned same-scope cluster set. It returns the revised queue. When eligible
clusters remain, the main orchestrator dispatches that queue unchanged to a new
cluster dispatcher, which selects the queue head.

## Commit-before-verdict recovery

If a checkpoint agent may have committed before its verdict was recorded, render
this skill-defined base task through
[general prompt rendering](general-prompt-rendering.md):

```markdown
# Recover one commit-before-verdict window

- Run: <run-id>
- Source unit: <unit-id>
- Starting checkpoint: <source-sha>
- Existing commit: <commit-sha>
- Accepted candidate snapshot: <immutable-candidate-directory>
- Accepted candidate diff SHA-256: <sha256>
- Accepted candidate files: <exact-files>
- Original rendered prompt: <path>
- Findings and validation evidence: <paths>
- Checkpoint dispatch evidence: <paths>

Determine whether the existing commit exactly proves the accepted checkpoint.
```

### Appended recovery prompt

```markdown
Do not edit files, change Git state, rerun the repository procedure, or commit.
Verify the existing commit's parent and Expo-Upgrade trailers against run state,
then inspect only its diff, original rendered brief, findings, and validation
evidence. Return green only when those artifacts prove the original mutation
completed successfully and within scope; return blocked when proof is incomplete.
Name the recovered unit and original base/brief hashes in the recovery verdict.

Write `findings.md` with these exact sections:

1. `Recovery binding` — run, unit, Starting checkpoint, existing commit, accepted
   candidate hash and files, and original prompt hashes.
2. `Proof checks` — parent, trailers, file set, diff hash, required gates, and
   evidence identity with an outcome for each.
3. `Result` — green with the recovered commit and unit identity, otherwise blocked
   with the exact incomplete proof and safe next action.

Then write `verdict.json` in the supplied verdict shape. Identify the existing
commit in `changes`, match source identities, hashes, evidence, status, and blocker
to `findings.md`, and return that JSON alone.
```

The proof must establish:

- commit parent equals the unit's starting checkpoint;
- required Expo-Upgrade trailers match state;
- file set and diff hash equal the already accepted candidate;
- all gates required for the candidate kind were green before checkpoint dispatch.

When proof is incomplete, block. When it is complete, dispatch a fresh read-only
recovery agent with procedure reference `recovery.commit-before-verdict`. It
uses only the base task and appended prompt above. After a green recovery verdict,
the main orchestrator dispatches a fresh generic worker to adopt the verified
commit and advance state; never fabricate the missing checkpoint verdict.

## Waiting and boundaries

Wait in bounded stretches, use fresh generic workers for durable heartbeat
updates, and poll a command that outlives its first wait instead of launching a
duplicate. On cancellation, stop new dispatches, ask active agents to preserve
evidence, dispatch a generic worker to record process state, and leave candidates
and run artifacts intact.

Roll back automatically only changes precisely owned by the current mutation
attempt and only after preserving evidence. A repair iteration returns to its input
candidate, not necessarily the source checkpoint. Ambiguous ownership blocks.
