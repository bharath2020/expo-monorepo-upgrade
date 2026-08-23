# Baseline workflow

Baseline identifies pre-existing validation failures before the SDK bump. It is
observation-only and never opens repairs.

## Appended stage prompt

Render each selected validation procedure through
[general prompt rendering](../general-prompt-rendering.md), then append:

```markdown
Observe the complete configured validation at Source SHA before the SDK bump. Do
not edit tracked files, change Git state, or commit. Build products and logs are
allowed. On failure, return the complete cluster set for only the stated app and
optional platform scope. If environment or authorization prevents a decision,
return blocked rather than red or green.

Write `findings.md` with these exact sections:

1. `Source binding` — Source SHA, app path, platform, and procedure reference.
2. `Execution` — command or pipeline, timing, exit status, and every check outcome.
3. `Evidence` — repository-relative log and artifact paths.
4. `Result` — green with no clusters; red with the complete scope-local cluster
   set; or blocked with the exact blocker and safe next action.

Then write `verdict.json` in the supplied verdict shape, matching the same source,
status, evidence, clusters, and blocker. Return that JSON alone.
```

1. The main orchestrator dispatches every configured app `validation` procedure
   with no runtime inputs and explicit app-path scope metadata.
2. After app units settle, it dispatches every configured platform `validation`
   procedure with no runtime inputs and explicit app-path/platform metadata.
3. Workers use the appended baseline prompt above. They may create build and test
   artifacts but may not edit tracked source.
4. After each verdict, the main orchestrator dispatches a fresh generic worker to
   store every cluster under its exact app or app/platform scope and retain its
   fingerprint and evidence without opening a repair queue.

Before the bump, summarize red or blocked baseline scopes and ask whether to
proceed or stop. If the user proceeds, carry their fingerprints forward. A matching
post-bump cluster is `pre_existing`, is not attributed to the upgrade, and is not
sent automatically to repair.
