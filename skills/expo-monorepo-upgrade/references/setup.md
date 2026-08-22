# Step: Setup

Capture the requested target, detect a resume, create the run's on-disk home, then check
preconditions with the ledger already in place to hold their answers.

## Preflight reads

Run the five read-only checks `references/orchestration-model.md`'s bounded exception allows here,
and nothing else: the root `expo-upgrade.yaml` — the contract check below; `git status
--porcelain`; whether workers can load the `expo-upgrade` skill — an `expo-upgrade` directory
under any of `~/.claude/skills`, `~/.agents/skills`, `<repo>/.claude/skills`,
`<repo>/.agents/skills`; the current `expo` range; and the `reports/` scan resume detection needs
below. Discovery owns every other repo read.

**Contract check.** The repo contract is `expo-upgrade.yaml` at the repo root.
Absent, or present but unparseable: refuse the run before
creating anything — print that this repository is not set up for an upgrade and that the
`expo-monorepo-upgrade-setup` skill checks every prerequisite, asks for what the repo cannot
answer itself, and writes the contract. Nothing else runs. Present and parseable: discovery
validates it in full at step 2 (`references/discovery.md`), and it is what the run dispatches from.

Read the `expo` range from the root manifest, or — when the root declares none, the ordinary shape
for a workspace monorepo whose apps each carry their own `expo` — from the first workspace app
that declares one. The value is advisory: it names what "the next SDK" means here, while discovery
settles `target` for real (`references/discovery.md`).

Zero `expo` across the root and every workspace manifest settles the scope question: decline
straight from this read, dispatching no worker at all. Set `phase` to the terminal `declined`
with the reason in `decline_reason` (`references/schemas/ledger.md`), write its journal line, and
print the reason — "no Expo app found under `<workspaces>`; this skill upgrades Expo SDKs only" —
with any alternative tooling named. An ambiguous read — an unreadable manifest, a workspace glob
matching nothing — still dispatches discovery, whose index-vs-tree check owns it.

Print the checklist before going further, one line per check with the verdict it returned —
contract found or missing, clean or dirty, loadable or missing, found or none, resume found or
fresh — while the run can
still be stopped on what it shows.

## Argument capture

Record the target exactly as asked in `state.json.target_requested`; discovery resolves it to a
concrete SDK version (`references/discovery.md`).

- No argument means `next`, the stable release after the current SDK; `55` is an explicit numeric
  target, `latest` the newest stable at run time, `canary` the canary channel.
- A gap between current and target (e.g. current 53, target 55) runs as sequential N→N+1 full
  cycles — each intermediate completes its own steps 2–8 first. Give each cycle its own run-id.

## Resume detection

Before creating a new run, check `reports/` for a ledger (`state.json`) whose `target_requested`
matches this run's and whose `phase` sits short of the terminals `complete` and `declined`. When
found, offer it; on accept, follow the resume procedure in `references/schemas/ledger.md`. A
`run-*` directory holding no `state.json` is an abandoned run: ignore it for resume, and never
reuse its id — on a collision, suffix the new id `-2`.

A `state.json` that parses but omits any field the match tests — `target_requested`, `phase` —
predates this schema and cannot be matched: pass it over, start a fresh run, and name what you
passed over.

## Run creation

On a fresh run, mint a run-id `run-<UTC-timestamp>` (e.g. `run-2026-08-14T19-05Z`) and create
`reports/<run-id>/`. Initialize `state.json` with `run_id`, `target_requested`, `target: null`,
`phase: "discovery"`, `decline_reason: null`, `last_heartbeat: null`, and empty
`matrix`/`baseline`/`clusters`/`attempts`/`builds`/`budgets`/`flakes`/
`open_questions`/`decisions`/`checkpoints`. Start `events.jsonl` and `journal.md` empty.

Then print where this run can be watched: `tail -f reports/<run-id>/journal.md` for the narrative,
`reports/<run-id>/state.json` for current truth, and the `report.json`, `summary.md`, and
`report.html` written beside them at the close. Under the `herdr` backend print the workspace id and
label where the first dispatch mints them (`references/dispatch-backends.md`).

## Preconditions

Check both with the ledger in place, so every escalation lands in `open_questions` per
`references/orchestration-model.md`.

1. **Clean git tree.** A non-empty `git status --porcelain` escalates with
   `options: ["commit", "stash", "discard", "abort"]` and `commit` as the recommendation. The
   first three hand back a clean tree and the run continues; `abort` ends it before discovery.
2. **`expo-upgrade` skill availability.** When workers cannot load it, escalate with
   `options: ["install", "proceed", "abort"]` and the install command
   `npx skills@latest add expo/skills --skill expo-upgrade` as the recommendation. The bump
   runs either way — its procedure comes from the contract (`references/bump.md`) — so
   `proceed` costs only what the skill adds elsewhere: discovery resolves the target from the
   registry alone, and fix workers work without its migration guidance.

Both checks ask out loud; neither resolves itself. Both precede the first
dispatch, so there is no independent lane to keep running: an unanswered question stays in
`open_questions` and holds the run at setup until it lands.

Record any answer given here in `decisions`; every worker brief carries `state.json.decisions`
verbatim (`references/orchestration-model.md`), so it reaches every later worker.

## Hand-off

Continue at `references/discovery.md`.
