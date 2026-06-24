<div align="center">

# 🏰 Age of Agents

**Watch your AI coding sessions grow a peaceful pixel-art realm.**

Every Claude Code, Codex, OpenCode or Koda session becomes a settler walking out of the keep.
The tool it runs decides which workshop it visits, subagents become workers,
and tokens fill the storehouse — a calm, Age-of-Empires-style kingdom of your work.
No combat, just a quiet realm you can watch at a glance.

[![npm version](https://img.shields.io/npm/v/age-of-agents?color=6e9b46&label=npm&logo=npm)](https://www.npmjs.com/package/age-of-agents)
[![License: MIT](https://img.shields.io/badge/License-MIT-e0b64a.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%E2%89%A522-339933?logo=node.js&logoColor=white)
![PixiJS](https://img.shields.io/badge/PixiJS-v8-e91e63)

[**▶ Live site**](https://agentsmill.github.io/age-of-agents/) · [Quick start](#-quick-start) · [How it works](#-how-it-works) · [Architecture](#-architecture)

<img src="docs/screenshots/citadel-fantasy.png" alt="Age of Agents — peaceful fantasy realm" width="820">

</div>

---

## ✨ What is this?

Age of Agents (npm package **`age-of-agents`**) runs as a small local web app
alongside your normal CLI workflow. It watches your agent session transcripts and
renders them as a calm, real-time strategy realm:

- **Each session → a settler.** Start a Claude Code, Codex, OpenCode or Koda session and a settler walks out of the keep, carrying your prompt as its task.
- **Tools → workshops.** The settler heads to the building that matches the work — the forge for code edits, the mage tower for web research, the mine for the terminal.
- **Subagents → workers.** When a session spawns subagents (e.g. the Task tool), they appear as little workers around their settler.
- **Tokens → harvest.** Tokens read and produced fill the storehouse. Settlers ponder while thinking, rest when waiting, and stroll home when the day's work is done.
- **Two worlds.** Switch between a **fantasy** (top-down) and a **sci-fi** (isometric) realm on the fly.
- **Many projects → cities.** Each project becomes a city you can switch between; open one for an optional peek at [Beads](https://github.com/steveyegge/beads) tasks and a [Graphify](https://github.com/safishamsi/graphify) code map (see [Project intel](#-project-intel-optional)).

A glanceable, second-monitor view of what your agents are quietly up to.

## 🖼️ Gallery

| Fantasy | Sci-Fi |
| --- | --- |
| <img src="docs/screenshots/citadel-fantasy.png" alt="Fantasy realm" width="400"> | <img src="docs/screenshots/citadel-scifi.png" alt="Sci-fi colony" width="400"> |

**Session detail** — click a settler to inspect its task, token economy and live activity:

<div align="center">
<img src="docs/screenshots/citadel-session-panel.png" alt="Session detail panel" width="720">
</div>

## 🚀 Quick start

**Install — `npm i -g`.** Install it globally for the short `aoa` command; update with `npm update -g age-of-agents` when new versions ship:

```bash
npm i -g age-of-agents
aoa            # watches ~/.claude, ~/.codex, ~/.opencode & ~/.koda sessions (+ Claude in local Docker), prints the URL
aoa --demo     # calm demo mode (fake sessions)
aoa --open     # also open the browser
```

> The server binds to `127.0.0.1` only and never writes your transcripts anywhere — it just reads them locally and broadcasts game state over a local WebSocket. See [Privacy](#-privacy).

### From source

```bash
git clone https://github.com/agentsmill/age-of-agents
cd age-of-agents && npm install
npm run demo     # server (demo) + client (Vite) → http://localhost:5173
npm run dev      # visualize your real sessions
```

For focused local testing you can limit which session sources are watched:

```bash
AOA_SOURCES=codex npm run dev
AOA_SOURCES=claude,codex npm run dev
AOA_CODEX_LOOKBACK_DAYS=3 npm run dev
```

`AOA_SOURCES` accepts `claude`, `codex`, `opencode`, and `koda`.
Codex watches recent date folders by default instead of the entire historical
`~/.codex/sessions` tree.

### Local LLMs (Ollama, llama.cpp, vLLM, oMLX)

Local engines don't write transcripts, so Age of Agents captures them through a
small logging proxy. Two ways in:

**Ollama (terminal):**

```bash
aoa local llama3        # wraps `ollama run llama3` and logs it as a hero
```

The session shows up on the battlefield; the model appears in the **Modele** tab,
where you can assign a sprite (context window is read automatically from Ollama).

**Any OpenAI-compatible backend (llama.cpp / vLLM / oMLX / coding agents):**

```bash
LLM_BASE_URL=http://localhost:8000/v1 aoa local-proxy   # prints a proxy URL
```

Point your client's base URL at the printed proxy URL. Default backend base URLs:

| Backend   | Default base URL                |
|-----------|---------------------------------|
| Ollama    | `http://localhost:11434/v1`     |
| llama.cpp | `http://localhost:8080/v1`      |
| vLLM      | `http://localhost:8000/v1`      |
| oMLX      | `http://localhost:10240/v1`     |

Overrides: `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`.

## 🧭 How it works

```
agent session transcript ──▶ server (watcher + state machine) ──▶ WebSocket ──▶ client (PixiJS realm + HUD)
```

- The **server** tails JSONL transcripts, turns each line into a `Fact`, and runs a small per-session **state machine** (thinking / working / resting / idle / returning).
- It broadcasts a `HeroSnapshot` for every session over a WebSocket. The snapshot carries *what* the session is doing (`currentTool`, recent actions, tokens) — never raw coordinates.
- The **client** decides *where* each settler goes and renders the pixel-art realm, the HUD, the minimap and the side panel.
- **Running agents in Docker?** Local containers are auto-discovered (zero-config) and their Claude sessions read straight out of the container via `docker exec` — no image changes, no host bind-mounts required. Containerized settlers carry a 🐳 badge in the side panel. Disable with `AGENTCRAFT_DOCKER=0`.

## 🏛️ Project intel (optional)

Run several projects at once and each becomes its own **city** in the top bar — switch between them, or pick **All** to see every settler together. A city shows how many agents are active and which kind (Claude, Codex, OpenCode, Koda).

Select a city to open the **Architect's Hall**, a side panel that surfaces two optional, third-party signals about that project — read-only and entirely opt-in:

- **📜 Beads** — open tasks from [Beads](https://github.com/steveyegge/beads), an AI-native issue tracker that lives in your repo. Age of Agents reads `.beads/issues.jsonl` (falling back to `bd list --json`). Turn it on in a project with `bd init`.
- **🌳 Graph** — a code knowledge graph: symbol, edge and community counts plus the most-connected "god-nodes". Age of Agents reads `graphify-out/graph.json`. Generate it with the **bundled, dependency-free generator** — run `npm run graphify` in a project (or `node scripts/graphify.mjs <dir>`) to scan relative imports and write `graphify-out/graph.json`. You can also use the external [Graphify](https://github.com/safishamsi/graphify) tool; the schema is the same.

Neither tool is bundled or required. If a project has no `.beads/` or `graphify-out/`, the panel just reads "not initialized"; it polls every few seconds, so intel appears as soon as the files do.

## 🎨 Themes

Two full art sets, switchable from the top bar:

- **Fantasy** — top-down: keep, mage tower, library, guild, market, mine, orchard & ponds.
- **Sci-Fi** — isometric: command center, hangars, drone factory, ore refinery, research lab on a calm Martian colony.

## 🧱 Architecture

A small npm-workspaces monorepo, published as the single `age-of-agents` CLI:

| Package | Stack | Responsibility |
| --- | --- | --- |
| `packages/shared` | TypeScript | WebSocket protocol types (`GameEvent`, snapshots) |
| `packages/server` | Node + Fastify + `ws` + SQLite | transcript watcher, state machine, hooks endpoint, demo generator, CLI |
| `packages/client` | Vite + React 19 + PixiJS v8 | the game realm, HUD, minimap, side panel |

```bash
npm test      # unit tests (server + client)
npm run build # production client + bundled CLI (dist/cli.js)
```

## 🔒 Privacy

- The server listens on `127.0.0.1` only — nothing is exposed to your network.
- Transcripts are read **locally and read-only**; their contents are never written to disk by Age of Agents or sent anywhere.
- Installing the optional Claude Code hooks modifies `~/.claude/settings.json` (a fast event channel). Demo mode touches nothing of yours.
- **Optional interactive mode (off by default).** You can let the panel answer Claude Code permission prompts and plan approvals via the local hooks. It stays `127.0.0.1`-only; with the mode off, Age of Agents remains a passive read-only observer. When on, an unanswered prompt (timeout or app closed) always falls back to the terminal — the app never auto-allows. "Always allow" rules live in `~/.age-of-agents/permission-policy.json`; the app never edits the permission rules in `~/.claude/settings.json`.
- **Optional: launch agents from the app (BETA — [setup guide](docs/launch-agent.md)).** With the Claude Agent SDK installed (`npm i @anthropic-ai/claude-agent-sdk`), a **🚀 Launch agent** button lets you start a Claude Code session from the panel — pick a folder, type a prompt, choose a permission mode. These app-owned sessions are real Claude Code runs (they use your account and tokens) and you answer their permission prompts, plan approvals and multiple-choice questions (a centered "agent question" modal) directly in the panel. The SDK is an optional dependency; without it the button is hidden and nothing changes.
  - **Auth for launching:** the Agent SDK authenticates from environment variables only — it does **not** read your interactive Claude Code login. To use your subscription, generate a long-lived token once with `claude setup-token`, then start the app from a shell where `CLAUDE_CODE_OAUTH_TOKEN` is set (and `ANTHROPIC_API_KEY` is unset, or it takes precedence). Without it, launches fail with `401 Invalid authentication credentials`; the launch dialog warns when no auth is present.

## 🛡️ Security

The server binds to `127.0.0.1` only and is built for local use. It defends against the realistic threat — a malicious web page in your browser (a "drive-by" that scripts `localhost`) — with two layers:

- **Origin allowlist.** WebSocket and state-changing HTTP requests from a non-local origin are rejected (`403`). A cross-origin page always sends an `Origin` header, so it cannot connect or post.
- **Session token.** A per-machine token in `~/.age-of-agents/session-token` (`0600`) is required for the WebSocket handshake and for sensitive endpoints (launch/stop/message, hook install/uninstall, config writes, `/fs/list`). The app fetches it from `/session-token`, which is only served to allowlisted origins. Installed hooks and local tools keep working with no setup — the token is auto-created on first run.

`/fs/list` (the folder picker) is confined to your home directory. The server refuses to bind to a non-loopback host unless you explicitly set `AOA_ALLOW_REMOTE=1`.

**Honest boundaries:** loopback is not isolated per user, so this does not fully protect against another user on a shared machine, and a process running as you can read the token file. Those are out of scope for a local-first tool.

## 🎭 Assets

All pixel-art assets in `packages/client/public/assets/` were **generated by the author with [PixelLab](https://pixellab.ai)** and are the author's own work — released here under the same MIT license as the code. Without any assets the game still runs on procedurally generated placeholders.

`assets-manifest.json` + `scripts/download-assets.mjs` are an **optional** helper for swapping in alternative third-party packs locally; those packs are never committed (some forbid redistribution) and are not needed to run the game.

## 🤝 Contributing

Issues and PRs are welcome. To get going: `npm install`, then `npm run demo` to see the realm, and `npm test` before opening a PR.

## 📜 License

[MIT](LICENSE) © Mateusz Pawelczuk. Art assets generated with PixelLab, redistributed under MIT per PixelLab's Terms of Service.

## 🙏 Acknowledgements

Inspired by [AgentCraft](https://www.getagentcraft.com). Built with [PixiJS](https://pixijs.com), [React](https://react.dev), [Fastify](https://fastify.dev) and [PixelLab](https://pixellab.ai).
