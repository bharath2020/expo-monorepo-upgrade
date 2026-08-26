# Repository bump workflow

The main orchestrator selects root procedure `bump`, supplies only `target_sdk`,
renders it through
[general prompt rendering](../general-prompt-rendering.md), appends the stage prompt
below, and dispatches one repository-wide bump agent.

## Appended stage prompt

```markdown
1. Create or reuse branch upgrade/sdk-<target> at Starting checkpoint.
2. Before editing, resolve the repository's Expo SDK from its dependency metadata
   and require it to match Source Expo SDK in the orchestration context.
3. Execute the bump prompt across the repository. Do not include reports/<run-id>
   in the source candidate, edit expo-upgrade.yaml, stage, or commit.
4. After the bump, resolve the repository's Expo SDK again and require it to match
   Target SDK.
5. On a passing result, leave only the bump candidate uncommitted, snapshot its
   tracked and candidate-owned untracked files, report every file and the diff
   SHA-256, and return green.
6. On failure, save patch and evidence, then restore only changes owned by this
   attempt to Starting checkpoint. If exact restoration is not provably safe,
   return blocked without destructive cleanup.

Write `findings.md` with these exact sections:

1. `Source binding` — Starting checkpoint, source Expo SDK, target SDK, explicit
   source-to-target migration, dependency evidence, and branch.
2. `Execution` — bump actions, post-bump Expo SDK dependency evidence, checks,
   timing, and exact failure point if any.
3. `Candidate` — changed files, snapshot path, diff SHA-256, or restored-state
   evidence when no candidate is accepted.
4. `Evidence` — repository-relative patch, log, and check-artifact paths.
5. `Result` — green with the accepted candidate identity; red only after proven
   restoration; or blocked with the exact blocker and safe next action.

Then write `verdict.json` in the supplied verdict shape. Put `source_sdk_before`,
`target_sdk_requested`, and `target_sdk_after` in `result`. On green, require the
before/requested/after values to prove the supplied source-to-target migration and
make `changes` match the candidate file list, snapshot, and diff hash exactly. On
red or blocked, match the SDK evidence, restoration evidence, and blocker in
`findings.md`. Return that JSON alone.
```

As part of this single bump-stage prompt, append
[code-change principles](../principles/code-changes.md) immediately after the
block above.

The bump agent starts from the recorded checkpoint, creates or reuses
`upgrade/sdk-<target>`, executes the YAML prompt across the repository, and leaves
a green candidate uncommitted with its file list, snapshot, and diff hash. It does
not stage or commit.

No code review or code-change-principles review runs for the bump. After a valid
green bump result, the main orchestrator dispatches a general checkpoint agent.
That agent mechanically verifies the candidate, stages only its declared files,
creates the repository-wide bump commit with required trailers, verifies it, and
returns a checkpoint verdict. The main orchestrator then dispatches a general
worker to record the verified commit; only that worker's green verdict establishes
the first source checkpoint and opens the required root `changelogs` procedure.
Post-bump validation remains closed until the changelog directory and manifest
identity are independently verified and recorded.

There is no bump-repair procedure. A red, blocked, malformed, unverifiable, or
unsafe-to-commit bump blocks every lane. Never improvise a manual Expo upgrade.
