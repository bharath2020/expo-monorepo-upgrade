# Orchestration model

## Roles and tiers

- **Orchestrator (main agent).** Decide only; route every edit, build, log read, and
  code search to a worker. Loop: read ledger → decide the next unit of work → spawn
  one worker → receive verdict → update ledger → decide again.
- **Workers.** Spawn one fresh worker per unit of work; let it own its task end-to-end and
  spawn its own unnamed subagents, whose output dies with its context. Read its verdict only.
  Ten roles, each with its duty, its model tier, and its own contract file:
  `references/worker-briefs.md`'s index and the `references/agents/<role>.md` it names.
- **Worker failure.** Re-dispatch a worker that dies or returns a malformed verdict once, with the
  identical brief; a second failure is that unit's outcome — a spent attempt for a `fix` cluster,
  `red` with an infrastructure cluster for a runner, escalation elsewhere. Two exceptions: a worker
  that returned early with its work still running is resumed, since a second dispatch starts a
  second build against the same tree; and a worker interrupted but alive — idle, no verdict file,
  context intact — is rejoined with a continue prompt naming its brief, which restores its half-done
  work and its reasoning both. After a restart, decide died-versus-running on evidence — no live
  process for that command, no findings file, and artifact mtimes still from the previous phase together
  mean it died — and write a `worker_lost` event (`references/schemas/ledger.md`) first.

## Dispatch backend

Every dispatch has one shape whatever executes it: spawn the worker with its brief path, model
tier, and resource group → await completion → read the verdict file the brief names. Brief and
verdict are files on disk, so a backend swap changes who runs a worker, never what it is told.

A brief carries only the dynamic delta: the role file's path, this task's values, the paths it
reads and writes, its budget. Static content — role contracts, principles, decisions,
guides — is passed as a path the worker reads for itself; the return is the verdict JSON alone.

Select once per run, in order: the `herdr` backend when its server is running; else the
harness's own subagents. Record the winner
in `state.json.backend` with a `backend_selected` event and its journal line, and reconcile a
resume against it first. `references/dispatch-backends.md` holds the mechanics.

Under the `herdr` backend the orchestrator itself runs as a herdr agent in the run workspace's
first pane, visible beside its workers, started there by whoever launches the run. It never ends a
turn with a worker in flight — a stopped orchestrator pane is a stalled run — but waits inside the turn.

## Bounded read-only exception

Setup (SKILL.md step 1) runs five read-only checks in the orchestrator itself — the root
`expo-upgrade.yaml`, the tree, the `expo-upgrade` skill, the current SDK, and resume detection's
`reports/` scan, enumerated in `references/setup.md` — since no run directory or worker scope holds
them yet, and the contract read must precede the first worker it briefs. Those five and no
others: from the first dispatch onward A2 binds absolutely.

## Phase map

The ledger's `phase` enum (`references/schemas/ledger.md`) carries one value per SKILL.md step;
step 1 predates the ledger and owns none. Use these names everywhere. Steps 2–4 are `discovery`,
`baseline`, `bump`; steps 5–7 are `loop1`, `loop2`, `loop3`; step 8 is `final-verify`, then
`report`, then the terminal `complete`. Setup's scope check may go straight to the terminal
`declined` (`references/setup.md`) instead, before any phase opens.

Every step opens its phase with a `phase_started` event and closes it with `phase_closed`, each
with its journal line — the previous phase closing as the next one opens. No step file repeats
this; a loop's phase opens at its first gate dispatch and closes after the reviewer audit
(`references/gates.md`, `references/fix-loop.md`).

A closed phase is also a clean handoff point, taken as routine rather than as recovery: the ledger
holds the whole run, so a fresh context resumes from it exactly as an interrupted run does
(`references/schemas/ledger.md`'s resume procedure) — under `herdr`, in the same pane: end the
orchestrator agent, start a new one, resume. The ledger outlives the run; a context only needs to last its phase.

## Write planes

- **Data plane (workers write facts).** Logs, artifacts, and one findings file per worker —
  `reports/<run-id>/clusters/<fingerprint>/attempt-N/findings.md` for a worker that
  diagnosed or fixed a cluster, else `reports/<run-id>/workers/<worker-id>/findings.md`.
  Rich detail never passes through the orchestrator; the verdict carries a summary and that path.
- **Control plane (orchestrator alone writes).** `state.json`, `events.jsonl`, and `journal.md`.
  A worker cannot mark itself green; state transitions need the whole-matrix view only it holds.
- **Journal and analyst routing.** Every event earns one plain-English sentence that explains its terms in
  `journal.md`, written in lockstep with `events.jsonl`. A verdict raising a question the ledger
  cannot answer earns an `analyst` worker with one question; act on its answer, never raw evidence.

## Escalation and decision routing

- **Triggers:** product-relevant ambiguity, a fix needing a policy-forbidden action, attempt-cap
  exhaustion, a red baseline, budget overrun.
- **Question shape:** a `blocked` verdict already carries it — raise its `summary` as the
  context, its `options` verbatim, and its `recommendation` as the default
  (`references/schemas/verdict.md`). An escalation the orchestrator raises on its own — a red
  baseline, a budget overrun — takes that same shape.
- **Scope:** a lane is one independent line of work — an app × platform in a loop, or a
  single role's path like bump. Only the affected lane pauses; the rest keep running.
- **Recording:** write `escalated` (`question_id, question`) as the question is raised and
  `answered` (`question_id, answer`) as it lands, each with its journal line; open questions sit
  in `state.json.open_questions`, and an unanswered question stops its lane, never the run.
- **Durability:** answers append to the ledger's `decisions`, and every worker brief
  carries `state.json.decisions` verbatim, so they survive resume and no worker
  re-asks a settled question.
