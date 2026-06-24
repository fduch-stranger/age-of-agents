# Project Overview

Age of Agents is an npm-workspaces TypeScript monorepo for a local browser visualization of AI agent sessions as a peaceful pixel-art RTS realm. It watches Claude/Codex/OpenCode/Koda transcript/session data, turns it into world/session state on a local server, and renders a real-time PixiJS/React HUD game view in the client.

Main packages:
- `packages/shared`: shared TypeScript protocol/domain types such as `GameEvent`, `HeroSnapshot`, building ids, mapping rules, and arsenal types.
- `packages/server`: Node server using Fastify, `ws`, chokidar, optional SQLite (`better-sqlite3`), state machine, transcript watcher, hooks and config routes, CLI entrypoints.
- `packages/client`: Vite + React 19 + PixiJS v8 app, Zustand store, canvas renderer, HUD panels, themes, mapping/model editors, terrain/building/unit systems.

Assets live under `packages/client/public/assets/{fantasy,scifi}` and helper scripts live under `scripts/`. The published CLI commands are `age-of-agents` and `aoa`, bundled into `dist/cli.js`.