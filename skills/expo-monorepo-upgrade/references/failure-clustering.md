# Failure clustering

## Categorization

Consider:

- Same app, platform, procedure, and runtime phase.
- Same underlying failure mechanism, not merely similar wording.
- Same affected API, symbol, configuration, or runtime behavior.
- Same repair strategy or mechanical transformation.
- Whether one repair and authoritative validation can prove every occurrence.
- Expected behavioral risk and blast radius.
- When uncertain, keep failures separate and use the higher risk tier.
- Renamed diagnostics for the same target remain one cluster.

## LOW

Mechanical changes with no intended runtime behavior change:

- A direct, one-for-one replacement documented in the target SDK's changelog,
  official upgrade guide, or migration notes.
- Removed or renamed Gradle or build-tool APIs.
- Repository declarations such as `jcenter()`.
- Build properties and configuration keys.
- Mechanical dependency or version alignment.

Record the authoritative source and prescribed replacement. Group multiple targets
only when they require the exact same documented or mechanical transformation.

## MEDIUM

Source or API adaptations intended to preserve existing behavior:

- TypeScript or native API signature changes.
- Removed exports or renamed properties without a documented direct replacement.
- Multiple call sites affected by one dependency API change.
- Narrow compatibility adaptations.

Group only when evidence proves the same root cause and repair strategy.

## HIGH

Behavior-sensitive or environment-sensitive changes:

- Runtime behavior.
- Lifecycle, recycling, or state management.
- Accessibility.
- Threading or concurrency.
- Measurement, layout, or rendering.
- Architecture flags or native initialization.
- Test expectations.
- Credentials or environment configuration.

Never group distinct repair targets.

## Rules

- Repeated evidence for the same target is one cluster at any tier.
- Same package or tool does not imply the same cluster.
- Different removed APIs remain separate.
- Risk tier permits grouping; it does not prove failures belong together.
- A mixed-risk cluster uses the highest applicable tier.
- Do not weaken repair, review, validation, or checkpoint gates for grouped failures.
