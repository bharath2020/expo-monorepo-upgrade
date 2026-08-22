# Step: Gates

The mechanics every loop shares for dispatching, timing, and recording a gate.
Load whenever a loop dispatches, re-runs, or waits on one.

## Kinds

A `command` gate goes to a `gate-runner`, a `pipeline` gate to a `monitor`, both
cheap tier; each returns the same verdict shape (`references/schemas/verdict.md`).
A pipeline runs on remote infrastructure, so it never holds up local work —
trigger it and keep fixing while it runs.

## Green and red

One rule decides every gate's `status`, and both runner briefs cite it: a gate is
**red** when its command exits non-zero, or when the gate declares an `expect`
string its captured output does not contain — the check for commands that exit
zero even when they fail. Everything else is **green**: warnings, deprecation
notices, and noisy-but-passing output decide nothing on their own.

A runner that cannot prove a test gate re-executed returns `blocked` rather than
green (`references/worker-briefs.md`). Record that cell `skipped`-class —
`skipped` in `baseline`, held open in `matrix` — never green, and re-run it once
the cache is genuinely cold.

## Coverage

A gate owns the cells the contract check gives it — its `app` × each of its
`platforms`, where `"*"` is one cell meaning the gate has no platform axis
(`references/discovery.md`). Dispatch once per cell and write that one cell from
the returned verdict. Attribution to an app comes only from that app's own gates.

## Cost tiers

A gate's tier comes from the contract section it was declared under, never from judging
its command:

| Tier | Contract section |
| --- | --- |
| T0 | `typecheck`, `lint` — static checks |
| T1 | `build.<platform>`, `test.<name>` — builds and unit/native tests |
| T2 | `smoke` — boot plus core flows |
| T3 | `e2e` — the full suites |

Loops run strictly T0+T1 → T2 → T3; within Loop 1, T1 gates dispatch only once T0 is green (A4).
Baseline runs T0 through T2 and skips T3 (`references/baseline.md`).

## Concurrency

Dispatch gates sharing no `concurrency_groups` label in parallel; gates sharing any label never
run concurrently. Pipeline gates ignore local groups — they run on remote infrastructure anyway.

## Timeouts

Time every dispatch. Which cap the runner holds to depends on whether the gate
has been measured yet:

- **Measured** — run it under `budgets[gate_id].timeout_s`, which baseline wrote
  from that measurement (`references/baseline.md`).
- **Not yet** — every T3 gate, since baseline skips the full suite, plus
  anything recorded `skipped` for unproven execution. Run it under its contract
  `timeout_s` raised to its tier floor; that run sets its budget.

The runner holds whichever cap it is given, whatever its own shell allows
(`references/agents/gate-runner.md`).

One correction, once per gate: a first timeout after the bump, where a warm-tree
baseline can cap healthy work below its cold cost. Double
`budgets[gate_id].timeout_s`, re-run the gate, and open a timeout cluster only
when the wider budget also expires.

## Dispatch and verdict

1. **Dispatch.** Spawn the gate-runner/monitor with the gate id, the cell's app
   and platform keys, the command/pipeline fields and `expect` from its contract entry,
   and the effective `timeout_s`. Write a `dispatched` event
   (`worker, role, task`) and a journal line.
2. **Verdict.** On return, write the `matrix` cell from `status`, emit a
   `verdict` event (`worker, role, gate, app, platform, status`), and a journal
   line. Take the run's `duration_s` from the verdict — baseline turns it into
   the gate's budget (`references/baseline.md`) and the final report into its
   timeline. Hand `red` clusters to `references/fix-loop.md`; `green` needs no
   further action this cell. A T1 build gate going green also writes
   `builds["<app-slug>_<platform>"]` = the commit it ran against, one key per
   concrete app×platform it produced — the map Loop 2 reads before it runs a
   suite (`references/e2e.md`).
