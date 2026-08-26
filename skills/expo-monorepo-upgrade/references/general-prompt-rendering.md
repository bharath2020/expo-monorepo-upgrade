# General prompt rendering

Use these guidelines when assembling any worker brief. They define only the
instructions shared by every dispatch; the active workflow supplies its own stage
instructions.

Every procedure or skill-defined agent receives one immutable brief:

```text
rendered YAML prompt or skill-defined base task
+ common orchestration envelope
+ exactly one stage prompt from the owning workflow
```

An orchestrator may dispatch a fresh generic worker to assemble and record the
brief as a bounded control-plane task. There is no special renderer-worker subtype.

## Render

1. Read the selected YAML prompt from the immutable contract snapshot, or accept
   the skill-defined base task from the applicable workflow.
2. For YAML procedures, substitute only the inputs allowed by
   [the YAML contract](yaml-contract.md). Preserve all other bytes and ordering.
3. Reject any remaining `{{...}}` or `[[...]]` token.
4. Hash the completed base task as `base_prompt_sha256`.
5. Resolve and record the dispatch profile through
   [harness and model selection](harness-and-model-selection.md).
6. Read `source_sdk`, `target_sdk`, and the active changelog-reference identity
   from run state. For bootstrap preflight before state exists, use `pending` for
   the source SDK, the immutable request target, and `pending`, or
   `not_applicable_test_run` when requested. Reject every post-preflight render
   when either SDK is missing or unresolved. Use `pending` before the changelog
   procedure, `preparing` for that procedure, `ready` only after its accepted
   identity is recorded, and `not_applicable_test_run` throughout `--test-run`. A
   ready identity includes the recorded download directory, index, manifest,
   manifest SHA-256, and complete file/hash map. Resolve its paths beneath the
   recorded repository root, then verify and inject their absolute forms before
   rendering every later brief.
7. Append the common envelope below, then the one stage prompt supplied by the
   active workflow.
8. Resolve `<absolute-skill-dir>` to the literal absolute skill directory before
   writing and hashing the brief. Verify every mandatory instruction reference is
   an existing readable file, and reject the render if a reference remains
   unresolved.
9. Write the complete brief to
   `reports/<run-id>/prompts/<unit-id>/attempt-<n>/dispatch-<m>.md`. Hash the full
   brief as `brief_sha256`, omitting only its own hash line, and store its path and
   both hashes in state before dispatch.

Do not combine stage prompts, recreate one here, or append instructions from a
different workflow. Use a filesystem-safe unit id such as
`<stage>--<app-slug>--<platform-or-all>--<procedure>`. The literal procedure
reference and app path remain the authoritative identity in the brief and verdict.

## Common envelope

Append this block with literal values:

```markdown
---

## Orchestration context

- Run: <run-id>
- Cluster dispatcher: <dispatcher-id-or-null>
- Unit: <unit-id>
- Stage: <stage>
- Procedure: <procedure-ref>
- Profile: <profile-id>
- Harness: <codex-or-claude>
- Model: <exact-model-id>
- Reasoning effort: <low-or-medium-or-high-or-xhigh-or-max>
- Profile selection: <preferred-or-fallback-or-human-escalation>
- Profile selection reason: <literal-reason>
- Profile evidence:
  <repository-relative-capability-or-decision-evidence-paths-or-none-for-bootstrap-preflight>
- Repository root: <absolute-repo-root>
- Source Expo SDK: <source-sdk-or-pending-for-bootstrap-preflight>
- Target SDK: <target-sdk>
- Expo SDK migration: <source-sdk-or-pending-for-bootstrap-preflight> -> <target-sdk>
- Changelog reference status: <pending-or-preparing-or-ready-or-not_applicable_test_run>
- Changelog download directory: <absolute-run-changelogs-path-or-pending-or-not_applicable_test_run>
- Changelog index: <absolute-markdown-index-path-or-pending-or-not_applicable_test_run>
- Changelog manifest: <absolute-manifest-path-or-pending-or-not_applicable_test_run>
- Changelog manifest SHA-256: <sha256-or-pending-or-not_applicable_test_run>
- App path: <repo-relative-path-or-null>
- Platform: <platform-or-null>
- Procedure attempt: <n>/<cap>
- Transport dispatch: <m>/2
- Source SHA: <source-sha>
- Starting checkpoint: <checkpoint-sha>
- Candidate snapshot: <absolute-immutable-candidate-directory-or-null>
- Candidate diff SHA-256: <sha256-or-null>
- Review feedback: <absolute-review-verdict-paths-or-none>
- Deadline: <absolute-timestamp-and-duration>
- Findings: <absolute-findings-path>
- Output log: <absolute-output-path>
- Verdict: <absolute-verdict-path>
- Base prompt SHA-256: <hash-of-rendered-base-task>
- Brief SHA-256: <hash-of-this-brief-with-this-line-omitted>

## Execution contract

Follow the task above exactly. For a contract-backed execution, its YAML prompt
owns all repository-specific commands, prerequisites, and recovery steps. Do not
invent a replacement command or fallback when it cannot be completed. For a
skill-defined task, use only its supplied immutable inputs and assigned outputs.

Work only in the stated scope. Capture stdout, stderr, device or pipeline artifacts,
and exact failure points under the supplied dispatch directory. Keep working and
poll the process you started until it finishes or the deadline expires; never start
a duplicate because an initial wait yielded.

When `Changelog reference status` is `ready`, refer to the downloaded changelog
files in `Changelog download directory` for SDK, dependency, API, build-tool, or
migration information relevant to this task. Start with `index.md`,
verify `manifest.json` against the supplied SHA-256, and cite every exact local
Markdown path used. Do not search for, download, replace, or modify changelog
files. Only the `changelogs` procedure with status `preparing` may search for and
download them. A `pending` or `not_applicable_test_run` status provides no
changelog authority or reference material.

Write findings and a verdict matching <skill-dir>/references/schemas/verdict.md
before returning. Return the verdict JSON alone after the file exists.
```

`base_prompt_sha256` identifies execution content across transport retries.
`brief_sha256` identifies one dispatch, including paths and deadline. For
`validation`, `smoke`, and `full_e2e`, YAML runtime inputs remain empty, while
`Procedure`, `App path`, and optional `Platform` in the envelope are mandatory
orchestration metadata.

Changelog fields are `pending` for preflight, baseline, bump, bump checkpoint, and
pre-download recovery; the changelog procedure uses `preparing` with its assigned
output directory and pending index/manifest identity. After the download result is
recorded, every field is `ready`; a missing file or hash mismatch blocks rendering
rather than reopening web research. Every `--test-run` brief uses
`not_applicable_test_run` and omits changelog directory access.

Harness, model, effort, selection reason, and profile evidence are immutable
dispatch identity. Preserve them for an identical transport redispatch. A fresh
substantive repair attempt resolves the next attempt profile before rendering its
new brief.

## Deadlines

The YAML carries no orchestration timeout. Establish a measured budget per
procedure reference:

- First invocation: choose a conservative host/tool deadline; app validation at
  least 10 minutes, native validation or smoke at least 30 minutes, and full E2E at
  least 60 minutes unless the user or environment imposes another cap.
- Later invocation: use `max(3 × last successful duration, first-invocation floor)`.
- After the first post-bump timeout, allow one cold-build correction by doubling
  the budget and rerunning the same YAML prompt and runtime inputs as a new
  procedure attempt. A second timeout is a real failure.

The main orchestrator chooses the deadline from durable timings and dispatches a
generic worker to record it before dispatch. Expiry stops waiting safely; it does
not authorize killing remote work. Dispatch a fresh generic worker to record
whether the process stopped, remains live, or is unknown so resume cannot duplicate
it.

## Malformed or missing verdict

Inspect the assigned verdict path first. Rejoin a live worker or process. If both
are gone, reconcile any checkpoint commit or uncommitted bump/repair candidate
through [run state](run-state.md) before redispatch. When no owned source change
landed, dispatch a generic worker to record `worker_lost`, then a fresh generic
worker to render and record transport dispatch 2 under the same procedure attempt.
Preserve the rendered base task, runtime inputs, source identity, starting
checkpoint, candidate and review inputs, and stage prompt; change only dispatch
identity, deadline, output paths, and `brief_sha256`. Preserve the selected harness,
model, and effort. A second transport failure blocks the unit without spending a
repair attempt.
