# Dispatch backends

Per-backend mechanics for the one dispatch contract in
`references/orchestration-model.md`: spawn(brief path, model tier, resource group) →
await completion → read the verdict file. Load at the first dispatch of a run, once
the backend is chosen and written to `state.json.backend`.

## Shared contract

Write the brief to `reports/<run-id>/workers/<worker-id>/brief.md` before spawning,
and name in it the verdict path the worker writes on completion: the gate's own
artifact directory for a `gate-runner` or `monitor` (`references/schemas/verdict.md`),
`reports/<run-id>/workers/<worker-id>/verdict.json` for every other role. A worker
that finishes without that file counts as a malformed verdict
(`references/orchestration-model.md`). `worker-id` is the id the `dispatched` event
carries; keep it to lowercase letters, digits, and hyphens so it doubles as a path
segment and a herdr agent name.

## `herdr` backend

Chosen when its server is running. Test that with
`herdr status --json` and match `.server.status`; bare `herdr status` prints
`key: value` text rather than JSON. Every other command returns JSON on stdout —
read ids from the response, never from a guess. Errors are JSON on stderr with
exit 1, carrying `.error.code` (`agent_not_found` among them); syntax errors exit 2.

**Orchestrator in a pane.** Under this backend the orchestrator runs as a herdr agent in the run
workspace's first pane, started there by whoever launches the run
(`references/orchestration-model.md`). That launcher arms the watchdog at launch, one
backgrounded line from the repo root: `skills/expo-monorepo-upgrade/scripts/orchestrator-watchdog.sh
<agent-id> <pane-id> reports/<run-id>/summary.md reports/<run-id>/report.html &`. It types a resume
into the pane whenever the orchestrator sits idle mid-run with no completion marker — which is
what a dropped turn leaves behind, and nothing else wakes a sleeping pane — capped at six resumes, and exits on
the first marker. An orchestrator that receives one journals the auto-resume before continuing, so
the run's record carries the gap instead of hiding it.

1. **Workspace per run — adopt, or create.** Once, at the first dispatch. An orchestrator already
   running in a pane is already in the run's workspace: read it with `herdr pane current`, take
   `.result.pane.workspace_id` and `.result.pane.pane_id`, and record both as the dispatch records.
   Creating a second workspace from inside one strands every worker away from the pane the human
   is watching. Only an orchestrator launched outside herdr creates the workspace: `herdr
   workspace create --label <run-id> --cwd <repo root> --no-focus`, reading
   `.result.workspace.workspace_id` and `.result.root_pane.pane_id`.
2. **Pane per worker.** `herdr pane split --pane <pane-id> --direction right|down --cwd <repo
   root> --no-focus`, splitting a wide pane right and a tall one down. Read the new pane from
   `.result.pane.pane_id`.
3. **Name the pane before dispatching into it.** `herdr pane rename <pane-id> "<role> —
   <subject>"` in plain words — `discovery — map repo`, `gate-runner — ios build, storefront` —
   and the orchestrator's own pane `orchestrator — <run label>`. Naming precedes the agent, so
   the workspace reads at a glance from the first moment it holds work.
4. **Agent per pane.** `herdr agent start <worker-id> --kind claude --pane <pane-id> -- --model
   <tier-model> --permission-mode bypassPermissions`. Arguments after `--` go to the agent
   itself. `<tier-model>` comes from the role file's `tier:` line
   (`references/worker-briefs.md`), resolved through this skill's defaults: `haiku` for
   `cheap`, `sonnet` for `capable`, `opus` for `top`. A phase's two `reviewer` dispatches both
   run at `top`, never below the fix worker they audit (A12); give them two different top-tier
   models where the backend carries more than one, and otherwise dispatch them separately with
   no shared context, so each reads the diff cold.
   Passing the flag is what enforces A11's tiering here: without it every worker inherits the
   launching session's model. `--permission-mode bypassPermissions` is the mode this skill
   starts workers under. `agent start`
   needs a pane already at its shell prompt and returns once herdr sees the agent ready for
   input, under a 30 s startup timeout `--timeout <ms>` widens to at most 300000.
