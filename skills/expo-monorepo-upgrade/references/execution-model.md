# Execution model

The main orchestrator is a decision maker and dispatcher. It selects procedures,
scopes, workers, and next transitions from the immutable contract snapshot and
durable results. It never changes repository code, runs repository procedures,
reviews candidates, manages Git, writes reports, or mutates control-plane state.

```text
main orchestrator
  -> generic workers for bounded control-plane tasks
  -> procedure agent
  -> top-of-queue cluster dispatcher orchestrator
       -> repair agent
       -> two general review agents, only after repair success
       -> authoritative validation agent
  -> general checkpoint agent
  -> general reporting agent
```

Each validation, smoke, or full-E2E agent runs exactly one procedure for one app;
a platform procedure is further limited to one platform in that app. It may
return multiple clusters, but never clusters from another app. The main
orchestrator dispatches a
fresh generic worker to record the complete set and return the ordered app queue,
then dispatches that queue unchanged to a fresh
[cluster dispatcher](agents/cluster-dispatcher.md). The dispatcher selects the
cluster at the top and orchestrates only that repair lifecycle.

## Roles

- **Main orchestrator:** decides stage ordering and the next bounded dispatch from
  durable results. It does not inspect repository source, execute work, review,
  manage Git, write reports, mutate control-plane state, or choose a cluster from
  an ordered queue.
- **Cluster dispatcher:** a nested orchestrator that selects the supplied queue's
  head, decides that cluster's repair loop, and dispatches its repair, review, and
  authoritative validation agents. It performs no repository task and handles no
  second cluster.
- **Generic worker:** a fresh agent either orchestrator may dispatch for a bounded
  mechanical task such as recording state, reconciling a queue, or rendering a
  prompt. There is no fixed generic-worker subtype or operation catalog: the brief
  supplies exact inputs, allowed paths, and expected outputs. A generic worker
  makes no workflow decision and never exceeds that assignment.
- **Procedure agent:** executes one YAML-backed bump, validation, repair, smoke, or
  full-E2E prompt and returns evidence plus a verdict.
- **General review agent:** performs exactly one assigned read-only code review or
  code-change-principles review. These two agents run only after a repair agent
  reports green.
- **General checkpoint agent:** mechanically verifies an accepted bump or repair
  candidate, stages only its declared files, creates one commit, verifies it, and
  returns a verdict. It never edits candidate content.
- **General reporting agent:** renders report artifacts only from accepted durable
  state and evidence. It never edits source, changes Git, or closes state itself.

Every executable procedure, review, checkpoint, state mutation, report, and
evidence-producing recovery check uses a fresh bounded agent. Each cluster
dispatcher is also fresh for one queue head. Worker `idle` or process exit is not
success; require its valid verdict or dispatcher result file.

## Units and attempts

Normalize each procedure and skill-defined task into a scope-qualified unit. A
unit records its procedure reference, app path, platform, stage, source SHA,
prompt hashes, attempt counters, evidence paths, and status.

- A **procedure attempt** is one substantive execution result.
- A **transport dispatch** repeats the identical task after a lost worker or
  response. It does not spend a repair attempt.
- One cluster permits at most three repair-agent attempts. Each repair agent
  dispatched for initial repair, review correction, or a still-present target
  consumes one attempt.
- One identical transport redispatch is allowed per procedure attempt.

## Scheduling and locks

Maximize safe read-only concurrency while enforcing:

- `repo-write`: every bump, repair, or checkpoint agent; globally exclusive with
  other execution locks while active. Exactly one repository writer runs at a
  time.
- `app:<path>`: app validation. The root path `.` conflicts with every app lock.
- `app:<path>` plus `platform:<name>`: platform validation, smoke, and full E2E.
- `repair-candidate:<cluster>`: reserves one uncommitted candidate and blocks every
  unrelated writer. Only the two reviews and authoritative rerun bound to that
  candidate hash may run while it exists.
- `review:<candidate-hash>`: the two general review agents may run concurrently,
  but only after the repair agent has stopped with a green verdict.
- `cluster:<app-path>`: at most one active cluster dispatcher for that app. The
  next dispatcher receives the reconciled queue only after the current one
  finishes; it must select the queue head.

If actual procedure behavior reveals shared devices, caches, build directories,
or remote environments, the main orchestrator decides the stricter lock and
dispatches a generic worker to record it for the rest of the run.

## Candidate and checkpoint gates

### Bump

The bump agent leaves a green repository-wide candidate uncommitted. No code
review or code-change-principles review runs. The main orchestrator dispatches a
general checkpoint agent only after the bump verdict and candidate identity are
valid, then dispatches a generic worker to record the verified commit. It becomes
the first checkpoint only after that bounded state assignment is green.

### Repair

A green repair agent leaves one uncommitted candidate whose identity covers the
tracked patch plus the manifest and content of candidate-owned untracked files.

The [cluster dispatcher](agents/cluster-dispatcher.md) exclusively owns the repair,
review, correction, and authoritative-rerun lifecycle. It returns one
`ready_for_checkpoint`, `blocked`, or `cancelled` result for the supplied queue
head. On `ready_for_checkpoint`, the main orchestrator dispatches a general
checkpoint agent. After a green checkpoint verdict, it dispatches a fresh generic
worker to record the checkpoint, advance `checkpoint_sha`, and return the revised
queue after reconciliation. A non-empty revised queue is sent unchanged to a
fresh cluster dispatcher.

Other same-app fingerprints may remain. Never combine clusters in a repair
checkpoint.

## Evidence freshness and terminal states

Bind every observation to source SHA, candidate hash when present, app, and
platform. A later checkpoint stales any evidence its diff touches or may affect.
Rerun stale evidence through its original YAML procedure; never infer green.

A blocked app/platform lane does not stop independent lanes. A failed bump,
changed contract, dirty or mismatched shared checkout, or unsafe reconciliation is
repository-wide.

- `complete`: every configured required unit is green, stale evidence was
  refreshed, all reviews are green, and reports exist.
- `blocked`: at least one required scope cannot continue, the bump failed, an
  attempt cap was exhausted, or safe reconciliation is impossible.
- `cancelled`: the user explicitly stopped the run; preserve state and evidence.

During long work, surface the stage, active scopes, completed/total units, current
checkpoint, and blockers from [run state](run-state.md), not conversation memory.
