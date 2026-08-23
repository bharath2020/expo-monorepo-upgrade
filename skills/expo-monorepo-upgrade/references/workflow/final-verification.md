# Final verification workflow

## Appended stage prompt

Render each selected final validation, smoke, or full-E2E procedure through
[general prompt rendering](../general-prompt-rendering.md), then append:

```markdown
Do not edit tracked files, change Git state, or commit. Run the complete selected
procedure against the exact final Source SHA and stated app/platform scope. Build
products, caches, screenshots, device artifacts, and logs are allowed. Return green
only when the full procedure passes and its evidence is current. On failure, return
the complete scope-local cluster set. If environment or authorization prevents a
decision, return blocked rather than red or green.

Write `findings.md` with these exact sections:

1. `Source binding` — Source SHA, app path, platform, and procedure reference.
2. `Execution` — commands or pipeline run, start/end times, exit status, and the
   outcome of every selected check.
3. `Evidence` — repository-relative paths to logs and all produced artifacts.
4. `Result` — one of: green with an empty cluster set; red with the complete
   scope-local cluster set; or blocked with the exact blocker and safe next action.

Then write `verdict.json` in the supplied verdict shape, matching the same status,
source binding, evidence, clusters, and blocker recorded in `findings.md`. Return
that JSON alone.
```

After eligible runtime lanes settle, the main orchestrator dispatches fresh
observation agents bound to current HEAD for every configured app `validation`,
followed by every configured platform `validation`. Each agent receives one app or
app/platform procedure.

A newly red validation reopens the matching scope's
[validation repair loop](validation-and-repair.md). Runtime suites are not repeated
automatically merely because final validation ran; their last green verdict remains
usable only while its source scope is current.

After every later repair, apply the freshness rules in
[the execution model](../execution-model.md). The main orchestrator dispatches
fresh agents for stale configured smoke and full-E2E procedures in their normal
stage order before reporting. When change scope is uncertain, stale all runtime
lanes it could affect through a fresh generic worker assigned that state update.

Final verification is green only when all configured validation verdicts are green,
all eligible runtime evidence is current and green, and every change review is
closed. Then continue to [reporting](../reporting.md).
