# Step: Final report

SKILL.md step 8, phases `final-verify` then `report`. Close the run: one more
full gate pass, then one `report` worker that writes every closing artifact.
The orchestrator dispatches and records; the worker writes.

## Full re-verify

Re-run every contract gate against the finished branch's
HEAD — not just the ones that were ever red. Follow `references/gates.md`
for dispatch; a failure here re-enters `references/fix-loop.md`, and a
cluster that ends `blocked` there closes its lane rather than the run.

## Dispatch the report worker

Dispatch a `report` worker (cheap tier) once every cell that exists in the
re-verify matrix is green or blocked — a lane held open by a blocked cluster
never withholds the report; it lands in it. Brief it per
`references/agents/report.md`, which carries the whole
duty list below; hand it `target_sdk` and the learnings home,
`docs/upgrades/`.
Record its returned paths and commit SHA in the ledger, and read nothing it
read.

## What the worker produces

- **`report.json` and `summary.md`** in `reports/<run-id>/`, filled per `references/schemas/report.md`
  from the whole ledger — `state.json`, `events.jsonl`, and `journal.md`, where the run's narrative
  reasoning lives — plus the cluster findings, and nothing else. A cluster whose gate/app/platform
  cell was already red in `state.json.baseline` carries `pre_existing: true`; a red baseline cell is
  never attributed to the upgrade. A T3 cluster has no baseline cell to check — baseline skips the
  full suite (`references/baseline.md`) — so it carries `pre_existing: false` beside a `warning`
  follow-up saying the full suite was never baselined, which keeps "not proven pre-existing" from
  reading as "caused by the upgrade". Every blocked lane lands in `overview.lane_outcomes` as `blocked`,
  and its cluster in the catalog with the best diagnosis reached and a `recommended_next_step`.
- **The learnings doc** at `<learnings home>/sdk-<target>.md`: clusters that hit this repo, root
  causes, fixes that worked, repo gotchas, decisions and rationale — a letter to whoever runs the
  next upgrade, appended below every prior run's entry and every human-added note.
- **Structural changes flagged first.** Any cluster whose fix climbed the hoisting ladder
  (`references/monorepo-hoisting.md`) or touched shared/root config leads both `follow_ups[]` and the
  learnings doc — these are workspace-wide, not local, and the next reader must see them first.
- **Contract suggestions.** Where this run's decisions or discoveries would have been better served
  by a standing `expo-upgrade.yaml` entry (a gate correction, a missing capability), a
  `suggested_action` follow-up names the entry and recommends re-running the
  `expo-monorepo-upgrade-setup` skill (A10, A11).
- **`report.html` and the browser.** Every reporting surface is JSON first — `report.json` carries
  its content as data, and no finding exists in HTML alone. The bundled default template
  `scripts/render-report.mjs` renders `report.html` from it, drawing whichever sections the data
  holds, so every report this skill produces reads as one family. The worker then opens it in the
  default browser — `open` on darwin, `xdg-open` elsewhere. A renderer or an open that fails
  becomes a `follow_ups[]` warning rather than a failed report.
- **One commit** carrying the learnings doc and the report artifacts on `upgrade/sdk-<target>`, its
  SHA returned in the verdict.

## Branch state

Leave `upgrade/sdk-<target>` committed and clean, ready for a human to
open a PR. Hand the branch to the human, who opens the PR and pushes. Write
`phase_closed` for `report` and set `phase` to the terminal `complete`
(`references/schemas/ledger.md`), so a finished run never reads as an
interrupted one.

## Run close

Every terminal phase ends the same way, whichever reached it: `complete` after this
step, or `declined` at setup's scope check (`references/setup.md`). Setup's preflight
checklist opens the run by printing what it stands on; this closes it by printing what
it did. Print, in this order:

1. **One line per phase**, in phase order — `✓` for a phase that ran and closed, `✗` for
   one that ran and left a cell red or blocked, `−` for one that was skipped — each with
   a one-clause summary of what it settled: `✓ baseline — 25 gates measured, all green`.
2. **The counts**: gates green, red, blocked, and skipped; clusters opened and how many
   closed; commits landed on the branch.
3. **The banner**, alone on its line: `ORCHESTRATION: COMPLETE`, or
   `ORCHESTRATION: COMPLETE WITH BLOCKED LANES: <n>` where any lane closed short, or
   `ORCHESTRATION: DECLINED — <reason>` from `state.json.decline_reason`.
4. **The artifact paths**, each openable as printed: `report.html`, `summary.md`, the
   learnings doc, and `journal.md`.

A declined run holds no gate, cluster, or report to name: it prints the one phase line
discovery reached, the banner, and `journal.md`, which is everything that exists.
