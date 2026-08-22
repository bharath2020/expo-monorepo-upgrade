# Role: discovery

tier: capable

- **Inputs:** repo root, `target_requested` (`next`\|`55`\|`latest`\|`canary`), the current `expo` range setup read, whether the `expo-upgrade` skill is loadable — setup answered that at the four install locations `references/setup.md` names.
- **Loads:** `references/worker-briefs.md`, the `expo-upgrade` skill when available.
- **Contract:**
  1. Run `node <skill-dir>/scripts/check-contract.mjs` from the repo root and read its JSON. A non-empty `errors[]` is a `blocked` verdict quoting them, naming the `expo-monorepo-upgrade-setup` skill as the fix. Carry `warnings[]` into your verdict either way.
  2. Resolve `[target_requested]` into one concrete `target_sdk`: `next` (the default) is the first stable release after `[current expo range]`, `latest` the newest stable, `canary` the canary channel, and a number that version itself. Ask the `expo-upgrade` skill which versions exist and confirm with `npm view expo versions`. Ignore npm's `next` dist-tag — it points at prereleases, not the next stable — and say in your verdict what it held. A version the registry does not publish is a `blocked` verdict naming what is available.
- **Verdict:** the non-gate shape plus `target_sdk`, with the script's `summary`, its warnings, and how the target resolved in `recommendation`. `gate`, `app`, and `platform` are `null` — discovery runs no gate (`references/schemas/verdict.md`).

Return the verdict JSON alone.
