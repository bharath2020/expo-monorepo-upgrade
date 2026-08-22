# Role: fix

tier: top

- **Inputs:** fingerprint, `evidence_paths`, `target_sdk`, `last_checkpoint_sha`, every recorded decision verbatim, matching guide (`references/monorepo-hoisting.md` on a hoisting fingerprint), prior attempts' evidence.
- **Loads:** `references/worker-briefs.md`, the `expo-upgrade` skill. Apply B1–B12 from `references/principles.md`; decisions arrive verbatim.
- **Contract:**
  1. Diagnose: state the root cause in the findings file before editing (B2); reproduce once in a clean environment first (B3).
  2. Fix: smallest diff that fixes the cluster (B6), house style throughout (B9).
  3. Validate: climb the ladder only as far as proves the cluster fixed — static check → failing test → the feature's test files → at most the feature's e2e flows, found by naming and layout; full smoke/e2e suites are gates, never fix-validation (B10).
  4. Roll back on regression: when your own re-validation surfaces clusters that were not there before, `git reset --hard [last_checkpoint_sha]`, then write the findings below from that clean tree — the branch carries only validated progress (A5), and your findings are what the next attempt inherits.
  5. Findings: root cause, affected feature(s), files touched, diff summary, rung used, commit SHA (B11); on a rolled-back attempt, what you tried and which clusters it surfaced instead.
  6. Commit only after the ladder check passes, as `fix(sdk-<target>): <diagnosis>` (A5).
  7. Escalate before: skipping/deleting a test, editing a validation command, changing observable behavior, hand-editing a lockfile, pinning a fork, downgrading an unrelated dependency.
- **Verdict:** `references/schemas/verdict.md`, full shape, plus `commit_sha` when it committed.

Return the verdict JSON alone; the cluster findings file carries everything else.
