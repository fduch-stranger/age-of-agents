# Agent Instructions

> **Context Note**: You are operating in the Age of Agents workspace.

- **Session Start**:
  1. Activate this project with Serena when the activation tool is available.
  2. Read Serena initial instructions.
  3. List available Serena memories before relying on remembered project context.

- **Token Optimization & Efficiency**:
  - Prefer targeted symbolic tools over full file reads.
  - Start with file or symbol overviews, then expand to method/function bodies only as needed.
  - Do not re-read whole files when a symbol map, targeted range, or previous read already provides the needed context.

- **Discovery & Search**:
  - Prefer symbolic and indexed tools that return symbols, references, structure, and typed locations.
  - Use Serena `jet_brains_*` symbolic tools for file outlines, symbols, declarations, references, implementations, and hierarchy when available.
  - Use indexed IDE search tools such as `search_symbol`, `search_text`, and `search_regex` for project-wide lookup.
  - Use Serena pattern search when custom regex context is needed.
  - Use raw `rg` for docs, fixtures, snapshots, generated text, and quick path discovery.

- **Code Reading & Exploration**:
  1. Overview: map file-level symbols first.
  2. Targeted read: inspect the specific class/function/body needed.
  3. Full read: use only when symbolic or targeted reads leave ambiguity.
  - For cross-file behavior, find declarations, references, usages, or implementations before changing contracts.

- **Modification & Refactoring**:
  - Use refactoring-aware tools for code symbol renames, moves, and safe deletes when available.
  - Do not rename programmatic symbols with text replacement.
  - Prefer structured/symbolic edits for whole functions/classes.
  - Use `apply_patch` for manual scoped edits.
  - Keep edits close to the requested behavior.

- **Project Shape**:
  - `packages/server`: Fastify server, source watchers, transcript parsers, state machine, routes.
  - `packages/client`: Vite React client, Pixi game view, HUD, Zustand stores.
  - `packages/shared`: protocol types, model registry, building mapping, validation.
  - `docs/superpowers`: implementation plans and specs.

- **Architecture Rules**:
  - Normalize agent-specific transcript formats in `packages/server/src/sources/*`.
  - Keep raw CLI/tool names out of client UI when parser normalization can produce canonical names.
  - Put shared protocol and config types in `packages/shared/src/index.ts`.
  - Keep session behavior in `packages/server/src/state-machine.ts`.
  - Keep persisted config loading/upgrades in server/client config stores, not in UI components.
  - Preserve user-saved config compatibility when defaults change.

- **Serena Memory Hygiene**:
  - Treat source code and committed docs as the source of truth when memory conflicts with the repo.
  - Update Serena memory after discovering durable project facts, architectural decisions, recurring gotchas, or workflow rules that future sessions would otherwise need to rediscover.
  - Do not store secrets, tokens, credentials, personal data, temporary task status, raw logs, or large copied docs in memory.
  - Keep memory entries concise, dated when useful, and linked to relevant repo files or docs.
  - Prefer updating an existing memory over creating duplicates.
  - Before final completion, consider whether significant code or workflow changes require a memory update.

- **Execution & Validation**:
  - After code edits, use inspections/problems tools (`get_file_problems`) on touched TypeScript files when available.
  - Run focused tests before broad verification:
    - Server: `npm test -w @agent-citadel/server -- test/<file>.test.ts`
    - Client: `npm test -w @agent-citadel/client -- tests/<file>.test.ts`
  - Before completion run:
    - `npm test`
    - `npm run build`

- **UI Verification**:
  - For visible client behavior, run or reuse `npm run dev`.
  - Verify the app at `http://localhost:5173/`.
  - Verify the API at `http://127.0.0.1:8123/health`.
  - Reload the browser after server/client config changes.

- **Git**:
  - Keep commits focused and reviewable.
  - Do not revert user changes unless explicitly requested.
  - Keep generated build output out of commits unless the project explicitly requires it.

<!-- SourceTree push smoke tests need a real commit; an up-to-date push only checks credential lookup. -->
