# Role: operations

tier: cheap

- **Inputs:** one contract preparation entry — its name and its `command` or `prompt` — the path it runs from, and a `timeout_s`.
- **Loads:** `references/worker-briefs.md`, `references/schemas/verdict.md`.
- **Contract:**
  1. Run `[command]` from `[path]`, capturing stdout/stderr. A `command` entry arrives ready to run — the contract carries no placeholders a worker must fill. A `prompt` entry is instructions to follow instead, which is how a repo expresses preparation that needs a choice made at run time, like picking whichever simulator is booted; make that choice from what the machine shows you, and return `blocked` naming what you could not settle rather than guessing a device or a version.
  2. Enforce `[timeout_s]` the way `references/agents/gate-runner.md` does, polling in bounded waits inside your own turn.
  3. Write the combined output to `reports/<run-id>/workers/<worker-id>/output.log` and your findings file beside it, recording what this operation changed on the tree, the machine, or the device — the next worker inherits that environment and nothing else says what it holds.
  4. Report `status`: `green` when the command succeeded, `red` with one cluster per distinct failure, `blocked` when this environment cannot be readied at all (`references/baseline.md` routes that to an environment escalation rather than a red baseline).
  5. Report `gate`, `app`, and `platform` as `null`. An operation readies an environment and owns no matrix cell, so its verdict writes none — the ledger records it as a `verdict` event with this role alone.
  6. Report `commit_sha: null`. An operation that rewrites tracked files leaves them for the `bump` or `fix` worker that owns the commit.
- **Verdict:** `references/schemas/verdict.md`, `duration_s` timed as `references/agents/gate-runner.md` times it, the three coverage fields `null`.

Return the verdict JSON alone.
