# Step: Bump

Dispatch one `bump` worker (capable tier) per `references/agents/bump.md`: it
cuts `upgrade/sdk-<target>` from the baselined tree and lands the mechanical
version bump on it. The orchestrator creates no branch — A2 gives that write to
the agent doing the work, and a branch cut by anyone else invites a bump
committed to the base branch.

Fill the brief with the resolved `target_sdk` and the contract's root `bump`
entry, `{target}` substituted. That entry is this repo's whole bump procedure —
the contract must declare it, and discovery blocks the run when it does not
(`references/discovery.md`).

## On the verdict

- **A commit SHA.** Record it in `state.json.checkpoints` with `phase: "bump"`,
  emit `committed` (`commit_sha, phase`), and write its journal line. That SHA
  is the rollback target every later fix worker carries as
  `last_checkpoint_sha` (`references/fix-loop.md`). The bump commits green or
  not: Loop 1 exists to make it green, while the checkpoint marks where the
  upgrade began.

  The bump changed the repo, so its phase closes under the audits every mutating
  phase gets (`references/audit.md`). Auditing it here is the only chance — every
  later audit runs from `last_checkpoint_sha`, which is this commit, so a bump
  that slipped something past would never be read again. A red opens a cluster
  that Loop 1 picks up.
- **`blocked`** — the entry ran but left apps short of the target. Raise the
  verdict's `summary` and `options` as the open question
  (`references/schemas/verdict.md`); the fix belongs in the contract, so the
  `expo-monorepo-upgrade-setup` skill is where it lands.
