# Operating principles

Apply Set A as the orchestrator. Inject Set B verbatim into every brief for a
worker that changes the repo (bump, fix).

## Set A — orchestration principles

- **A1. Decide from verdicts.** The orchestrator reads verdicts and the ledger; workers read logs and code.
- **A2. Delegate every action.** Each unit of work gets a fresh worker with a complete brief; setup's five read-only preflight checks are the one bounded exception (`references/orchestration-model.md`).
- **A3. Write facts where they happen.** The agent that learns something writes it to disk at that moment; the orchestrator writes interpretations to the ledger.
- **A4. Validate cheapest-first.** Order gates cheap→expensive; prove a fix with the narrowest check, then the loop's authoritative re-run.
- **A5. Commit validated progress.** Each fixed, validated cluster earns a commit; the branch always sits at its best-known state.
- **A6. Preserve the gates.** Green means the gate passed as-found; changing a gate to pass is an escalation, always.
- **A7. Validate fresh artifacts.** A gate's verdict binds only to the commit it ran against; rebuild before re-running a gate whose artifact is stale.
- **A8. Bound every loop.** Every retry has a cap, every wait a timeout, and both an escalation path.
- **A9. Continue what's independent.** A blocked lane pauses alone; all other work proceeds.
- **A10. Honor the repo contract, then the human.** The repo contract overrides skill defaults; recorded decisions override both for the run.
- **A11. Speak plainly, spend wisely.** Human-facing updates are complete sentences that explain their terms; worker capability matches task difficulty — cheap models run commands, capable models reason, and the top tier is reserved for changing code and auditing that change.
- **A12. Audit every mutation independently.** A phase that changed the repo closes only when two `reviewer` workers and one `principles-auditor` all come back green, none of them weaker than the worker whose code they read; any red reopens the work as a cluster.

## Set B — fix principles

- **B1. Preserve behavior.** A fix makes the app work identically under the new SDK; any observable behavior change is an escalation, always.
- **B2. Diagnose before editing.** State the root cause in the findings file first; then change code.
- **B3. Reproduce before fixing.** Rerun a failed e2e/smoke flow once in a clean environment before dispatching any fix.
- **B4. Name the layer.** Classify an e2e failure as app regression, expectation change, or environment in the findings file before changing anything.
- **B5. Keep tests honest.** Update a test or flow only when the SDK genuinely changed the expected behavior, and record why in the findings file. Skipping or deleting a test is an escalation.
- **B6. Make the minimal change.** Ship the smallest diff that fixes the cluster; leave refactors and "while I'm here" edits behind.
- **B7. Align versions, don't patch around them.** Take each dependency's SDK-aligned release; diverge from the grid only with a recorded decision.
- **B8. Climb the hoisting ladder in order.** Lockfile refresh → `resolutions` → metro config → `nohoist`; record the rung that worked.
- **B9. Follow the house style.** Match the repo's conventions and every recorded decision in every edit.
- **B10. Prove it, then commit.** Validate with the narrowest check that proves the fix, escalating at most to the feature covering the entire cluster; full suites are gates, never fix-validation. Commit only after the check passes.
- **B11. Leave a trail.** Every findings file reads as a letter to the next upgrade: cause, change, validation.
- **B12. Stop at the policy line.** When the only remaining fix requires an escalation-listed action, stop with a recommendation and spend zero further attempts.

## Instruction style

Write every brief as precise, affirmative, token-lean commands: state what to do, in
order, with inputs as paths. Frame prohibitions as routing rules — escalate before
skipping a test, editing a validation command, or pinning a fork.
