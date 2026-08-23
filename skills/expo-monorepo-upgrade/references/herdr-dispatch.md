# Herdr dispatch

Herdr is the mandatory transport for every child-agent session in a run. It owns
terminal workspaces, panes, and live agent handles; it does not own workflow truth.
Run state, rendered briefs, findings, and verdict files remain authoritative.

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
record the exact result and block. Do not fall back to a native subagent or another
harness.

Read the caller identity with:

```bash
rtk herdr pane current --current
```

Record the returned workspace, tab, and pane ids. Rename that pane
`orchestrator — <run-label>` and never split, move, resize, or close it after the
outer layout is established.

## Fixed layout

Before the first child dispatch, split the orchestrator pane vertically into equal
left and right regions. The orchestrator remains on the left; the returned pane is
the top cell of worker column 1 and starts in the target repository root:

```bash
rtk herdr pane split --pane <orchestrator-pane-id> --direction right --ratio 0.5 --cwd <absolute-repository-root> --no-focus
```

Split that worker pane downward into equal top and bottom cells:

```bash
rtk herdr pane split --pane <worker-column-1-top-id> --direction down --ratio 0.5 --cwd <absolute-repository-root> --no-focus
```

Record `worker_grid` as ordered columns of `{top_pane_id, bottom_pane_id}` plus
`next_slot`. Fill top then bottom before adding another column:

```text
worker 1 -> column 1, top
worker 2 -> column 1, bottom
worker 3 -> column 2, top
worker 4 -> column 2, bottom
worker 5 -> column 3, top
...
```

To add a column, split both cells of the current rightmost column to the right with
the same ratio and repository-root cwd. The two returned panes form the next
column:

```bash
rtk herdr pane split --pane <rightmost-top-pane-id> --direction right --ratio 0.5 --cwd <absolute-repository-root> --no-focus
rtk herdr pane split --pane <rightmost-bottom-pane-id> --direction right --ratio 0.5 --cwd <absolute-repository-root> --no-focus
```

Inspect `rtk herdr pane layout --pane <orchestrator-pane-id>` and use
`rtk herdr pane resize` only on worker-region boundaries until worker columns have
equal widths and their top/bottom boundary aligns. Recheck that the outer divider
still leaves the orchestrator and complete worker region at 50% each. Never add a
third worker row.

## Dispatch one brief

Render and durably record the complete brief before launching anything. Then:

1. Select `next_slot` from the recorded grid, creating and rebalancing a new column
   first only when both cells of the current last column are already assigned.
   Label the selected pane with the bounded role and scope:

   ```bash
   rtk herdr pane rename <child-pane-id> <plain-language-label>
   ```

2. Start one fresh Codex agent in that pane. Use a filesystem-safe unique agent id
   tied to the unit and dispatch attempt:

   ```bash
   rtk herdr agent start <agent-id> --kind codex --pane <child-pane-id>
   ```

3. After startup reports interactive readiness, submit only the recorded brief
   path and wait for proof that the turn began:

   ```bash
   rtk herdr agent prompt <agent-id> "Read <absolute-brief-path> and execute it." --wait --until working --timeout 30000
   ```

4. Record grid slot, workspace, pane, agent, brief, and verdict identities in
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

## Resume and retention

On resume, use `rtk herdr workspace list` and `rtk herdr agent list`, then match
only the ids already recorded for this run. Rejoin a live recorded agent and keep
waiting or prompt it to continue from its immutable brief. When the recorded agent
is gone, follow the lost-worker reconciliation in
[general prompt rendering](general-prompt-rendering.md) before the one allowed
transport redispatch; never redispatch from Herdr status alone.

Retain the complete worker grid through reporting, including green, red, and
blocked agents, so the two-row layout and terminal evidence remain inspectable.
Do not reuse an occupied slot for a fresh worker and do not close the orchestrator
pane or its workspace from inside the run. After reporting, close child panes only
when the user asks; a pane or workspace found by layout or label without the
matching recorded id belongs to another run.
