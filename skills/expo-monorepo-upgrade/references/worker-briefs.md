# Worker briefs — shared conventions

One role file per dispatch, under `references/agents/`. Fill its bracketed
fields; the result is the worker's entire task — it has no other context. Log
every dispatch as a `dispatched` event (`references/orchestration-model.md`)
before it starts.

## Role index

Each file opens with a `tier:` line naming its model tier — `cheap` for
mechanical work, `capable` for reasoning, `top` for the two hardest jobs in the
run: changing code under the principles, and auditing that change. The backend
reads that line to pick the worker's model (`references/dispatch-backends.md`).

| Role | File | Duty | Tier |
| --- | --- | --- | --- |
| `gate-runner` | `references/agents/gate-runner.md` | Run a command gate, capture output, cluster failures | cheap |
| `monitor` | `references/agents/monitor.md` | Trigger/poll pipeline gates, download logs, cluster failures | cheap |
| `operations` | `references/agents/operations.md` | Run one contract preparation entry to ready the tree, machine, or device | cheap |
| `report` | `references/agents/report.md` | Assemble the final report, learnings doc, and their commit | cheap |
| `discovery` | `references/agents/discovery.md` | Check the contract is complete, resolve the target | capable |
| `bump` | `references/agents/bump.md` | Cut the upgrade branch and perform the mechanical version bump | capable |
| `fix` | `references/agents/fix.md` | Diagnose, fix, validate, and write findings for one cluster | top |
| `analyst` | `references/agents/analyst.md` | Answer one specific orchestrator question from findings/evidence | capable |
| `reviewer` | `references/agents/reviewer.md` | Audit a mutating phase's commits against the repo's conventions and the recorded decisions — two independent dispatches per close | top |
| `principles-auditor` | `references/agents/principles-auditor.md` | Judge those same commits against Set A and Set B, one principle at a time | top |

## Path convention

Any path segment derived from a gate id, app name, or platform key is that
value's filesystem-safe slug: lowercase, `@` dropped, `:` `/` and other
separators become `-` (`build:ios` → `build-ios`, `@acme/storefront` →
`acme-storefront`). A coverage key of `"*"` becomes the segment `all`. Apply
this in every output path a role file names.

## Verdict discipline

Returning `blocked` means a human now has to choose, so carry the whole question back:
`summary` for what you tried and what stopped you, `options` for the concrete actions that
would unblock it, and `recommendation` for the one you would take
(`references/schemas/verdict.md`). A `blocked` verdict without them costs the human a round
trip to ask what you already knew.

Return the verdict JSON alone, and write the detail to the findings path
`references/orchestration-model.md` assigns the role — the cluster findings file for a
worker that diagnosed or fixed a cluster,
`reports/<run-id>/workers/<worker-id>/findings.md` for every other worker. Prose
returned beside the JSON violates the brief; the loop-close reviewer flags it
(`references/agents/reviewer.md`).

## Naming

Name spawned agents where the harness allows it and dispatch them unnamed
otherwise — a harness may refuse a name from an agent that is itself a subagent,
and the identical brief runs either way, so no step depends on a name. An
unnamed worker stays addressable by the id its `dispatched` event records.

## Re-execution proof

A role running a test gate proves the run actually happened: clear the gate's
own results directory before starting, then read the runner's task output for
`UP-TO-DATE`, `cached`, or `skipped` on the test task. A pass with no proof of
execution is `skipped`-class, never green — report it `blocked` with the
runner's own line quoted in your findings.
