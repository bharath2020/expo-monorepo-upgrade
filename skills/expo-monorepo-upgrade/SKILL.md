---
name: expo-monorepo-upgrade
description: Upgrade the Expo SDK across a monorepo of React Native apps, validating through tiered gates. Reads the expo-upgrade.yaml contract the expo-monorepo-upgrade-setup skill writes. Use when asked to upgrade Expo SDK, bump the Expo version, or migrate a monorepo to a new SDK. Args: [target-sdk].
---

# expo-monorepo-upgrade

Dispatch workers, read their verdicts, decide the next step. Read
`references/principles.md` and `references/orchestration-model.md` first and
hold both for the whole run.

Each step below names what it settles and what it leaves behind; its file
holds how.

## Workflow

1. **Setup** — open the run and prove it can start.
   Leaves: `reports/<run-id>/` with its ledger, the preflight checklist printed, preconditions answered. No root `expo-upgrade.yaml` refuses the run and points at the `expo-monorepo-upgrade-setup` skill; no Expo app declines it.
   `references/setup.md`, `references/schemas/ledger.md`.
2. **Discovery** — settle what to run and which SDK to run at.
   Leaves: `target` in the ledger, the validated contract every later step dispatches from, and any contract warnings for the report.
   `references/discovery.md`.
3. **Baseline** — measure the repo as it stands, before anything moves.
   Leaves: a `baseline` result and a timeout budget for every gate but the full e2e suite, which is too expensive to run twice, plus the known flakes.
   `references/baseline.md`.
4. **Bump** — move the workspace to the target SDK.
   Leaves: branch `upgrade/sdk-<target>` and its first checkpoint commit, audited.
   `references/bump.md`.
5. **Loop 1** — get compile and tests green: static gates (T0), then builds and unit/native tests (T1).
   Leaves: every T0/T1 cell green or blocked, one commit per fixed cluster, and a phase three independent audits closed.
   `references/gates.md`, `references/fix-loop.md`.
6. **Loop 2** — get smoke green (T2), per app × platform.
   Leaves: every T2 cell green or blocked, proven by one full smoke pass.
   `references/e2e.md`.
7. **Loop 3** — get the full e2e suites green (T3), opening only where Loop 2 closed.
   Leaves: every T3 cell green or blocked. An app whose contract declares no `e2e` entry has nothing to run here.
   `references/e2e.md`.
8. **Final verify and report** — prove the finished branch and close the run.
   Leaves: every gate re-run once against HEAD, then `report.json`, `summary.md`, `report.html`, the learnings entry, their commit, and phase `complete`.
   `references/final-report.md`.

## Close

Every terminal phase — `complete` after step 8, `declined` at setup's scope check — prints the same run-close checklist: one line per phase, the gate/cluster/commit counts, the banner, and the artifact paths, with the rendered report opened in the browser. Setup's preflight checklist opened the run; this closes it. `references/final-report.md`.

## Reference index

- `references/schemas/*`: load each schema at the step where its producer or consumer runs.
- `references/worker-briefs.md`: load before every dispatch; it indexes the ten `references/agents/<role>.md` contract files, one of which each dispatch names.
- `references/dispatch-backends.md`: load at the first dispatch, once the backend is chosen.
- `references/audit.md`: load at every phase close that landed a commit.
- `references/monorepo-hoisting.md`: load when a cluster's fingerprint matches a hoisting pattern.
