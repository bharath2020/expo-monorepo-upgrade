# Reporting and close

The main orchestrator decides when reporting is eligible and dispatches a fresh
general reporting agent. The reporting agent writes `report.json` and `summary.md`
from durable state, verdicts, dispatcher results, and findings. Neither
orchestrator reconstructs results from conversation memory or edits report content.

Render this skill-defined base task through
[general prompt rendering](general-prompt-rendering.md), then append the reporting
prompt below:

```markdown
# Render the final upgrade report

- Run: <run-id>
- Final state: <state-path>
- Final state SHA-256: <sha256>
- Verdict paths: <validated-paths>
- Dispatcher result paths: <validated-paths>
- Findings and evidence paths: <validated-paths>
- Report JSON output: <report-json-path>
- Summary output: <summary-path>

Render the two assigned artifacts from these durable inputs and return their paths
and hashes.
```

## Appended stage prompt

```markdown
Read only the supplied final state identity, validated verdicts, dispatcher
results, findings, and evidence paths. Write report.json and summary.md to their
assigned run paths without editing source or run state, changing Git, rerunning a
repository procedure, or reconstructing facts from conversation history. Return
green only when both artifacts validate against the supplied final state hash.

Write `findings.md` with these exact sections:

1. `Input binding` — run id, final-state path and SHA-256, and every consumed
   verdict, dispatcher-result, findings, and evidence path.
2. `Artifacts` — `report.json` and `summary.md` paths and SHA-256 values.
3. `Validation` — schema, completeness, attribution, banner, and final-state hash
   checks with their outcomes.
4. `Result` — green when both artifacts validate, otherwise blocked with the exact
   missing or inconsistent input and safe next action.

Then write the agent `verdict.json` in the supplied verdict shape. Put both output
paths and hashes in `result`, match status, evidence, and blocker to `findings.md`,
and return that verdict JSON alone.
```

## `report.json`

Use these top-level sections:

- `overview`: run id, source/target SDK, repository root, branch, final checkpoint,
  duration, status, and contract SHA-256;
- `scopes`: one app entry per literal contract path, with every configured app and
  platform procedure;
- `baseline`: every configured validation result and its evidence, including
  pre-existing and blocked clusters;
- `procedures`: every unit with stage, procedure reference, status, attempt counts,
  source SHA, duration, hashes, prompt/verdict paths, and evidence;
- `clusters`: scope-qualified fingerprint, durable app queue position,
  top-of-queue dispatcher selection, attempts, findings, checkpoint, final status,
  and next action;
- `audits`: successful repair candidate hash, two general-review verdicts, review
  iterations, authoritative rerun, and resulting checkpoint;
- `checkpoints`: ordered source commits plus checkpoint-agent evidence;
- `decisions`: every question, answer, and resulting transition;
- `follow_ups`: flakes, pre-existing failures, ineligible work, contract
  improvements, and blocked lanes.

An absent optional YAML entry is `not_configured`, not a skipped unit. A configured
downstream procedure that could not open is `ineligible` with its prerequisite.

## Attribution

- A scope-local cluster whose fingerprint also failed at baseline is
  `pre_existing: true` and is never attributed to the upgrade.
- A smoke or full-E2E cluster is observed after the upgrade, not automatically
  proven upgrade-caused.
- A pass-on-retry is a flake and retains both attempt evidence paths.
- A verdict tied to a stale source SHA or candidate hash cannot support completion.
- A blocked lane remains blocked even when every independent lane is green.

## `summary.md`

Write a concise handoff:

1. source SDK, target SDK, branch, final checkpoint, and terminal status;
2. one line per app/platform lane with validation, smoke, and full-E2E outcomes;
3. fixed clusters and their verified checkpoint commits;
4. pre-existing failures, flakes, and blocked clusters;
5. evidence and report paths;
6. the exact next action for each blocker.

End with exactly one banner:

- `ORCHESTRATION: COMPLETE`
- `ORCHESTRATION: BLOCKED — <count> REQUIRED SCOPE(S)`
- `ORCHESTRATION: CANCELLED`

## Final state

Keep reports separate from source checkpoints and leave report artifacts
uncommitted. Never change `.gitignore`, push, open a PR, publish, or delete run
artifacts unless the user separately asks.

After the reporting agent returns green, the main orchestrator dispatches a fresh
generic worker to bind the report verdict and terminal banner to state. Only after
that bounded assignment is green does the main orchestrator surface the returned
banner, branch, checkpoint, lane counts, blockers, and paths to `summary.md`,
`report.json`, and `journal.md`.
