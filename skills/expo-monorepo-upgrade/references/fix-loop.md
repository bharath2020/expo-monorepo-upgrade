# Step: Fix loop

The engine all three loops share: cluster the failures, fix each cluster, prove
it, close. Loop 1 runs it over gate failures, Loops 2–3 over flow failures that
survived their retry (`references/e2e.md`). Load alongside `references/gates.md`.

1. **Gather.** Collect every verdict this pass returned. A flow that passed its
   clean retry is a flake, not a failure (`references/e2e.md`) — only what failed
   both attempts enters clustering.

2. **Cluster.** Dedup across the whole loop at once: one fingerprint recurring
   across apps or gates is one cluster, `affected` spanning every member. When two
   clusters look distinct but may share a root cause, dispatch an `analyst` with
   the findings and one question — merge or split — and act on its answer (A1).

3. **Dispatch one fix worker per cluster** (`references/agents/fix.md`), sealing
   its scope: `evidence_paths`, target SDK, the recorded decisions, any matching
   guide (`references/monorepo-hoisting.md` on a hoisting fingerprint), and
   `last_checkpoint_sha` — the newest SHA in `state.json.checkpoints`, which its
   rollback resets to. Independent clusters go in parallel (A9). A worker proves
   its own fix with the narrowest check that settles the cluster: T0 and T1 are
   cheap enough to run mid-fix, T2 and T3 are gates only (B10).

4. **Record the verdict.** Write the `verdict` event and its journal line. When
   the worker committed, also write `committed` (`commit_sha, cluster`) and append
   that commit to `state.json.checkpoints` (`references/schemas/ledger.md`) — a
   landed, validated fix is the new rollback target, and leaving it out would
   point a later attempt's rollback at the bump and discard it.

5. **Re-run.** Re-run the affected gates (Loop 1) or the failed flows (Loops 2–3):
   cluster-level validation was early confidence, this pass is authoritative, and
   it rewrites whole cells (`references/gates.md`). The matrix is clean when every
   cell that exists is green or blocked — a cell a blocked cluster holds red is
   settled rather than open, and its best diagnosis and next step ride into the
   report (`references/final-report.md`).

6. **Audit and close.** The loop landed commits, so it closes under the three
   audits every mutating phase gets: `references/audit.md`. A red one comes back
   here as a cluster, at step 2.

## Caps and rollback

3 attempts per cluster, each fresh worker inheriting every prior attempt's
evidence. A cluster goes `blocked` two ways: diagnosed unfixable-by-policy, with
zero attempts spent (B12), or the cap exhausted. Either way write a `blocked`
event (`fingerprint, reason`) and a journal line, and where a human could lift
it, raise the verdict's `summary` and `options` as the open question
(`references/schemas/verdict.md`).

A fix that leaves the cluster worse resets the branch before reporting
(`references/agents/fix.md`), so the branch never accumulates junk.

A loop that opened no clusters still closes through an audit rather than
skipping one — a shorter one, since there is no diff to read
(`references/audit.md`).