5. **Brief submission.** Prompt only an agent herdr reports ready — `agent start` returned, or
   `herdr agent list` shows `interactive_ready: true` for it — then `herdr agent prompt
   <worker-id> "Read <brief path> and execute it." --wait --until working --timeout 30000`. The
   prompt carries the brief's path, so the brief itself never passes through a terminal, and `--until
   working` settles the one question this step asks: did the turn start. Keep that `--timeout`
   above 5000 ms, the window in which a submission that never landed reports
   `agent_prompt_stalled` instead of a bare timeout. Confirm submission by reading the pane —
   `herdr agent read <worker-id> --source visible --lines 40`: a prompt that reported success
   while the input box still holds text and no turn began was dropped, so send it again. A stuck
   queue drains with `herdr agent send-keys <worker-id> esc` then `herdr agent send-keys
   <worker-id> enter`; read the pane again to confirm the drain before re-sending.
6. **Waiting.** The orchestrator never ends its turn with a worker in flight — nothing wakes a
   sleeping pane orchestrator, so an ended turn is a stalled run. Block in-turn instead: `herdr
   agent wait <worker-id> --timeout <ms>`, settling on `idle`, `done`, or `blocked`, in bounded
   stretches under your own command cap, re-issued each stretch until the work settles or the
   dispatch budget expires. That budget is the gate's own (`references/gates.md`) for a
   `gate-runner` or `monitor`, and for every other role the dispatch timeout — 600 s, with discovery
   at 2400 s for its per-app verification.
7. **Heartbeat and liveness, once per stretch.** Between stretches append one journal line —
   `heartbeat — waiting on <worker>, <X>m elapsed` — and stamp `state.json.last_heartbeat`
   (`references/schemas/ledger.md`), so a human tailing the journal tells a working run from a
   stalled one. Poll the worker's existence in the same stretch: `agent wait` blocks against a
   registry entry, so a worker herdr has lost never settles it. `herdr agent get <worker-id>`
   erroring `agent_not_found` ends the wait and routes to the worker-failure rule's evidence test
   (`references/orchestration-model.md`).
8. **Read the verdict.** On `blocked`, read the pane with `herdr agent read <worker-id> --source
   recent-unwrapped --lines 200` and decide from what it shows. Then read the verdict file — that
   file, not the pane text, is the verdict. A settled agent whose verdict file is absent has not
   finished: alive, it is rejoined per the worker-failure rule; gone, it takes that rule's
   evidence test.
9. **Pane hygiene.** Close a green worker's pane with `herdr pane close <pane-id>` once its
   verdict is read. Leave a `red` or `blocked` worker's pane open, so its terminal is there to
   inspect. Close the run's
   workspace (`herdr workspace close <workspace-id>`) only at the report step, after every pane
   worth reading is read. Teardown reaches exactly the pane and workspace ids this run's ledger
   records — a workspace found by listing belongs to another run and stays open.

**Resume.** Before re-dispatching anything, run `herdr agent list` and keep the
entries whose `workspace_id` matches the run's workspace. An agent still present for
a worker the ledger shows in flight is that worker, alive: rejoin it rather than
starting a second one — at step 6 while it reads `working`, and with a continue
prompt naming its brief path when it sits `idle` holding no verdict file, which is
where an interruption leaves a worker whose context is still intact. `agent_status`
reads `working`, `idle`, `done`, `blocked`, or `unknown` — `unknown` means herdr
cannot classify the pane, never that the work finished. A worker with no live agent
gets the died-versus-running evidence test in `references/orchestration-model.md`.

**Outage.** A transient API outage stalls every pane at once, the orchestrator's
included, and leaves each worker idle mid-task with its context intact. Read a
whole-workspace stall as that one event: resume every worker from the evidence on
disk per the Resume rule above, and re-dispatch nothing.

**Vanished workspace.** A workspace closed from outside this run takes its panes and
agents with it. Recreate it once with step 1's create command, reconcile survivors with
`herdr agent list`, journal the event, and continue. A second disappearance is an
escalation (`references/orchestration-model.md`), never a third workspace.

**Naming.** herdr agent names match `[a-z][a-z0-9_-]{0,31}` and must be unique among
live agents, so a re-dispatched worker takes a fresh id (`fv-ios-lane-2`) rather than
reusing the dead one's. Pane labels carry no such rule — they are step 3's plain words.

## `harness` backend

Chosen when no `herdr` server is running and the policy declares nothing: spawn the
worker as the harness's own subagent, passing the brief as its task and the model
tier as its model. The harness returns the worker's final message; read the verdict
from the verdict file all the same, so both backends record verdicts identically.

- **Bounded polling.** A dispatch that waits on a long build polls for its own completion
  in bounded waits inside the turn that started it, never handing the wait to a background
  notification — the poll and the verdict belong to one turn
  (`references/agents/gate-runner.md`) — under step 6's dispatch budget.
- **Resume, not re-dispatch.** A worker that returned early with its work still
  running is resumed on the evidence test in `references/orchestration-model.md`; a
  second dispatch would start a second build against the same tree.
- **Naming.** Name spawned agents where the harness allows it. Some harnesses refuse
  a name from an agent that is itself a subagent; those workers run unnamed and stay
  addressable by the id in their `dispatched` event.
