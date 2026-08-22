# Monorepo hoisting

The monorepo-specific failure class outside the official `expo-upgrade`
skill's scope. Load whenever a cluster's fingerprint matches a hint below.

## Posture detection

First, record the repo's hoisting posture in your findings:

- **Workspaces layout.** Root manifest's `workspaces` globs; package manager and mode (e.g. `yarn@1.22.22 (classic, workspaces)`).
- **`nohoist`.** Any configured `nohoist` glob patterns.
- **`resolutions`/`overrides`.** Root-level pins forcing a single dependency version.
- **Metro config.** `watchFolders`, `extraNodeModules`, and symlink handling in `metro.config.js`.
- **Native resolution path.** How each app's native manifest (`Podfile`, `build.gradle`, or the platform's equivalent) locates `react-native` — a relative `node_modules` walk, a workspace-root pin, or something repo-specific.

## Fingerprint hints

| Symptom | Cluster hint |
| --- | --- |
| Duplicate `react`/`react-native` instances (two copies in the tree, version mismatch at runtime) | Hoisting split — one app resolves a different copy than the rest of the workspace |
| "Unable to resolve module" right after the bump | Metro isn't watching/resolving the new package's location |
| `pod install` path errors (can't find `react-native` relative to the Podfile) | Native resolution path assumption broke under this repo's hoisting posture |
| Haste/naming collisions | Two copies of the same package visible to the packager at once |
| "Invalid hook call" at runtime | Duplicate `react` instance — same cause as the first row, different symptom |

## Remedy ladder

Try each rung before the next; stop at the first that clears the cluster.
Record which rung worked in the findings file (B8, B11).

1. **Lockfile refresh/dedupe.** Regenerate the lockfile; run the package manager's dedupe.
2. **`resolutions`/`overrides` pin.** Force the offending package to one version at the root.
3. **Metro config adjustment.** Add/correct `watchFolders` or `extraNodeModules` for the affected package.
4. **`nohoist` entry.** Exempt the package from hoisting as a last resort.

## Reporting

A hoisting fix is structural, not local: always flag it prominently in
`report.json`'s `follow_ups[]` and in the learnings doc
(`references/final-report.md`), even when the fix itself was small.
