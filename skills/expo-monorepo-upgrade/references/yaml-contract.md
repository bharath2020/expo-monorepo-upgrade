# YAML contract

`expo-upgrade.yaml` is one file at the repository root. It contains reusable
repository procedures, not scheduling metadata. Validate it before creating or
resuming executable units:

```bash
node <skill-dir>/scripts/check-contract.mjs <repo-root>
```

The validator accepts only the shape below and rejects legacy command/pipeline and
per-app-file formats. On an error, stop and direct the user to
`expo-monorepo-upgrade-setup`.

The validated JSON contains normalized `bump`, `changelogs`, `apps`, and flat
`procedures` values, per-kind counts, warnings, and the contract path. Plan only
from that output. Do not keep a second parser or compatibility layer in
orchestrator memory.

## Shape

```yaml
bump:
  description: "Repository-wide mechanical SDK upgrade."
  prompt: |
    Target SDK:
    {{target_sdk}}

    ...
changelogs:
  description: "Download and index Expo and React changelogs after the SDK bump."
  prompt: |
    Target Expo SDK:
    {{target_sdk}}

    Additional changelog sources:
    {{additional_changelog_sources}}

    Changelog download directory:
    {{changelog_output_dir}}

    ...repository-specific changelog preparation task...
apps:
  - path: "apps/example"
    validation:
      description: "Run app-level static validation."
      prompt: |
        ...
    repair_validation:
      description: "Repair one app-validation failure cluster."
      prompt: |
        Cluster summary:
        {{cluster_summary}}

        Failure evidence:
        {{failure_evidence}}
    platforms:
      ios:
        validation:
          description: "Build and validate iOS."
          prompt: |
            ...
        repair_validation:
          description: "Repair one iOS-validation cluster."
          prompt: |
            Cluster summary:
            {{cluster_summary}}

            Failure evidence:
            {{failure_evidence}}
        smoke:
          description: "Run iOS smoke validation."
          prompt: |
            ...
        full_e2e:
          description: "Run the full iOS E2E suite."
          prompt: |
            ...
        repair_smoke_e2e:
          description: "Repair one iOS runtime-test cluster."
          prompt: |
            Failed phase:
            {{failed_phase}}

            Cluster summary:
            {{cluster_summary}}

            Failure evidence:
            {{failure_evidence}}
```

`apps` is a list and `platforms` is a map whose keys are confirmed platform names.
Every executable entry contains exactly `description` and `prompt`. Optional
procedures are omitted entirely.

## Procedure references

Use these stable references in briefs, state, and verdicts:

- `bump`
- `changelogs`
- `apps[<index>].validation`
- `apps[<index>].repair_validation`
- `apps[<index>].platforms.<platform>.validation`
- `apps[<index>].platforms.<platform>.repair_validation`
- `apps[<index>].platforms.<platform>.smoke`
- `apps[<index>].platforms.<platform>.full_e2e`
- `apps[<index>].platforms.<platform>.repair_smoke_e2e`

Also record the literal app `path`; a list index alone is not meaningful to a
human and may differ in a future fresh contract.

## Runtime inputs

| Procedure | Required runtime inputs |
| --- | --- |
| `bump` | `target_sdk` |
| `changelogs` | `target_sdk`, `additional_changelog_sources`, `changelog_output_dir` |
| either `repair_validation` | `cluster_summary`, `failure_evidence` |
| `repair_smoke_e2e` | `failed_phase`, `cluster_summary`, `failure_evidence` |
| `validation`, `smoke`, `full_e2e` | none |

`failed_phase` is exactly `smoke` or `full_e2e`. Derive `cluster_summary` and
`failure_evidence` from the failed worker's validated verdict, including its exact
evidence paths. The orchestrator does not reinterpret raw logs into a new repair
procedure.

Review comments are orchestration metadata, not YAML runtime inputs. When a repair
candidate needs revision,
[general prompt rendering](general-prompt-rendering.md) appends the validated
review-verdict paths without changing the YAML prompt or placeholders.

For `changelogs`, `additional_changelog_sources` is exactly the literal `none` or
one owner-supplied `<descriptive name> | <HTTPS URL>` entry per line. Resolve
`changelog_output_dir` to the absolute run path
`<repository-root>/reports/<run-id>/changelogs`. Reject rendering if that path is
different, an input is unresolved, or an existing directory does not exactly
match the recorded request, checkpoints, manifest, files, and hashes.

Substitute literal values, then reject any remaining `{{...}}` or `[[...]]` token
and any input not allowed for that procedure. The complete rendering algorithm and
hash identities belong to
[general prompt rendering](general-prompt-rendering.md).

## Conditional invariants

- Root `bump` and `changelogs` are both required. A normal run executes
  `changelogs` once after the verified bump checkpoint and before post-bump
  validation. A `--test-run` validates the contract but executes neither root
  procedure.
- App `validation` and app `repair_validation` appear together.
- Platform `validation` and platform `repair_validation` appear together.
- A platform with `smoke` or `full_e2e` also has `repair_smoke_e2e`; the repair
  entry without either runtime phase is invalid.
- App validation owns shared/static checks. Platform validation owns native builds.
  Smoke and full E2E remain under their platform.
- Every app or platform procedure is scoped to its containing `apps[]` entry. A
  worker verdict may report multiple clusters for that app scope but never clusters
  belonging to another app.

The validator proves structure, paths, and placeholder use. A worker executes each
accepted prompt and provides the evidence that determines its result.

## Fresh-copy lifecycle

The contract has no update or migration operation. A run snapshots one validated
file and uses that immutable copy for its entire lifetime. If the repository YAML
is edited or its hash changes, the current run cannot consume it or preserve green
results against it: record the change, block or close the old run, and create a new
run from the edited file as a fresh contract.
