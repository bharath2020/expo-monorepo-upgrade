# Change review workflow

Review is a repair-success gate, not a general stage. Do not review a bump. Do not
dispatch reviews when a repair verdict is red, blocked, malformed, missing, or
still running.

After a repair agent returns a valid green verdict with an immutable uncommitted
candidate, its single-cluster dispatcher concurrently dispatches exactly two fresh
general workers with independent assignments:

- `audit.code-review`
- `audit.code-change-principles`

The workers are blind to one another's output. Code review checks correctness,
scope, regressions, and evidence. The principles review applies
[code-change principles](../principles/code-changes.md).

Resolve both review profiles through
[harness and model selection](../harness-and-model-selection.md). Bind selection to
the repair candidate's recorded author harness: code review uses the opposite model
family when Claude is eligible, while the principles review uses the complementary
profile from the policy. If Claude is ineligible, record the degraded all-Codex
review selection rather than raising reasoning effort.

For either assignment, fill this skill-defined base task with immutable values:

```markdown
# Review one successful repair candidate

- Review kind: <code-review|code-change-principles>
- Run: <run-id>
- Cluster dispatcher: <dispatcher-id>
- Cluster: <cluster-id>
- Original repair unit: <unit-id>
- Original procedure: <procedure-ref>
- Starting checkpoint: <source-sha>
- Candidate snapshot: <immutable-candidate-directory>
- Candidate diff SHA-256: <sha256>
- Candidate author harness: <codex-or-claude>
- Candidate author model: <exact-model-id>
- Candidate author effort: <effort>
- Original rendered prompt: <path>
- Change findings: <path>
- Repair success verdict: <path>
- Validation evidence: <paths>
- Recorded decisions: <applicable-decisions-or-none>

Review this exact candidate independently and write only the assigned verdict. Do
not use the other reviewer's output.
```

## Appended stage prompt

Pass the completed base task through
[general prompt rendering](../general-prompt-rendering.md), then append:

```markdown
Read only the supplied immutable candidate diff, rendered change prompt, findings,
validation evidence, and recorded decisions. Verify its SHA-256 before review. Do
not edit files, change Git state, run a repository procedure, or commit. Perform
only the assigned code or code-change-principles review. Write each required change
as a scope-local review comment with exact diff evidence; otherwise return green.

Write `findings.md` with these exact sections:

1. `Candidate binding` — review kind, Source SHA, candidate diff SHA-256, app
   scope, procedure, and cluster.
2. `Review performed` — checks applied and evidence inspected.
3. `Required changes` — every scope-local comment with exact diff evidence, or
   `none`.
4. `Result` — green when no change is required; red with the complete required
   change set; or blocked with the exact missing proof and safe next action.

Then write `verdict.json` in the supplied verdict shape. On red, put every required
change in `clusters`; otherwise keep `clusters` empty. Match candidate hash, status,
evidence, and blocker to `findings.md`, then return that JSON alone.
```

Both verdicts must be green for the same candidate hash.

This file defines only the two review assignments and their verdict boundary. The
[cluster dispatcher](../agents/cluster-dispatcher.md) exclusively decides how red
or green review results affect repair iteration, candidate invalidation,
authoritative validation, and its one-cluster result. Reviewer success never
creates a checkpoint.
