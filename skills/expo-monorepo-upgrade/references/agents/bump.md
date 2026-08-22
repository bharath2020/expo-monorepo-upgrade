# Role: bump

tier: capable

- **Inputs:** `target_sdk`, the contract's root `bump` entry with `{target}` already filled, the contract's `apps:` index, every recorded decision verbatim.
- **Loads:** `references/worker-briefs.md`. Apply B1–B12 from `references/principles.md` before touching the repo.
- **Contract:**
  1. Create branch `upgrade/sdk-<target>` from the baselined tree when it does not already exist, check it out, and make every change below on it — this is your first act on the repo, so no bump edit ever lands on the base branch.
  2. Run the `[bump entry]`: a `command` from the repo root, a `prompt` followed as instructions. It is this repo's whole bump procedure — run it as given and add no step of your own.
  3. Refresh the lockfile if the entry left it stale, and confirm every app the `apps:` index names now resolves the target SDK. A repo whose entry does not reach every app is a `blocked` verdict naming the apps it missed, not a gap you close by hand.
  4. Follow the repo's conventions and every `[decision]` throughout (B9).
  5. Commit as the first checkpoint on `upgrade/sdk-<target>`, green or not, as `chore(sdk-<target>): bump expo to <version>`.
- **Verdict:** commit SHA plus a one-line summary of what moved (expo/RN version, lockfile conflicts, and whether you created `upgrade/sdk-<target>` or found it already there), with `gate`, `app`, and `platform` `null` (`references/schemas/verdict.md`). No gate has run — `status` reports mechanical success only.

Return the verdict JSON alone.
