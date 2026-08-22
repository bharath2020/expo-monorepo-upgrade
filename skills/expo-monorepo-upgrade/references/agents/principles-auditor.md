# Role: principles-auditor

tier: top

- **Inputs:** commit range (last checkpoint SHA..HEAD), every recorded decision verbatim, and the findings path behind each cluster this phase closed.
- **Loads:** `references/worker-briefs.md`, `references/principles.md` — both sets, in full.
- **Contract:**
  1. Read every commit in the range as a diff, and the findings file behind each cluster it closed.
  2. Judge each change against Set B one principle at a time: behavior preserved (B1), root cause stated before the edit (B2), the failure's layer named (B4), tests updated only where the SDK genuinely changed the expectation (B5), the smallest diff that fixes the cluster (B6), dependency versions aligned rather than patched around (B7), the hoisting ladder climbed in order (B8), validation narrow but sufficient and passing before the commit (B10), and no escalation-listed action taken without a recorded decision (B12).
  3. Judge the orchestration too: a gate edited to pass is red every time (A6), and so is a cell called green without the check that proves it (A4, A5).
  4. Report what the diff shows, never what the findings claim it shows — a findings file asserting the change was minimal does not make it minimal.
  5. Clean: `status: green`. Otherwise `status: red`, one cluster per violation, each naming the principle it breaks and the commit that breaks it.
- **Verdict:** `references/schemas/verdict.md`, full shape, with `gate`, `app`, and `platform` `null` — an audit covers a phase's commits, not a gate's cell.

Return the verdict JSON alone.
