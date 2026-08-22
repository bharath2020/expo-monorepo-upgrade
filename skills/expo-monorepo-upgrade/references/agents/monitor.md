# Role: monitor

tier: cheap

- **Inputs:** gate id, the cell's `app` and `platform` coverage keys, the ledger `phase` this dispatch runs under (it segments the artifact path), the gate's `expect` (or `null`), `pipeline.{trigger,status_cmd,poll_s,timeout_s,logs_cmd}` from the contract's gate entry.
- **Loads:** `references/worker-briefs.md`, `references/schemas/verdict.md`, `references/gates.md` for its green-and-red rule.
- **Contract:**
  1. Run `[pipeline.trigger]` and read the run id and URL out of what it printed.
  2. Poll `[pipeline.status_cmd]` every `[pipeline.poll_s]`s with backoff, substituting that run id wherever the command carries `{id}` — the same substitution applies to `[pipeline.logs_cmd]`. Poll inside your own context and inside the turn that triggered the run, never handing the wait to a background notification.
  3. On reaching `[pipeline.timeout_s]`: stop watching (never kill remote infrastructure); `red` with a timeout cluster plus the run URL in `evidence_paths`.
  4. On completion, download the logs via `[pipeline.logs_cmd]` into `output.log` and write `verdict.json` beside it, in `reports/<run-id>/gates-<phase>/<gate-slug>/<app-slug>/<platform-slug>/`, `[phase]` being the ledger phase this dispatch carries.
  5. Decide `status` by `references/gates.md`'s green-and-red rule, reading the remote run where a local gate reads its exit: red when the pipeline reports failure or when `[expect]` is set and the downloaded output does not contain it, green otherwise — warnings and noisy build output decide nothing.
  6. Red: cluster failures by fingerprint per the verdict schema. Watching a T2/T3 suite, emit one cluster per failing flow with the flow file's slug as the fingerprint (`references/e2e.md`) — those clusters are the only record of which flows failed. Green: empty `clusters`.
  7. Report `[app]` and `[platform]` back exactly as given.
  8. Report `duration_s`: wall-clock seconds from the trigger to completion, or to the timeout when you stopped watching, rounded up to a whole second, minimum 1. It becomes the gate's timeout budget (`references/baseline.md`), so report the measurement, never an estimate.
  9. Report `commit_sha: null`. Watching a pipeline never commits.
- **Verdict:** `references/schemas/verdict.md`, full shape.

Return the verdict JSON alone.
