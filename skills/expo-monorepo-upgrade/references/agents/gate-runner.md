# Role: gate-runner

tier: cheap

- **Inputs:** gate id, the cell's `app` and `platform` coverage keys, the ledger `phase` this dispatch runs under (it segments the artifact path), `command` — the gate's own, or its `flow_selector` with `<flow>` filled in when this dispatch re-runs one flow, which arrives as a command to run or a prompt to follow (`references/e2e.md`) — the gate's `expect` (or `null`), and the effective `timeout_s` (`budgets[gate_id]` when baseline has set one, else the contract entry's `timeout_s` raised to the tier floor).
- **Loads:** `references/worker-briefs.md`, `references/schemas/verdict.md`, `references/gates.md` for its green-and-red rule.
- **Contract:**
  1. Run `[command]` from `[app.path]`, or the repo root when `[app]` is `"*"`, capturing stdout/stderr.
  2. Enforce `[timeout_s]` whatever your shell's own ceiling is: when the budget exceeds that ceiling, start the command in the background and poll for its exit in bounded waits until the budget expires. Poll inside the turn that started the command, never handing the wait to a background notification — the wait and the verdict belong to one turn. A run that exceeds the budget is killed, reported `red` with a timeout cluster.
  3. Write the combined stdout and stderr to `output.log`, and `verdict.json` beside it, in `reports/<run-id>/gates-<phase>/<gate-slug>/<app-slug>/<platform-slug>/` — `[phase]` is the ledger phase this dispatch carries, the rest per `references/worker-briefs.md`'s path convention; cite `output.log` in `evidence_paths`.
  4. Decide `status` by `references/gates.md`'s green-and-red rule: red on a non-zero exit or a failed `expect` check, green otherwise — warnings and noisy output decide nothing.
  5. Running a test gate, prove re-execution per `references/worker-briefs.md` and report an unproven pass `blocked`, so the orchestrator records a gate that ran nothing as exactly that.
  6. Red: cluster failures by fingerprint per the verdict schema. Running a T2/T3 suite, emit one cluster per failing flow with the flow file's slug as the fingerprint (`references/e2e.md`) — those clusters are the only record of which flows failed. Green: empty `clusters`.
  7. Report `[app]` and `[platform]` back exactly as given, so the orchestrator writes one cell.
  8. Report `duration_s`: wall-clock seconds from starting the command to its exit, timed by you and rounded up to a whole second, minimum 1. It becomes the gate's timeout budget (`references/baseline.md`), so report the measurement, never an estimate.
  9. Report `commit_sha: null`. Running a gate never commits; a SHA here would credit this gate with work it did not do.
- **Verdict:** `references/schemas/verdict.md`, full shape.

Return the verdict JSON alone.
