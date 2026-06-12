# Agent Citadel

Wizualizacja sesji agentów Claude Code jako gra RTS w pixel-arcie — inspirowana
[AgentCraft](https://www.getagentcraft.com). Każda sesja to bohater wychodzący
z twierdzy, subagenci to peony w kolorach drużyny, a typ używanego narzędzia
decyduje, do którego budynku jednostka maszeruje (kuźnia = edycja kodu,
wieża maga = research w sieci, kopalnia = terminal…).

Dwa motywy: **fantasy** (top-down) i **sci-fi** (izometria).

## Szybki start

```bash
npm install
npm run demo     # serwer w trybie demo + klient (Vite)
```

Tryb produkcyjny (obserwacja prawdziwych sesji Claude Code z `~/.claude/projects`):

```bash
npm run dev
```

## Assety

Surowych plików graficznych nie ma w repo (licencje Tiny Swords i CraftPix
zakazują redystrybucji). Pobierz zipy ze stron wymienionych w
`assets-manifest.json` do katalogu `downloads/` (nazwa: `<id>.zip`), potem:

```bash
npm run assets
```

Bez assetów gra działa na placeholderach generowanych programowo.

## Struktura

- `packages/shared` — typy protokołu WebSocket (GameEvent, snapshoty)
- `packages/server` — Node: watcher transkryptów, maszyna stanów, WS, hooki HTTP
- `packages/client` — Vite + React 19 + PixiJS v8: świat gry i HUD

## Atrybucja assetów

| Paczka | Autor | Licencja |
|---|---|---|
| Tiny Swords | Pixel Frog | custom free (bez redystrybucji) |
| Lucifer Collection | FoozleCC | CC0 |
| Wyrmsun collection | społeczność Wyrmsun | CC0 |
| Sci-Fi Mech Buildings | acdrnx | CC0 |
| Free Drones Pack | CraftPix | CraftPix free |
| Lunar Battle Pack | MattWalkden | CC0 |
