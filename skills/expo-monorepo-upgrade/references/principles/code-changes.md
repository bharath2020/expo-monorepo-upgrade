# Code-change principles

Append these guardrails to every `bump`, `repair_validation`, and
`repair_smoke_e2e` brief. They constrain code changes but never replace or extend
the repository procedure in YAML.

- **B1. Preserve observable behavior.** Change observable behavior only where the
  assigned work requires it. Preserve unrelated user-visible, API-visible, and
  automation-visible behavior.
- **B2. Respect the diagnosed failure layer.** Record the evidence-backed cause and
  classify it as application, expectation, or environment before editing.
  Application failures permit implementation or configuration changes. Expectation
  failures permit only assertion or expectation changes. Environment failures
  permit no tracked source changes.
- **B3. Keep verification honest.** Do not weaken, skip, delete, or narrow
  validation, smoke, or E2E checks. Change an assertion or expectation only when
  the assigned work explicitly requires an SDK-driven update and the findings
  explain the exact mismatch.
- **B4. Avoid incidental source churn.** Do not include refactors, renames,
  reorganizations, formatting-only changes, cleanup, or adjacent upgrades unless
  necessary for the assigned work.
- **B5. Preserve dependency and workspace policy.** Keep dependency declarations,
  lockfile content and policy, package-manager settings, and workspace topology
  unchanged except for changes directly required by the assigned procedure.
- **B6. Follow local implementation conventions.** Make new or rewritten code
  match the established APIs, patterns, naming, formatting, and file placement
  within the touched scope. Deviate only when a documented target-SDK requirement
  makes the existing convention incompatible.
- **B7. Do not suppress in-scope diagnostics.** Correct the underlying cause of
  diagnostics within the declared validation scope. Do not add or broaden lint
  disables, type-checker ignores, warning filters, severity reductions, source
  exclusions, tool-configuration relaxations, or equivalent suppression merely to
  make a check pass.

Keep appended instructions affirmative, concrete, and path-based. Route exceptions
to `blocked`; never hide them in prose or a guessed fallback.
