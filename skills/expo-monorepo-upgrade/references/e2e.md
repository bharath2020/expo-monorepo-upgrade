# Step: E2E

Loop 2 runs the smoke suites (T2), Loop 3 the full ones (T3). Both dispatch
through `references/gates.md` and cluster, fix, and close through
`references/fix-loop.md`; this file holds only what a suite needs that a plain
gate does not. Loop 3 opens for an app × platform once Loop 2 has closed it — a
lane that cannot boot its core flows earns no full-suite run.

## Build first, then run

A suite tests an artifact, not a working tree, so check
`state.json.builds["<app-slug>_<platform>"]` against HEAD before dispatching. A
build older than a landed fix does not contain it, and a missing key means no
build exists at all. Either way, build first, then record the new commit SHA
back into `builds` (A7).

## One failing flow, one cluster

A suite's runner reports flows as clusters — one per failing flow, fingerprinted
by the flow file's slug (`references/worker-briefs.md`), carrying that flow's
failure count, the cells it covers, and its failure-point evidence: screenshots,
device logs, and the view hierarchy at the moment it failed. The fix worker's
findings file carries the same artifacts (B11).

So the verdict needs no flow field. The flows to retry, fix, and re-run are the
gate's open clusters, one flow each, and a flow failing on two platforms is one
cluster naming both. Several flows sharing a root cause become one through the
analyst's merge-or-split call (`references/fix-loop.md`).

## Retry once, clean, before believing it

Flakes are learned during a run, never pre-declared, so every failing flow gets
exactly one retry in a clean environment first (B3). Passing on that retry makes
it a flake: it stays out of clustering and lands in `state.json.flakes` with its
`flake` event (`references/schemas/ledger.md`). Failing twice makes it real, and
it enters clustering. A fingerprint that keeps coming back as a flake earns a
cluster of its own.

Two things from the contract make that retry cheap: the suite's `flow_selector`,
which runs the one failed flow, and the app's `clean` and `environment`
preparation entries — simulator wipe, emulator cold boot, app uninstall — which
are what "clean" means in this repo. Dispatch the resets as `operations` workers
before the attempt. The same pair runs the re-run after a fix lands.

A `flow_selector` is an entry like any other, and it is the one executable in
the contract that may be a `prompt` as well as a `command` — a remote suite
narrows by instructing a worker to trigger the job for `<flow>`, poll it, and
fetch the log, which a single command cannot express. That freedom is safe here
because a selector never decides a cell: the full gate is always the
authoritative pass, and the selector only screens a flake or checks a fix
mid-loop. Whatever its kind, it returns the same verdict as any gate run.

A repo can be missing either, and that degrades the retry rather than stopping
it: with no `flow_selector` the whole suite re-runs for both the retry and the
re-run, and with no reset entries the retry happens in place. Say which fallback
was used in the verdict's `recommendation`, so a green reads as the suite's pass
rather than one flow's.

## Name the layer before changing anything

The fix worker classifies an e2e failure first (B4), because the layer decides
what happens next:

- **App regression** — the bump broke app behavior. Fix the app.
- **Expectation change** — the SDK genuinely changed what the flow asserts.
  Update the flow and record why (B5); never quietly loosen an assertion.
- **Environment** — the simulator, device farm, or harness caused it, not the
  app. That routes to an `operations` dispatch and a re-run, never a code fix:
  no app or flow edit follows an environment diagnosis.
