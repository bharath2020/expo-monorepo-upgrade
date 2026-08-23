---
name: expo-monorepo-upgrade
description: "Orchestrate an Expo SDK upgrade from the repository's prompt-native expo-upgrade.yaml contract. Use when asked to run, resume, or report an Expo monorepo upgrade. Args: [target-sdk]."
---

# Expo monorepo upgrade

Execute the repository's upgrade procedures; do not design them. The root
`expo-upgrade.yaml` is the sole authority for repository-specific commands,
prerequisites, validation, and repair. This skill owns only orchestration.

Before a run, read:

- [YAML contract](references/yaml-contract.md) for accepted procedures and inputs;
- [orchestrator principles](references/principles/orchestrator.md) for ownership;
- [execution model](references/execution-model.md) for units, locks, audits, and
  terminal states;
- [general prompt rendering](references/general-prompt-rendering.md) for the shared
  prompt envelope, identity hashes, deadlines, and transport recovery;
- [Herdr dispatch](references/herdr-dispatch.md) for mandatory child-session
  launch, waiting, resume, and cleanup;
- [run state](references/run-state.md) for persistence, resume, and recovery.

## Boundary

- The main orchestrator only chooses the next bounded task and dispatches an agent.
  It never inspects or changes repository source, runs a procedure, reviews a
  candidate, manages Git, writes reports, or mutates queue or run state. Delegate
  any required control-plane write to a fresh generic worker with explicit inputs,
  allowed paths, and expected outputs.
- Dispatch repository work only from the validated contract snapshot. Never infer
  a missing command, build, test, repair, cleanup, or fallback from repository
  files.
- A missing optional YAML entry means no procedure exists for that scope.
- Launch every child-agent session through Herdr. Do not silently fall back to
  native subagents or another harness; an unavailable or incompatible Herdr server
  blocks dispatch with its exact status evidence.
- Use [general prompt rendering](references/general-prompt-rendering.md) for every
  general prompt guideline and every rendered brief. That reference owns the
  common envelope and rendering mechanics; the applicable workflow reference owns
  the one stage prompt appended to it.
- Contract setup or correction belongs to `expo-monorepo-upgrade-setup`, outside
  this skill. Treat every edited contract as a fresh copy for a new run. Never
  migrate, update, or replan an existing run against changed YAML.
- Do not support legacy command/pipeline or per-app contract formats.

## Session placement

- Invoke the skill inside a Herdr-managed orchestrator pane whose working directory
  is the direct parent of the repository being upgraded. Keep that pane in the
  parent and reserve the left 50% of the Herdr layout for it. Resolve the target
  repository as an explicit child path; do not move the main orchestrator into it,
  so repository-local skills and instructions do not enter the main decision
  context.
- Create every dispatched child-agent session through Herdr with the target
  repository root as its initial working directory so repository-local skills and
  instructions load for that agent. Set the pane working directory before starting
  the agent; starting elsewhere and changing directory afterward is not
  equivalent.

## Workflow

When invoked with `--test-run`, follow every stage below except step 3 (Repository bump), and do not require bump success to finish.

Run these stages in order, collapsing only procedures omitted by the contract:

1. [Preflight](references/workflow/preflight.md) — establish or resume the run,
   validate the immutable contract identity, and prove the checkout can proceed.
2. [Baseline](references/workflow/baseline.md) — run configured app and platform
   validation before the bump so pre-existing failures remain attributable.
3. [Repository bump](references/workflow/bump.md) — dispatch the repository-wide
   bump, then checkpoint its verified green candidate without repair review gates.
4. [Validation and repair](references/workflow/validation-and-repair.md) — validate
   one app scope at a time, queue its complete cluster set, and delegate each queue
   head through one repair lifecycle and checkpoint.
5. [Smoke and full E2E](references/workflow/smoke-and-e2e.md) — open eligible
   app/platform runtime lanes in order and route real failures through the same
   app-queue boundary.
6. [Final verification](references/workflow/final-verification.md) — rerun every
   configured required procedure whose evidence must be current at the final
   checkpoint.
7. [Reporting and close](references/reporting.md) — dispatch an agent to render the
   evidence-backed report, then close the durable run with its returned result.

For every dispatch and state transition, apply
[the verdict schema](references/schemas/verdict.md),
[general prompt rendering](references/general-prompt-rendering.md), and
[run state](references/run-state.md). The detailed one-cluster repair lifecycle is
owned only by the
[cluster-dispatcher agent](references/agents/cluster-dispatcher.md).

## Finish

Complete only when the bump succeeded, all configured final validations are
green, every eligible smoke and full-E2E lane is green, all change reviews are
closed, no evidence is stale, and the report artifacts exist. Otherwise finish
`blocked` with exact scopes, evidence paths, last checkpoint, and next actions.
Never push, publish, open a PR, or delete run artifacts unless the user asks.
