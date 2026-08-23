# Preflight workflow

Preflight creates or resumes a run without executing repository procedures.

Render this skill-defined base task through
[general prompt rendering](../general-prompt-rendering.md), then append the stage
prompt below:

```markdown
# Inspect Expo upgrade preflight

- Repository root: <absolute-repository-root>
- Requested target SDK: <target-or-null-for-resume>
- Contract path: <repository-root>/expo-upgrade.yaml
- Contract validator: <skill-dir>/scripts/check-contract.mjs
- Harness/model policy: <skill-dir>/references/harness-and-model-selection.md
- Reports root: <repository-root>/reports

Return the normalized contract result, contract SHA-256, Git HEAD/branch/status,
matching unfinished-run identities, harness executable/version evidence, Herdr
agent kinds, and repository instruction/skill compatibility without changing
repository or run state.
```

## Appended stage prompt

```markdown
Read only the root contract, Git metadata/status, existing run-control paths, and
repository instruction and skill surfaces named by the harness/model policy. Run
the supplied contract validator and inspect Codex, Claude Code, and Herdr capability
metadata without launching an agent. Return the normalized contract output,
contract hash, repository root, HEAD/branch, exact status, matching unfinished-run
identities, and `harness_capabilities`. Do not inspect application source, execute
a repository procedure, edit files, change Git state, install compatibility files,
or create run state.

Write `findings.md` with these exact sections:

1. `Contract` — validator outcome, contract SHA-256, and normalized contract.
2. `Git` — repository root, HEAD, branch, and exact porcelain status.
3. `Unfinished runs` — every matching run identity, or `none`.
4. `Harness compatibility` — executable versions, Herdr kinds, applicable
   `AGENTS.md`/`CLAUDE.md` and skill surfaces, Claude eligibility, and exact
   fallback reasons.
5. `Result` — green when the inspection is complete and Codex child dispatch is
   available, otherwise blocked with the
   exact missing or invalid input and safe next action.

Then write `verdict.json` in the supplied verdict shape. Put the normalized
contract, Git values, unfinished-run identities, and `harness_capabilities` in
`result`; match its status, evidence, and blocker to `findings.md`; and return that
JSON alone.
```

1. For a fresh run, the main orchestrator requires one concrete target SDK. If it
   is absent or ambiguous, ask the user; never choose `latest`, `next`, or a
   canary. An explicit resume may use the target recorded in unfinished state.
2. The main orchestrator dispatches one fresh general preflight agent to run the
   contract validator and return its normalized JSON, contract hash, repository
   root, HEAD/branch, `git status --porcelain`, matching unfinished-run identities,
   and harness capability/compatibility evidence. The agent is read-only and does
   not inspect application source or execute a repository procedure.
3. From that verdict, the main orchestrator decides whether to resume or start
   fresh. Reconcile a selected unfinished run through
   [run state](../run-state.md); an in-flight mutation may own tracked changes or a
   commit whose verdict has not landed.
4. For a fresh run, require the returned Git status to be empty outside the report
   directory. Never stash, discard, or commit user work as a convenience.
5. The main orchestrator dispatches a fresh generic worker to record source and
   contract identities, create state, and copy the accepted YAML to
   `contract.snapshot.yaml`. Record the required main profile and returned harness
   capabilities at the same time. All procedures for this run come from that
   snapshot.

If a prior run's contract hash differs from current YAML, block the old run. Treat
the current YAML as a fresh contract and start a new run only; never update or
replan the prior run.
