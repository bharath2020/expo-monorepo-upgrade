# Top-of-queue cluster dispatcher orchestrator

The main orchestrator dispatches a fresh cluster dispatcher with one app's ordered
repair queue. The dispatcher is a nested orchestrator, not a repair worker. It
selects exactly the cluster at the top of that queue, handles that one repair
lifecycle, and ends after the cluster is fixed or blocked.

Both orchestrators are control-plane roles. They make decisions from durable
results and dispatch agents. They never inspect or change repository code, run a
repository procedure, review a candidate, stage files, or commit.

## Inputs

The main orchestrator supplies:

- one dispatcher id and one literal app path;
- one ordered queue containing only that app's eligible repair clusters, including
  each cluster's platform, fingerprint, summary, and failure evidence;
- the matching repair procedure reference, the complete original validation,
  smoke, or full-E2E procedure reference that discovered it, and their owning
  workflow stage-prompt references;
- the current checkpoint and exact attempt budget;
- immutable prompt, candidate, review, verdict, evidence, and state paths;
- the immutable harness/model policy, current capability evidence, and candidate
  author profile when one exists;
- applicable locks and recorded decisions, including the input-state identity.

Reject the dispatch if the queue is empty, contains another app, or its head lacks
a matching repair procedure. Select the head cluster exactly as ordered. Never
skip it, reorder the queue, or choose by failure prose or perceived severity. The
dispatcher controls the supplied queue only long enough to select and orchestrate
its head cluster. It returns decision transitions and result paths for that
cluster. Either orchestrator may dispatch a fresh generic worker for any bounded
run-state mutation it needs; the dispatcher itself remains a decision role.

## One-cluster repair loop

1. Record the queue head as this dispatcher's selected cluster. Resolve the repair
   profile for its substantive attempt number through
   [harness and model selection](../harness-and-model-selection.md), then dispatch
   one repair agent with the matching `repair_validation` or
   `repair_smoke_e2e` procedure and the repair stage prompt from its owning
   workflow.
2. While the repair is running, or when its verdict is red, blocked, malformed, or
   missing, do not dispatch either reviewer. On a retryable red result, decide
   whether the attempt budget permits another repair agent. Otherwise return the
   cluster blocked to the main orchestrator.
3. Only after the repair agent returns a valid green verdict with an uncommitted
   candidate, dispatch exactly two fresh general workers concurrently:
   `audit.code-review` and `audit.code-change-principles`.
   Select their profiles from the candidate author's model family so code review
   uses the opposite family when Claude is eligible. Render both through the stage prompt in
   [change review](../workflow/audit.md).
4. If either reviewer returns required changes, collect both verdicts and dispatch
   a new repair-agent iteration for this same cluster with all review feedback.
   Any changed candidate invalidates both reviews. Wait for that repair agent to
   report green before dispatching two new review workers.
5. When both reviews are green for the same candidate hash, dispatch a validation
   agent to rerun the complete original validation, smoke, or full-E2E procedure
   against that exact candidate with its owning workflow's observation prompt.
6. If the target fingerprint remains, dispatch another repair agent when the
   attempt budget permits. If the target is absent, return `ready_for_checkpoint`
   with the candidate, both review verdicts, authoritative verdict, and complete
   same-scope cluster set, including all evidence paths. Do not stage or commit.

The main orchestrator then decides whether to dispatch a general checkpoint
worker. After a verified checkpoint, it dispatches a fresh generic worker to
record the checkpoint and reconcile the authoritative same-scope cluster set. If
that worker returns a non-empty revised queue, the main orchestrator dispatches it
unchanged to a fresh cluster dispatcher. The completed dispatcher is never reused
for another cluster.

## Result and failure rules

- A dispatcher writes and returns exactly one result for exactly one cluster, with
  one of `ready_for_checkpoint`, `blocked`, or `cancelled`, plus its evidence paths.
- The named cluster must equal the head of the queue supplied at dispatcher start.
- A green repair verdict is the only event that opens the two-review gate.
- Reviewer success never substitutes for the authoritative procedure rerun.
- Other fingerprints returned by the authoritative rerun are reported to the main
  orchestrator unchanged; this dispatcher does not select, reprioritize, or repair
  them.
- Transport recovery may redispatch an identical agent task once without spending
  a repair attempt and preserves its harness, model, and effort. A new repair
  candidate or review-correction pass does spend an attempt and resolves that
  attempt's declared profile.
- The dispatcher never reconstructs evidence from prose or conversation history.
- The dispatcher never edits source, executes a repository procedure itself,
  performs either review, stages, commits, or selects a second cluster.
