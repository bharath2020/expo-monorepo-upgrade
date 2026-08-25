# Harness and model selection

Herdr is always the transport. This policy selects the interactive agent harness,
model, and reasoning effort that Herdr starts for each bounded role. Resolve the
profile before rendering the brief; the worker never chooses its own profile.

The launcher starts the main orchestrator as Claude Code using `claude-opus-5` at
`high` reasoning from the target repository's direct parent. Record that launcher
profile before preflight. If it is absent or different, stop and ask the launcher
to start the required session rather than inferring or changing the active session.

## Capability preflight

Record executable versions, Herdr-supported agent kinds, and repository instruction
compatibility as `harness_capabilities`. Claude Code is eligible only when all
repository instructions and skills required by the selected brief will load in its
repository-root session:

- every applicable `AGENTS.md` is imported by a corresponding `CLAUDE.md`, or the
  same instructions are otherwise supplied by a recorded immutable input;
- every required repository skill is available from `.claude/skills` or
  `~/.claude/skills`, or the brief names an exact readable skill path;
- `claude` is available, Herdr reports support for `--kind claude`, and the
  selected model and effort are not excluded by configured policy.

Starting in the repository root does not make Claude Code load `AGENTS.md` or
`.agents/skills` by itself. Do not create compatibility files or install skills as
part of an upgrade run. When Claude compatibility is not proven, select the
declared Codex fallback before rendering the brief and record the evidence. If a
recorded profile later fails to launch, block with the exact launch result and
refresh capability evidence; do not silently choose another profile.

## Default profiles

Use these exact defaults and fallbacks:

| Profile id | Work | Preferred profile | Codex fallback |
| --- | --- | --- | --- |
| `main-orchestrator` | Main orchestrator | `claude / claude-opus-5 / high` | none; launcher requirement |
| `preflight` | Preflight inspection | `codex / gpt-5.6-terra / medium` | none |
| `cluster-dispatch` | Cluster dispatcher | `claude / claude-opus-5 / high` | none |
| `bump` | Repository bump | `claude / claude-opus-5 / high` | `codex / gpt-5.6-sol / high` |
| `observation` | Baseline, validation, smoke, full E2E, and authoritative rerun | `claude / claude-sonnet-5 / medium` | `codex / gpt-5.6-terra / medium` |
| `repair-1` | Repair attempt 1 | `codex / gpt-5.6-sol / high` | none |
| `repair-2` | Repair attempt 2 | `claude / claude-opus-5 / high` | `codex / gpt-5.6-sol / high` |
| `repair-3` | Repair attempt 3 | `claude / claude-fable-5 / high` | `codex / gpt-5.6-sol / xhigh` |
| `checkpoint` | Checkpoint | `codex / gpt-5.6-terra / medium` | none |
| `reporting` | Reporting | `codex / gpt-5.6-terra / medium` | none |
| `generic-mechanical` | Mechanical generic assignment | `codex / gpt-5.6-luna / low` | none |
| `generic-judgment` | Judgment-heavy generic assignment | `codex / gpt-5.6-terra / high` | none |

A generic worker remains generic. Choose its profile from the judgment in the
bounded assignment, not a worker subtype: prompt rendering, atomic state writes,
and literal queue persistence are mechanical; candidate or Git reconciliation and
ambiguous evidence binding are judgment-heavy.

## Repair and review independence

Repair attempt number determines its profile even when the new attempt exists to
address review feedback. A transport redispatch preserves the original harness,
model, and effort; it does not advance the repair profile.

After a green repair, assign the code review to the opposite model family from the
candidate author:

| Candidate author | `review-code` | `review-principles` |
| --- | --- | --- |
| Codex | `claude / claude-opus-5 / high` | `codex / gpt-5.6-terra / high` |
| Claude Code | `codex / gpt-5.6-sol / high` | `claude / claude-sonnet-5 / high` |

Use `review-code` and `review-principles` as the profile ids. When Claude is
ineligible, use `codex / gpt-5.6-sol / high` for code review and
`codex / gpt-5.6-terra / high` for principles review. Record that degraded
independence; never increase both reviewers to `xhigh` as compensation.

## Selection and escalation rules

For every dispatch, durably record a profile id, harness, exact model, effort,
candidate-author family when applicable, preferred or fallback status, selection
reason, and capability evidence paths. Include those values in the brief, verdict,
in-flight record, and report.

Do not choose `xhigh` or `max` ad hoc. The only automatic `xhigh` profile is the
declared Codex fallback for repair attempt 3. Any other escalation requires a
recorded human decision and a fresh substantive attempt; it never changes a live
session or an identical transport redispatch.

## Herdr launch arguments

Pass the resolved profile to the selected harness after Herdr's `--` separator:

```bash
rtk herdr agent start <agent-id> --kind codex --pane <pane-id> -- --model <model> -c model_reasoning_effort=<effort>
rtk herdr agent start <agent-id> --kind claude --pane <pane-id> -- --model <model> --effort <effort>
```

Use full model ids from the table, not family aliases or inherited user defaults.
