# Validation and repair workflow

Run post-bump app validation before platform validation. A configured app
validation must be green before that app's platform validation opens. An omitted
validation creates no unit and no gate. Every configured app and platform
validation prerequisite must be green before runtime work opens.

## Appended stage prompts

Render the selected YAML procedure through
[general prompt rendering](../general-prompt-rendering.md), then append exactly the
matching stage prompt below.

### Validation observation

```markdown
Before categorizing failures, read and follow:

<absolute-skill-dir>/references/failure-clustering.md

On failure in a normal run, require `Changelog reference status: ready`, then use
read-only subagents to explore the downloaded files routed by `Changelog index`
for the target SDK, scope, diagnostics, packages, and APIs. Give each subagent only
its relevant files, require exact local paths and applicable facts or an explicit
no-match, then reconcile the results yourself. Do not search for or download
changelogs. A missing file or manifest-hash mismatch is blocked. In a `--test-run`,
require `not_applicable_test_run`, skip changelog research, and record that literal
instead; any other status is blocked.

Do not edit tracked files, change Git state, or commit. Build products and logs are
allowed. Before running, require the working tree to match Source SHA plus Candidate
diff when one is supplied. A pass is green only when the complete validation ran
against that exact source identity. On failure, return the complete cluster set for
only the stated app and optional platform scope. If environment or authorization
prevents a decision, return blocked rather than red or green.

Write `findings.md` with these exact sections:

1. `Source binding` — Source SHA, candidate diff hash or `none`, target SDK,
   changelog manifest SHA-256 or `not_applicable_test_run`, app path, platform,
   and procedure reference.
2. `Execution` — command or pipeline, timing, exit status, and every check outcome.
3. `Evidence` — repository-relative log and artifact paths plus changelog Markdown
   paths used to categorize a failure, `not_required_green`, or
   `not_applicable_test_run`.
4. `Result` — green with no clusters; red with the complete scope-local cluster
   set; or blocked with the exact blocker and safe next action.

Then write `verdict.json` in the supplied verdict shape, matching the same source,
candidate, status, evidence, clusters, and blocker. Return that JSON alone.
```

### Validation repair

```markdown
Before diagnosing or editing, read and follow the mandatory additional
instructions at:

<absolute-skill-dir>/references/principles/code-changes.md

If that file is missing or unreadable, return blocked before editing. These
instructions constrain the repair but do not extend the YAML procedure or
authorize work outside the supplied cluster and scope. If they conflict with
the repair procedure, return blocked rather than improvising.

Before diagnosing or editing in a normal run, require `Changelog reference status:
ready`, then use read-only subagents to explore the downloaded files routed by
`Changelog index` for the supplied cluster, target SDK, platform, packages, APIs,
and diagnostics. Require exact local paths and applicable migration facts or an
explicit no-match, then reconcile the results yourself. Subagents must not edit,
execute the procedure, or search for other changelogs. A missing file or
manifest-hash mismatch is blocked. In a `--test-run`, require
`not_applicable_test_run`, skip changelog research, and record that literal;
any other status is blocked.

Repair only the supplied validation cluster and scope. Write the diagnosis before
editing. Do not alter expo-upgrade.yaml or weaken the invoked validation. Apply
every supplied review comment to the same candidate without expanding its scope.
Follow the repair prompt's checks. When they pass, leave the candidate uncommitted,
snapshot its diff, report every changed file and the diff SHA-256, and return green.
Do not stage or commit. On failure, save patch and evidence, then restore only
changes owned by this iteration to the prior candidate. If exact restoration is
not provably safe, return blocked without destructive cleanup.

Write `findings.md` with these exact sections:

1. `Input binding` — Source SHA, input candidate hash or `none`, target SDK,
   changelog manifest SHA-256 or `not_applicable_test_run`, app/platform scope,
   procedure reference, and supplied cluster fingerprint.
2. `Diagnosis` — evidence-backed cause, cited local changelog paths and applicable
   facts, explicit no-match, or `not_applicable_test_run`, and the bounded repair
   decision.
3. `Changes` — every changed file, accepted snapshot and diff hash, or exact
   restoration evidence.
4. `Checks` — each required check and its outcome with evidence paths.
5. `Result` — green with the accepted candidate identity; red only after proven
   restoration; or blocked with the exact blocker and safe next action.

Then write `verdict.json` in the supplied verdict shape. Make its source and
candidate bindings, `changes`, status, evidence, clusters, and blocker match
`findings.md` exactly. Return that JSON alone.
```

The single validation-repair stage prompt consists of the repair block followed by
[code-change principles](../principles/code-changes.md) and only recorded human
decisions that apply to this scope.

For each configured validation procedure:

1. The main orchestrator chooses one app or app/platform validation unit.
2. It dispatches one observation agent using a rendered brief that explicitly
   names the procedure reference, literal app path, and optional platform. The
   YAML procedure still receives no runtime inputs: these values are orchestration
   scope metadata, not substitutions. One agent never validates multiple apps.
3. Require the verdict to contain the complete cluster set from that one procedure,
   not only its first failure.
4. The main orchestrator dispatches a fresh generic worker to validate, record,
   deduplicate, and baseline-match clusters only within that exact scope. The
   bounded assignment returns the resulting ordered app queue.
5. The main orchestrator dispatches that returned queue unchanged to a fresh
   [cluster dispatcher](../agents/cluster-dispatcher.md). It does not preselect a
   cluster.
6. The dispatcher returns exactly one result for the supplied queue head:
   `ready_for_checkpoint`, `blocked`, or `cancelled`, with its evidence paths.
7. On `ready_for_checkpoint`, the main orchestrator dispatches a general checkpoint
   agent. The agent verifies the candidate and evidence, stages only the candidate
   files, creates one checkpoint commit, verifies it, and returns its verdict.
8. After a green checkpoint verdict, the main orchestrator dispatches a fresh
   generic worker to record the checkpoint, reconcile the authoritative complete
   same-scope cluster set, and return the revised ordered app queue.
9. When the revised queue is non-empty, the main orchestrator dispatches it
   unchanged to a fresh cluster dispatcher. Never reuse a completed dispatcher.

Neither orchestrator runs validation, repairs, reviews, stages files, commits, or
changes repository code. The main orchestrator also never records or reconciles
state itself. Never cross app/platform repair boundaries or use a runtime repair
procedure for validation. The cluster dispatcher's internal lifecycle is defined
only in its agent contract; do not reproduce it here.
