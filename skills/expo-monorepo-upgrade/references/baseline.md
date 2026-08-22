# Step: Baseline

Run every contract gate except the full e2e suite (T3) on the current,
unbumped tree, in tier order, and record what it finds. That record is what
keeps a failure that predates the upgrade from being blamed on it, and what
sets every gate's timeout budget.

Dispatch gates per `references/gates.md`. Run the contract's preparation
entries first so the gates have something to run against
(`references/agents/operations.md`); an environment that cannot be readied is
an escalation, never a red baseline.

## What it writes to `state.json`

- **`baseline`** — each gate's result at the coverage keys its verdict carries
  (`references/schemas/ledger.md`). `matrix` stays empty; it starts at Loop 1,
  on the bumped tree.
- **`budgets[gate_id]`** — `{ baseline_s, timeout_s: max(3 × baseline_s, floor) }`,
  where `baseline_s` is the verdict's `duration_s` and `floor` is 120 s at T0,
  900 s above it. The floor keeps a fast gate usable: three times a 0.25-second
  run would time out a healthy gate. A gate that measured nothing — T3, or
  skipped for unproven execution — gets no entry until its first measured run
  sets one. `references/gates.md` enforces every budget from here, including
  the correction a cold post-bump run needs.
- **`flakes`** — a T2 flow that failed and then passed its clean retry
  (`references/e2e.md`); one that fails both attempts is a pre-existing failure.

## Two outcomes

A gate still red here makes the baseline red: escalate with
`options: ["proceed", "abort"]` (`references/orchestration-model.md`), where
`abort` ends the run with the baseline as its final record.

Skipping T3 means a Loop 3 failure can never be shown pre-existing, so the
report says the suite was never baselined rather than blaming the upgrade
(`references/final-report.md`).
