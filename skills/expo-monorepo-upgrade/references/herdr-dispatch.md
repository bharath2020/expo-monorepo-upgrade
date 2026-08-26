# Herdr dispatch

Herdr is the mandatory transport for every child-agent session in a run. It owns
terminal workspaces, panes, and live agent handles; it does not own workflow truth.
Run state, rendered briefs, findings, and verdict files remain authoritative.

Validation, repair, and review workers may use native read-only subagents only to
explore downloaded changelog Markdown explicitly named in their briefs. These
internal helpers receive no Herdr pane, run no repository procedure, mutate
nothing, and return research only to the parent worker. They are not a fallback
when Herdr dispatch is unavailable.

After `state.changelog_references.status` becomes `ready`, start every later child
agent with the recorded absolute changelog download directory as `--add-dir`, even
when that worker's bounded role does not need to inspect it. The common brief tells
the worker when and how it may use the files. Preflight, baseline, bump, the
changelog procedure itself, and every `--test-run` worker omit this argument. A
missing directory or manifest mismatch blocks launch.

Run every shell command below through `rtk`. Read ids from Herdr's JSON responses;
never infer them from labels or terminal layout.

## Availability and caller

Before preflight, require `rtk printenv HERDR_ENV` to return `1`. The main
orchestrator must already occupy a Herdr-managed pane whose initial working
directory is the target repository's direct parent. If not, stop and ask the
launcher to start the run there; do not control another focused Herdr session from
outside Herdr.

Run `rtk herdr status --json` and require `server.running: true` and
`server.compatible: true`. If either is false or the socket cannot be reached,
record the exact result and block. Do not fall back to a native subagent or
non-Herdr transport.

Read the caller identity with:

```bash
rtk herdr pane current --current
```

Record the returned workspace, tab, and pane ids. Rename that pane
`orchestrator — <run-label>` and never move or close it. Split it only to create a
new worker region when no worker pane is active; never split it to add later worker
columns.

## Fixed layout

Create no empty worker placeholders. Whenever a child dispatch begins with an empty
active grid, split the orchestrator pane vertically into equal left and right
regions. The orchestrator remains on the left; the returned pane is the only worker
pane, conceptually the top cell of worker column 1, and starts in the target
repository root:

```bash
rtk herdr pane split --pane <orchestrator-pane-id> --direction right --ratio 0.5 --cwd <absolute-repository-root> --no-focus
```

Record `worker_grid` from active pane ids only. Fill top then bottom before adding
the next column:

```text
worker 1 -> column 1, top
worker 2 -> column 1, bottom
worker 3 -> column 2, top
worker 4 -> column 2, bottom
worker 5 -> column 3, top
...
```

Create only the pane required for the next active worker:

- for a column's bottom cell, split its active top pane downward;
- for a new column's top cell, split the current rightmost top pane to the right;
- when that new column receives its bottom worker, split the current rightmost
  bottom pane to the right.

For example:

```bash
rtk herdr pane split --pane <column-top-pane-id> --direction down --ratio 0.5 --cwd <absolute-repository-root> --no-focus
rtk herdr pane split --pane <rightmost-top-pane-id> --direction right --ratio 0.5 --cwd <absolute-repository-root> --no-focus
rtk herdr pane split --pane <rightmost-bottom-pane-id> --direction right --ratio 0.5 --cwd <absolute-repository-root> --no-focus
```

Run only the command for the next row-first position. With an odd active-worker
count, the final column has only its top worker; never create a blank bottom pane.

After every split, close, or move, inspect
`rtk herdr pane layout --pane <orchestrator-pane-id>` and use
`rtk herdr pane resize` only on worker-region boundaries until worker columns have
equal widths and their top/bottom boundary aligns. Recheck that the outer divider
still leaves the orchestrator and complete worker region at 50% each whenever a
worker is active. With no active worker, the orchestrator is the only visible pane
and `worker_grid` is empty. Never add a third worker row.

## Dispatch one brief

Resolve the profile through
[harness and model selection](harness-and-model-selection.md), then render and
durably record the complete brief before launching anything. Then:

1. Select `next_slot` from the active grid and create exactly that pane using the
   fixed-layout rules: split downward for a missing bottom cell, or split right for
   a new column's top cell. Rebalance a new column only when both cells of the
   current last column are assigned. Label the selected pane with the bounded role
   and scope:

   ```bash
   rtk herdr pane rename <child-pane-id> <plain-language-label>
   ```

