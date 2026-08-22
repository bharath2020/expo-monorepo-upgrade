# Closing a mutating phase

Any phase that changed the repo — the bump, and each loop that landed a fix —
closes the same way (A12). Load at every phase close.

Dispatch three audits over the phase's commits, `last_checkpoint_sha..HEAD`,
all at once and each blind to the others:

- two `reviewer` workers (`references/agents/reviewer.md`) — scope drift,
  weakened gates, convention violations, and every worker return that carried
  prose beside its verdict JSON;
- one `principles-auditor` (`references/agents/principles-auditor.md`) — the
  diffs judged against Set A and Set B, one principle at a time.

Three greens close the phase. Any red — even one against two greens — becomes
its own cluster and re-enters the fix loop at step 2
(`references/fix-loop.md`), because an audit that found something is cheaper to
act on than to argue with. Record each audit's `verdict` event and journal line
as usual.

## A phase that changed nothing

A loop that opened no clusters has no diff, so the second reviewer and the
principles auditor have nothing to read: one `reviewer` closes it, briefed to
confirm exactly that — no commit in the range, HEAD standing where the previous
phase left it, and `git status --porcelain` clean. That confirmation is the
audit's green. A dirty tree or a moved HEAD is a red audit: something landed
that no cluster accounts for, so it becomes a cluster now, and its fix closes
under all three.
