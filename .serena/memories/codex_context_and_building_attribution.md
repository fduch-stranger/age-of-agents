# Codex Context And Building Attribution

- Codex `event_msg.token_count.info.model_context_window` is model capacity, not current context usage. `packages/server/src/sources/codex.ts` should set `usage-total.context` from positive `last_token_usage.input_tokens` and keep capacity separate as optional `contextWindow`.
- Codex `type: "compacted"` records should not emit `turn-end`; compaction is a context-window event and real Codex sessions can continue work immediately afterward.
- State/social building attribution is centralized in `packages/shared/src/index.ts`: `homeBuildingForTheme`, `awaitingBuildingForTheme`, `completedBuildingForTheme`, `activityBuildingForHero`, and `activityBuildingForAction`. Client wrappers remain in `packages/client/src/game/home-building.ts` for existing imports.
- Building panel hero counts should use `activityBuildingForHero(...)` only for active, provable locations: working -> tool building, awaiting-input -> waiting building, idle/sleeping/returning -> undefined because physical location is tracked inside the client game view as `lastBuilding`, not in `HeroSnapshot`.
- Historical Codex stats in `packages/server/src/building-stats.ts` credit output deltas after `task_complete`/`turn_complete` to both theme resting buildings, currently `garden` and `hydroponics`, because `/building-stats` is not theme-aware.
