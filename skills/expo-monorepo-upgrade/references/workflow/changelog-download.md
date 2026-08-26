# Changelog download workflow

Run the required root `changelogs` procedure once after the verified bump
checkpoint is recorded and before post-bump validation. A `--test-run` does not
execute this procedure. This is the only stage allowed to search for or download
changelogs.

Before dispatch, require `additional_changelog_sources` to be durably recorded as
the literal `none` or one owner-supplied `<descriptive name> | <HTTPS URL>` entry
per line. If it is absent, ask the owner and dispatch a fresh generic worker to
record the answer before rendering the procedure.

Resolve the three YAML runtime inputs exactly:

- `target_sdk` from run state;
- `additional_changelog_sources` from the recorded owner decision;
- `changelog_output_dir` to
  `<absolute-repository-root>/reports/<run-id>/changelogs`.

Reject the render if an input remains unresolved or the output path differs. Pass
the normalized `changelogs` prompt through
[general prompt rendering](../general-prompt-rendering.md) with the
`generic-judgment` profile, then append the stage prompt below.

## Appended stage prompt

```markdown
Execute the repository's `changelogs` procedure after the verified bump
checkpoint. The procedure owns source discovery, required coverage, file layout,
and download behavior. Web search and downloading are allowed only in this task.

Do not edit repository source or dependency files, change Git state, run another
repository procedure, or write outside the supplied changelog output and verdict
directories. Bind all results to the starting source checkpoint and verified bump
checkpoint supplied in the orchestration context.

The changelog output directory is an immutable run artifact. If it already exists,
reuse it only when its request inputs, checkpoints, coverage, files, and hashes
match exactly. Otherwise return blocked without overwriting, deleting, or partially
updating it.

Before returning green, require readable `index.md` and `manifest.json`, every
manifest path to remain inside the changelog output directory, every indexed local
Markdown path to appear in the manifest, and every recorded file SHA-256 to match.
Incomplete required coverage, an empty or unauthenticated source, an invalid hash,
or a conflicting existing directory is blocked. There is no red changelog result
and no changelog-repair procedure.

Write `findings.md` with these exact sections:

1. `Input binding` — target SDK, additional sources, starting source checkpoint,
   verified bump checkpoint, and exact changelog output directory.
2. `Sources` — requested and final authoritative URLs, resolved version coverage,
   and retrieval outcomes.
3. `Downloaded references` — directory, index, manifest, every local Markdown
   path, and SHA-256 values.
4. `Validation` — request identity, checkpoint binding, readability, containment,
   routing, coverage, and hash checks.
5. `Result` — green with the accepted changelog identity or blocked with the exact
   gap or conflict and safe next action.

Then write `verdict.json` in the supplied verdict shape. On green, put the output
directory, index path, manifest path and SHA-256, requested and final sources,
version coverage, and complete file/hash map in `result`. Report no clusters or
source changes. On blocked, match the blocker and evidence to `findings.md`. Return
that JSON alone.
```

After a green verdict, the main orchestrator dispatches a fresh generic worker to
re-read the directory and hashes and atomically record them in
`state.changelog_references`. Only that green state write opens post-bump
validation. Every later worker receives the recorded directory through its brief
and Herdr launch. A missing or changed reference records
`changelog_reference_gap` and blocks instead of reopening web access.
