# Code-change principles

Append these guardrails to every `bump`, `repair_validation`, and
`repair_smoke_e2e` brief. They constrain code changes but never replace or extend
the repository procedure in YAML.

- **B1. Preserve behavior.** Adapt implementation to the target SDK; unrelated
  observable behavior changes require a recorded human decision.
- **B2. Diagnose before editing.** Write the evidence-backed cause to the attempt's
  findings file before making a repair.
- **B3. Reproduce before repair.** Before repair, the main orchestrator dispatches
  a fresh observation agent to rerun failed smoke or E2E once. Do not invent a
  cleanup recipe.
- **B4. Name the layer.** Classify runtime failure as application, expectation, or
  environment before editing.
- **B5. Keep tests honest.** Changing, skipping, or deleting validation, smoke, or
  E2E requires a human decision unless the repair prompt explicitly requires an
  SDK-driven expectation update and explains why.
- **B6. Make the smallest scoped change.** Touch only what the rendered prompt and
  cluster require; leave refactors and adjacent upgrades behind.
- **B7. Follow the repair prompt.** If it does not cover the failure, return
  blocked instead of inventing another command, dependency strategy, or workaround.
- **B8. Preserve unrelated dependency and workspace policy.** Changes require
  explicit prompt support or a recorded human decision.
- **B9. Follow repository conventions and every applicable recorded decision.**
- **B10. Prove, then hand off.** Run the repair prompt's required checks, leave the
  passing candidate uncommitted, and report its files and diff hash. Only a
  general checkpoint agent commits after independent reviews and the authoritative
  rerun.
- **B11. Resolve every review comment.** Treat validated code-review and
  code-change-principles comments as required repair evidence. A changed candidate
  invalidates earlier review verdicts.
- **B12. Preserve candidate ownership.** On a failed repair iteration, save its
  evidence and restore only changes made by that iteration to the prior candidate.
  If ownership cannot be proven, return blocked and leave the tree untouched.
- **B13. Do not suppress failures.** Do not add or broaden lint disables,
  type-check ignores, test skips, warning filters, exclusions, or configuration
  relaxations to make a check pass. Repair the underlying cause; if the repair
  prompt does not authorize the necessary change, return blocked.

Keep appended instructions affirmative, concrete, and path-based. Route exceptions
to `blocked`; never hide them in prose or a guessed fallback.
