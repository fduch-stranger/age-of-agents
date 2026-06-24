# Suggested Commands

Install dependencies:
- `npm install`

Run locally:
- `npm run demo` - starts server in demo mode and Vite client, usually at `http://localhost:5173`.
- `npm run dev` - starts server against real local session transcripts and Vite client.
- `npm run dev -w @agent-citadel/server -- --demo` - server only in demo mode.
- `npm run dev -w @agent-citadel/client` - client only.

Test and build:
- `npm test` - runs server tests then client tests.
- `npm run test -w @agent-citadel/server` - server Vitest suite.
- `npm run test -w @agent-citadel/client` - client Vitest suite.
- `npm run build` - client production build plus bundled CLI/server build.
- `npm run build:web` - client build only.
- `npm run build:server` - bundled server/CLI build only.
- `npm run build -w @agent-citadel/server` - server TypeScript no-emit check.
- `npm run build -w @agent-citadel/client` - client TypeScript no-emit plus Vite build.

Useful Darwin/shell commands:
- `rg --files` and `rg "pattern"` for fast search.
- `git status --short`, `git diff`, `git diff --stat` for worktree checks.
- `find packages -maxdepth 3 -type f | sort` for a quick package file map.