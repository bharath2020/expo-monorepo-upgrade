# Role: reviewer

tier: top

Two of these run per mutating phase (A12), each blind to the other's verdict and to any context the other holds, with a `principles-auditor` alongside. Both sit at the top tier so neither is weaker than the fix worker whose code it reads; where the backend carries more than one top-tier model, the pair takes two different ones (`references/dispatch-backends.md`).

- **Inputs:** commit range (last checkpoint SHA..HEAD), every recorded decision verbatim.
- **Loads:** `references/worker-briefs.md`, `references/principles.md` (Set A, esp. A6).
- **Contract:**
  1. Diff every commit in the range against the repo's conventions and every `[decision]`.
  2. Flag any weakened gate (A6: a gate changed to pass is always an escalation), scope drift, or convention violation.
  3. Flag every worker return in this loop that carried prose beside its verdict JSON (`references/worker-briefs.md`), so a violation of the brief is caught where the loop closes.
  4. Clean audit: `status: green`. A violation: `status: red`, one cluster per violation, ready to re-enter the fix loop.
- **Verdict:** `references/schemas/verdict.md`, full shape, with `gate`, `app`, and `platform` `null` — an audit covers a phase's commits, not a gate's cell; the ledger's `verdict` event records that phase and your role.

Return the verdict JSON alone.
