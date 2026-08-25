# Smoke and full-E2E workflow

An app/platform lane becomes eligible when all validation procedures configured
for its app and platform are green.

## Appended stage prompts

Render the selected YAML procedure through
[general prompt rendering](../general-prompt-rendering.md), then append exactly the
matching stage prompt below.

### Runtime observation

```markdown
Before categorizing failures, read and follow:

<absolute-skill-dir>/references/failure-clustering.md

Do not edit tracked files, change Git state, or commit. Build products, caches,
screenshots, device artifacts, and logs are allowed. Before running, require the
working tree to match Source SHA plus Candidate diff when one is supplied. A pass
is green only when the complete smoke or full-E2E procedure ran for the stated
app/platform lane. On failure, return the complete lane-local cluster set. If
environment or authorization prevents a decision, return blocked rather than red
or green.

Write `findings.md` with these exact sections:

1. `Source binding` — Source SHA, candidate diff hash or `none`, app path,
   platform, procedure reference, and runtime phase.
2. `Execution` — command or pipeline, timing, exit status, and every check outcome.
3. `Evidence` — repository-relative logs, screenshots, device, and artifact paths.
4. `Result` — green with no clusters; red with the complete lane-local cluster
   set; or blocked with the exact blocker and safe next action.

Then write `verdict.json` in the supplied verdict shape, matching the same source,
candidate, phase, status, evidence, clusters, and blocker. Return that JSON alone.
```

### Runtime repair

```markdown
Before diagnosing or editing, read and follow the mandatory additional
instructions at:

<absolute-skill-dir>/references/principles/code-changes.md

If that file is missing or unreadable, return blocked before editing. These
instructions constrain the repair but do not extend the YAML procedure or
authorize work outside the supplied cluster and scope. If they conflict with
the repair procedure, return blocked rather than improvising.

Repair only the supplied runtime cluster, app/platform scope, and Failed phase. Do
not alter expo-upgrade.yaml or weaken the invoked smoke or full-E2E check. Write the
diagnosis before editing and apply every supplied review comment without expanding
scope. Follow the repair prompt's checks. When they pass, leave the candidate
uncommitted, snapshot its diff, report every changed file and the diff SHA-256, and
return green. Do not stage or commit. On failure, save patch and evidence, then
restore only changes owned by this iteration to the prior candidate. If exact
restoration is not provably safe, return blocked without destructive cleanup.

Write `findings.md` with these exact sections:

1. `Input binding` — Source SHA, input candidate hash or `none`, app/platform,
   procedure reference, Failed phase, and supplied cluster fingerprint.
2. `Diagnosis` — evidence-backed cause and bounded repair decision.
3. `Changes` — every changed file, accepted snapshot and diff hash, or exact
   restoration evidence.
4. `Checks` — each required check and its outcome with evidence paths.
5. `Result` — green with the accepted candidate identity; red only after proven
   restoration; or blocked with the exact blocker and safe next action.

Then write `verdict.json` in the supplied verdict shape. Make its source and
candidate bindings, `changes`, status, evidence, clusters, and blocker match
`findings.md` exactly. Return that JSON alone.
```

The single runtime-repair stage prompt consists of the repair block followed by
[code-change principles](../principles/code-changes.md) and only recorded human
decisions that apply to this scope.

## Smoke

For each eligible lane with `smoke`, dispatch that procedure with no runtime inputs
and the runtime-observation stage prompt above. A missing `smoke` creates no unit
and no failure.

On red, rerun the exact same YAML prompt, runtime inputs, and source SHA once in a
new procedure attempt. Use fresh attempt paths, deadline, envelope, and brief hash.
A green retry is a flake and retains both evidence paths. A second red is real.

For a real red result, the main orchestrator dispatches a fresh generic worker with
the complete validated verdict and `failed_phase=smoke`. Its bounded assignment
records the clusters and returns that app's ordered eligible queue. The main
orchestrator sends the queue unchanged to a fresh cluster dispatcher, then uses
the dispatcher-result, checkpoint, and reconciliation boundary in
[validation and repair](validation-and-repair.md). The matching repair procedure is
the same lane's `repair_smoke_e2e`; its YAML inputs come from the validated verdict.

## Full E2E

For each eligible lane with `full_e2e`, require configured smoke to be green first;
when smoke is absent, the last configured validation is its gate. Apply the same
one-rerun flake check and generic-worker queue-recording boundary with
`failed_phase=full_e2e`, then send the returned ordered queue unchanged to a fresh
cluster dispatcher.

One runtime agent runs exactly one procedure for one app/platform lane. Never
combine smoke and full E2E unless the selected YAML prompt itself does so. The
cluster dispatcher's internal repair lifecycle is defined only in its agent
contract. Common brief assembly remains centralized in general prompt rendering;
this workflow owns only the stage prompts above.