2. Start one fresh agent with the resolved harness, exact model, and effort. Use a
   filesystem-safe unique agent id tied to the unit and dispatch attempt. Pass
   harness arguments after Herdr's `--` separator:

   ```bash
   rtk herdr agent start <agent-id> --kind codex --pane <child-pane-id> -- --model <exact-model-id> -c model_reasoning_effort=<effort>
   rtk herdr agent start <agent-id> --kind claude --pane <child-pane-id> -- --model <exact-model-id> --effort <effort>
   ```

   Run only the command matching the recorded harness. Never inherit a user model
   or effort default. For the Codex-backed `changelogs` procedure only, append
   `--search` after the harness separator. After changelog state is `ready`, use the
   matching launch form below for every later child:

   ```bash
   rtk herdr agent start <agent-id> --kind codex --pane <child-pane-id> -- --model <exact-model-id> -c model_reasoning_effort=<effort> --add-dir <absolute-changelog-download-directory>
   rtk herdr agent start <agent-id> --kind claude --pane <child-pane-id> -- --model <exact-model-id> --effort <effort> --add-dir <absolute-changelog-download-directory>
   ```

   Record the exact additional directory in `in_flight`. Codex grants that
   additional directory write access, so the immutable brief and manifest hash
   remain the enforcement boundary: later workers must not modify it. Preserve
   the identical `--add-dir` argument on a transport redispatch.

3. After startup reports interactive readiness, submit only the recorded brief
   path and wait for proof that the turn began:

   ```bash
   rtk herdr agent prompt <agent-id> "Read <absolute-brief-path> and execute it." --wait --until working --timeout 30000
   ```

4. Record grid slot, workspace, pane, agent, harness, model, effort, profile
   selection, additional directories, brief, and verdict identities in
   `in_flight`, then advance `next_slot` in row-first order.
   Wait on that same agent in bounded stretches with
   `rtk herdr agent wait <agent-id> --timeout <ms>`. On a timeout, record a
   heartbeat, confirm liveness with `rtk herdr agent get <agent-id>`, and continue
   waiting; never launch a duplicate because one wait yielded.

5. A settled agent is not success by itself. Read and validate its assigned
   verdict file. Use
   `rtk herdr agent read <agent-id> --source recent-unwrapped --lines 200` only for
   diagnostics when the agent blocks or the verdict is missing or malformed.

The applicable workflow owns task ordering, locks, deadlines, and verdict handling.
This reference owns only the Herdr session lifecycle.

## Completion, compaction, and resume

A worker pane is visible only while its bounded task is active or requires
reconciliation. `idle`, `done`, or `blocked` agent state alone is not completion.
Treat the task as complete only after all of these hold:

1. the agent has settled;
2. its valid verdict or dispatcher result has been reread and accepted;
3. any process, candidate, checkpoint, or checkout ownership has been reconciled;
4. the resulting transition and historical agent/pane identity are durable, and
   the assignment has been removed from `in_flight`.

A valid green, red, or blocked result completes that worker's assignment. A worker
with a missing or malformed result, uncertain process, or unresolved candidate
remains active and visible for recovery.

If agent startup fails before the brief is submitted, record the exact launch
failure, close the newly reserved pane, and compact the grid. Do not leave an empty
launch pane visible or treat it as a completed transport dispatch.

Immediately after completion, verify the recorded pane still belongs to that agent
and run, verify it is not the orchestrator pane, then close it:

```bash
rtk herdr pane get <completed-pane-id>
rtk herdr pane close <completed-pane-id>
```

Record `pane_closed`, remove the id from the active `worker_grid`, and reread the
layout. Do not keep completed panes for transcript inspection: findings, logs,
verdicts, dispatcher results, and historical ids are the durable evidence.

Pack the remaining active panes in stable dispatch order into the row-first
positions shown above. Use `rtk herdr pane move` or `rtk herdr pane swap` when a
close leaves a gap, then resize and verify the two-row alignment and 50/50 outer
split. One remaining worker occupies the complete worker region. Never restart or
close an active agent merely to compact the grid, and never retain or create an
empty placeholder. Do not dispatch another child while a completed pane remains in
the active layout. After the last worker closes, leave only the orchestrator visible
and recreate the 50/50 outer split when the next child is dispatched.

Use explicit recorded ids when moving or swapping an active pane:

```bash
rtk herdr pane move <active-pane-id> --target-pane <target-active-pane-id> --split down --ratio 0.5 --no-focus
rtk herdr pane move <active-pane-id> --target-pane <target-active-pane-id> --split right --ratio 0.5 --no-focus
rtk herdr pane swap --source-pane <active-pane-id> --target-pane <target-active-pane-id>
```

Run only the operation needed for the desired row-first position and reread layout
after each operation.

On resume, use `rtk herdr workspace list` and `rtk herdr agent list`, then match
only the ids already recorded for this run. Rejoin a live recorded agent and keep
waiting or prompt it to continue from its immutable brief. When the recorded agent
is gone, follow the lost-worker reconciliation in
[general prompt rendering](general-prompt-rendering.md) before the one allowed
transport redispatch with the same harness, model, and effort; never redispatch
from Herdr status alone.

Before any resumed dispatch, close every matching pane whose assignment already
meets the completion conditions, compact the remaining active grid, and persist the
new layout. Do not close the orchestrator pane or its workspace from inside the
run. A pane or workspace found by layout or label without the matching recorded id
belongs to another run and must not be changed.
