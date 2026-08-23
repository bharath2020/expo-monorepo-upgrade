# Orchestrator principles

These rules govern the control plane. Repository procedures still come only from
the YAML contract.

- **A1. Decide from durable verdicts.** Read `state.json` and validated verdicts.
  Workers read code, logs, and device or pipeline output.
- **A2. Delegate executable work.** Give each procedure invocation, review, and
  evidence-producing recovery check to a fresh bounded worker. The main
  orchestrator may read the immutable contract snapshot, state, and returned
  verdicts needed for a decision. It does not inspect repository source, run
  commands, manage Git, write reports, or mutate control-plane state.
- **A3. Write facts where they happen.** A worker writes logs, findings, and its
  verdict before returning. An orchestrator delegates each decided transition,
  queue mutation, prompt identity, and durable decision to a fresh generic worker
  with a bounded assignment.
- **A4. Validate cheapest-first.** App validation precedes platform validation;
  validation precedes smoke; smoke precedes full E2E. Have a generic worker record
  the complete cluster set for one app scope, then send its returned queue
  unchanged to a fresh dispatcher for exactly the queue head.
- **A5. Checkpoint verified progress.** A repair worker never commits. The
  checkpoint agent commits one cluster only after the dispatcher returns a
  candidate that passed code review, code-change-principles review, and the
  authoritative procedure rerun. A green bump candidate reaches the checkpoint
  agent without those repair reviews.
- **A6. Preserve the contract.** Green means the snapshotted prompt passed as
  written. Editing YAML, invoked scripts, or assertions to make a run pass is an
  escalation and requires a new run when the contract changes.
- **A7. Bind evidence to source scope.** Every brief and verdict records source
  SHA. Later commits stale evidence they may affect.
- **A8. Bound every loop.** One identical redispatch for transport loss, at most
  three repair attempts per cluster, and a deadline plus heartbeat for every wait.
- **A9. Continue independent work.** A blocked lane pauses alone. The
  repository-wide bump and shared-checkout integrity are global gates.
- **A10. Honor ownership.** YAML controls repository procedure, workflow files
  control stage selection and stage prompts, general prompt rendering controls the
  common envelope and rendering mechanics, generic workers own only their
  explicitly assigned control-plane writes, each cluster dispatcher owns only its
  supplied queue head, checkpoint agents own commits, reporting agents own report
  content, and recorded human decisions control exceptional cases.
- **A11. Spend capability deliberately.** Match worker capability to the judgment
  required and use independent reviewers for candidate changes.
- **A12. Review before repair commits.** Every repair candidate must pass one code
  review and one code-change-principles review. Review comments return to a repair
  worker, and both reviews rerun on every changed candidate.
