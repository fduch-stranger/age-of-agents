# Rejestr modeli — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Edytowalny rejestr modeli (sprite + nazwa + okno kontekstu) jako bliźniak `MappingConfig`, który naprawia błędne okno kontekstu paska w `SidePanel` i pozwala rozpoznać dowolny model (też Ollama/custom) z poziomu ustawień + JSON.

**Architecture:** Dwie tabele „pierwsze trafienie wygrywa" w `packages/shared` — `sprites[]` (tożsamość, ignoruje `[1m]`) i `windows[]` (pojemność, `[1m]` ma znaczenie) — z `validateModelConfig`/`resolveModel`. Persystencja na serwerze (`~/.age-of-agents/model-config.json`, `GET/PUT /model-config`), store kliencki Zustand z optymistycznym zapisem, wpięcie przez subskrypcję `useModels` (panel sesji → reaktywny re-render) i `resolveModelLive` (ticker gry). UI: nowa zakładka w `SettingsPanel`.

**Tech Stack:** TypeScript monorepo (npm workspaces), React + Zustand (klient), Fastify (serwer), vitest. Spec: [docs/superpowers/specs/2026-06-19-model-registry-settings-design.md](../specs/2026-06-19-model-registry-settings-design.md).

**Konwencje testów:** runner = vitest. Pakiet `shared` NIE ma własnych testów — jego logikę testujemy przez pakiet klienta (re-eksport `theme/models.ts`), zgodnie z istniejącym `packages/client/tests/mapping.test.ts`. Pojedynczy plik: `npm run test -w @agent-citadel/<pkg> -- <wzorzec>`.

---

## Task 0: Scal pasek kontekstu na `main` (prerekwizyt)

Rejestr buduje się na maina, który zawiera już `HeroSnapshot.contextTokens` i `ContextBar`. Gałąź `feat/context-bar-and-scroll` nie nachodzi na pliki nowego rejestru ani na świeży commit specu — merge jest czysty.

**Files:** brak edycji plików — operacje git.

- [x] **Step 1: Upewnij się, że jesteś na main z czystym drzewem dla plików gałęzi**

Run: `git -C "/Users/mpawelczuk/RTS agents" checkout main && git status`
Expected: na `main`; ewentualne lokalne zmiany dotyczą tylko `.claude/launch.json` / `docs/index.html` (gałąź ich nie rusza).

- [x] **Step 2: Potwierdź brak konfliktów (merge-tree)**

Run: `git merge-tree $(git merge-base main feat/context-bar-and-scroll) main feat/context-bar-and-scroll | grep -iE "CONFLICT|changed in both" || echo "NO CONFLICTS"`
Expected: `NO CONFLICTS`.

- [x] **Step 3: Scal gałąź (merge commit, BEZ publikacji)**

```bash
git merge --no-ff feat/context-bar-and-scroll -m "merge: pasek kontekstu + scroll → main (przed rejestrem modeli)"
```
Expected: merge zakończony; pojawiają się `packages/client/src/hud/ContextBar.tsx`, `context-bar.ts`, `HeroSnapshot.contextTokens`. Wersja w `package.json` = `0.3.5`. NIE tworzymy taga `v*` (publish.yml odpala tylko tag).

- [x] **Step 4: Sanity — build + testy przechodzą po merge**

Run: `npm run build && npm test`
Expected: build OK; wszystkie testy zielone (w tym `context-bar.test.ts`). ZROBIONE: 134 testy zielone, build OK, main @ 989fef0 (v0.3.5).

- [x] **Step 5: (commit już jest z merge — nic do dodania)**

---

## Task 1: Shared — typy, resolvery, walidacja, DEFAULT

**Files:**
- Modify: `packages/shared/src/index.ts` (dopisz blok rejestru modeli na końcu, po sekcji mappingu)
- Test: `packages/client/tests/models.test.ts` (logika shared testowana przez klienta)
- Modify: `packages/client/src/theme/models.ts` — **utwórz** (re-eksport, potrzebny do importu w teście i w komponentach)

- [ ] **Step 1: Utwórz re-eksport `theme/models.ts`**

Create `packages/client/src/theme/models.ts`:

```ts
/**
 * Re-eksport rejestru modeli z shared (bliźniak theme/mapping.ts). Trzyma importy
 * klienta przy jednej ścieżce '../theme/models'.
 */
export {
  SPRITE_IDS,
  isSpriteId,
  matchModel,
  resolveSprite,
  resolveContextWindow,
  resolveModel,
  DEFAULT_MODEL_CONFIG,
  validateModelConfig,
} from '@agent-citadel/shared';
export type {
  SpriteId,
  ModelMatch,
  SpriteRule,
  WindowRule,
  ModelConfig,
  ResolvedModel,
} from '@agent-citadel/shared';
```

- [ ] **Step 2: Napisz failing test `packages/client/tests/models.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  resolveModel,
  resolveSprite,
  resolveContextWindow,
  validateModelConfig,
  DEFAULT_MODEL_CONFIG,
  type ModelConfig,
} from '../src/theme/models';

describe('resolveContextWindow (DEFAULT)', () => {
  it('opus → 200k, opus[1m] → 1M (tag bije bazowy)', () => {
    expect(resolveContextWindow('claude-opus-4-8', DEFAULT_MODEL_CONFIG)).toBe(200_000);
    expect(resolveContextWindow('claude-opus-4-8[1m]', DEFAULT_MODEL_CONFIG)).toBe(1_000_000);
  });
  it('nieznany / brak modelu → fallback', () => {
    expect(resolveContextWindow('llama3.1:8b', DEFAULT_MODEL_CONFIG)).toBe(200_000);
    expect(resolveContextWindow(undefined, DEFAULT_MODEL_CONFIG)).toBe(200_000);
  });
});

describe('resolveSprite (DEFAULT)', () => {
  it('tożsamość stała niezależnie od [1m]', () => {
    expect(resolveSprite('claude-opus-4-8', DEFAULT_MODEL_CONFIG).sprite).toBe('opus');
    expect(resolveSprite('claude-opus-4-8[1m]', DEFAULT_MODEL_CONFIG).sprite).toBe('opus');
  });
  it('nieznany model → fallback sprite', () => {
    expect(resolveSprite('llama3.1:8b', DEFAULT_MODEL_CONFIG).sprite).toBe('sonnet');
  });
  it('zwraca nazwę wyświetlaną', () => {
    expect(resolveSprite('claude-sonnet-4-6', DEFAULT_MODEL_CONFIG).displayName).toBe('Sonnet 4.6');
  });
});

describe('resolveModel — dwie osie naraz', () => {
  it('opus[1m]: sprite opus + okno 1M', () => {
    const r = resolveModel('claude-opus-4-8[1m]', DEFAULT_MODEL_CONFIG);
    expect(r.sprite).toBe('opus');
    expect(r.contextWindow).toBe(1_000_000);
  });
});

describe('matching — pierwsze trafienie + case-insensitive', () => {
  it('exact i pattern, niezależnie od wielkości liter', () => {
    const cfg: ModelConfig = {
      sprites: [{ match: { kind: 'exact', id: 'my-model' }, sprite: 'haiku' }],
      windows: [{ match: { kind: 'pattern', pattern: 'MY' }, contextWindow: 333 }],
      fallback: { sprite: 'sonnet', contextWindow: 200_000 },
    };
    expect(resolveSprite('My-Model', cfg).sprite).toBe('haiku');
    expect(resolveContextWindow('xx-my-yy', cfg)).toBe(333);
  });
});

describe('validateModelConfig', () => {
  it('akceptuje DEFAULT', () => {
    expect(validateModelConfig(DEFAULT_MODEL_CONFIG).ok).toBe(true);
  });
  it('odrzuca zły sprite', () => {
    expect(validateModelConfig({ sprites: [{ match: { kind: 'pattern', pattern: 'x' }, sprite: 'nope' }], windows: [], fallback: { sprite: 'sonnet', contextWindow: 1 } }).ok).toBe(false);
  });
  it('odrzuca okno <= 0', () => {
    expect(validateModelConfig({ sprites: [], windows: [{ match: { kind: 'pattern', pattern: 'x' }, contextWindow: 0 }], fallback: { sprite: 'sonnet', contextWindow: 200_000 } }).ok).toBe(false);
  });
  it('odrzuca zły fallback', () => {
    expect(validateModelConfig({ sprites: [], windows: [], fallback: { sprite: 'nope', contextWindow: 1 } }).ok).toBe(false);
  });
  it('usuwa nadmiarowe pola', () => {
    const res = validateModelConfig({ sprites: [{ match: { kind: 'pattern', pattern: 'x' }, sprite: 'opus', evil: 1 }], windows: [], fallback: { sprite: 'sonnet', contextWindow: 200_000 } });
    expect(res.ok).toBe(true);
    if (res.ok) expect((res.config.sprites[0] as Record<string, unknown>).evil).toBeUndefined();
  });
});
```

- [ ] **Step 3: Uruchom — ma FAIL (brak eksportów)**

Run: `npm run test -w @agent-citadel/client -- models`
Expected: FAIL — `resolveModel`/`validateModelConfig`/`DEFAULT_MODEL_CONFIG` nie istnieją.

- [ ] **Step 4: Zweryfikuj okna kontekstu modeli Claude przez skill `claude-api`**

Wywołaj skill `claude-api` i potwierdź okna kontekstu dla aktualnych modeli (Opus 4.8, Sonnet 4.6, Haiku 4.5, Fable 5) oraz znaczenie tagu `[1m]`. Domyślne wartości poniżej (200k bazowo, 1M dla `[1m]`) odzwierciedlają dzisiejsze zachowanie paska — skoryguj liczby w `DEFAULT_MODEL_CONFIG`, jeśli referencja podaje inne.

- [ ] **Step 5: Dopisz blok rejestru na końcu `packages/shared/src/index.ts`**

Dodaj na końcu pliku (po istniejącej sekcji mappingu i statystyk):

```ts
// ── Rejestr modeli (DANE) — bliźniak MappingConfig ──────────────────────────
// Dwie osie z RÓŻNYM dopasowaniem: tożsamość (sprite + nazwa) łapie BAZOWY model
// i ignoruje tag [1m]; pojemność (okno kontekstu) honoruje [1m] (wariant 1M).
// Każda tabela: pierwsze trafienie wygrywa (kolejność = priorytet).

/** Pula dostępnych sprite'ów bohaterów — JEDNO źródło prawdy (klient importuje to). */
export const SPRITE_IDS = ['opus', 'sonnet', 'haiku', 'fable'] as const;
export type SpriteId = (typeof SPRITE_IDS)[number];

const SPRITE_ID_SET: ReadonlySet<string> = new Set(SPRITE_IDS);
/** Czy string jest znanym SpriteId (runtime guard dla walidacji). */
export function isSpriteId(value: unknown): value is SpriteId {
  return typeof value === 'string' && SPRITE_ID_SET.has(value);
}

/** Dopasowanie wpisu do stringa modelu w runtime. */
export type ModelMatch =
  | { kind: 'exact'; id: string }          // pełna równość (case-insensitive)
  | { kind: 'pattern'; pattern: string };  // podciąg (case-insensitive)

/** Reguła tożsamości: model → sprite (+ nazwa). Ignoruje [1m]. */
export interface SpriteRule {
  match: ModelMatch;
  sprite: SpriteId;
  displayName?: string;
}

/** Reguła pojemności: model → okno kontekstu w tokenach. [1m] ma tu znaczenie. */
export interface WindowRule {
  match: ModelMatch;
  contextWindow: number;
}

/** Edytowalny rejestr modeli (DANE, nie kod). */
export interface ModelConfig {
  sprites: SpriteRule[];
  windows: WindowRule[];
  fallback: { sprite: SpriteId; contextWindow: number };
}

/** Rozwiązane metadane modelu (do renderu). */
export interface ResolvedModel {
  sprite: SpriteId;
  displayName?: string;
  contextWindow: number;
}

/** Czy `match` trafia w string modelu (case-insensitive). */
export function matchModel(model: string, match: ModelMatch): boolean {
  const m = model.toLowerCase();
  if (match.kind === 'exact') return m === match.id.toLowerCase();
  return m.includes(match.pattern.toLowerCase());
}

/** Tożsamość: pierwszy trafiony SpriteRule; inaczej fallback.sprite. */
export function resolveSprite(
  model: string | undefined,
  cfg: ModelConfig,
): { sprite: SpriteId; displayName?: string } {
  if (model) {
    for (const r of cfg.sprites) {
      if (matchModel(model, r.match)) return { sprite: r.sprite, displayName: r.displayName };
    }
  }
  return { sprite: cfg.fallback.sprite };
}

/** Pojemność: pierwszy trafiony WindowRule; inaczej fallback.contextWindow. */
export function resolveContextWindow(model: string | undefined, cfg: ModelConfig): number {
  if (model) {
    for (const r of cfg.windows) {
      if (matchModel(model, r.match)) return r.contextWindow;
    }
  }
  return cfg.fallback.contextWindow;
}

/** Złączenie obu osi (wygoda konsumentów). */
export function resolveModel(model: string | undefined, cfg: ModelConfig): ResolvedModel {
  const { sprite, displayName } = resolveSprite(model, cfg);
  return { sprite, displayName, contextWindow: resolveContextWindow(model, cfg) };
}

/**
 * Wbudowany rejestr = dotychczasowe zachowanie paska (200k bazowo, 1M dla [1m])
 * wyrażone jako DANE + presety tożsamości. Wartości okien Claude potwierdzone
 * przez skill claude-api; modele nie-Claude lądują na fallbacku do konfiguracji.
 */
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  sprites: [
    { match: { kind: 'pattern', pattern: 'opus' }, sprite: 'opus', displayName: 'Opus 4.8' },
    { match: { kind: 'pattern', pattern: 'sonnet' }, sprite: 'sonnet', displayName: 'Sonnet 4.6' },
    { match: { kind: 'pattern', pattern: 'haiku' }, sprite: 'haiku', displayName: 'Haiku 4.5' },
    { match: { kind: 'pattern', pattern: 'fable' }, sprite: 'fable', displayName: 'Fable 5' },
  ],
  windows: [
    { match: { kind: 'pattern', pattern: '[1m]' }, contextWindow: 1_000_000 }, // tag 1M bije bazowe
    { match: { kind: 'pattern', pattern: 'opus' }, contextWindow: 200_000 },
    { match: { kind: 'pattern', pattern: 'sonnet' }, contextWindow: 200_000 },
    { match: { kind: 'pattern', pattern: 'haiku' }, contextWindow: 200_000 },
    { match: { kind: 'pattern', pattern: 'fable' }, contextWindow: 200_000 },
  ],
  fallback: { sprite: 'sonnet', contextWindow: 200_000 },
};

/** Waliduje surowy obiekt na ModelConfig. Buduje CZYSTY config (bez nadmiarowych pól). */
export function validateModelConfig(
  input: unknown,
): { ok: true; config: ModelConfig } | { ok: false; error: string } {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, error: 'Config musi być obiektem.' };
  }
  const obj = input as Record<string, unknown>;
  if (!Array.isArray(obj.sprites)) return { ok: false, error: 'Brakuje tablicy "sprites".' };
  if (!Array.isArray(obj.windows)) return { ok: false, error: 'Brakuje tablicy "windows".' };
  if (typeof obj.fallback !== 'object' || obj.fallback === null) {
    return { ok: false, error: 'Brakuje obiektu "fallback".' };
  }
  const fb = obj.fallback as Record<string, unknown>;
  if (!isSpriteId(fb.sprite)) return { ok: false, error: `Nieznany "fallback.sprite": ${String(fb.sprite)}.` };
  if (typeof fb.contextWindow !== 'number' || !(fb.contextWindow > 0)) {
    return { ok: false, error: 'Pole "fallback.contextWindow" musi być liczbą > 0.' };
  }

  const cleanMatch = (
    raw: unknown,
    where: string,
  ): { ok: true; match: ModelMatch } | { ok: false; error: string } => {
    if (typeof raw !== 'object' || raw === null) return { ok: false, error: `${where}: "match" nie jest obiektem.` };
    const mm = raw as Record<string, unknown>;
    if (mm.kind === 'exact') {
      if (typeof mm.id !== 'string' || !mm.id) return { ok: false, error: `${where}: "exact" wymaga niepustego "id".` };
      return { ok: true, match: { kind: 'exact', id: mm.id } };
    }
    if (mm.kind === 'pattern') {
      if (typeof mm.pattern !== 'string' || !mm.pattern) return { ok: false, error: `${where}: "pattern" wymaga niepustego "pattern".` };
      return { ok: true, match: { kind: 'pattern', pattern: mm.pattern } };
    }
    return { ok: false, error: `${where}: nieznany "match.kind" ${String(mm.kind)}.` };
  };

  const sprites: SpriteRule[] = [];
  for (let i = 0; i < obj.sprites.length; i++) {
    const raw = obj.sprites[i];
    if (typeof raw !== 'object' || raw === null) return { ok: false, error: `sprites[${i}]: nie jest obiektem.` };
    const r = raw as Record<string, unknown>;
    const m = cleanMatch(r.match, `sprites[${i}]`);
    if (!m.ok) return m;
    if (!isSpriteId(r.sprite)) return { ok: false, error: `sprites[${i}]: nieznany "sprite" ${String(r.sprite)}.` };
    const rule: SpriteRule = { match: m.match, sprite: r.sprite };
    if (r.displayName !== undefined) {
      if (typeof r.displayName !== 'string') return { ok: false, error: `sprites[${i}]: "displayName" musi być stringiem.` };
      rule.displayName = r.displayName;
    }
    sprites.push(rule);
  }

  const windows: WindowRule[] = [];
  for (let i = 0; i < obj.windows.length; i++) {
    const raw = obj.windows[i];
    if (typeof raw !== 'object' || raw === null) return { ok: false, error: `windows[${i}]: nie jest obiektem.` };
    const r = raw as Record<string, unknown>;
    const m = cleanMatch(r.match, `windows[${i}]`);
    if (!m.ok) return m;
    if (typeof r.contextWindow !== 'number' || !(r.contextWindow > 0)) {
      return { ok: false, error: `windows[${i}]: "contextWindow" musi być liczbą > 0.` };
    }
    windows.push({ match: m.match, contextWindow: r.contextWindow });
  }

  return { ok: true, config: { sprites, windows, fallback: { sprite: fb.sprite, contextWindow: fb.contextWindow } } };
}
```

- [ ] **Step 6: Uruchom — ma PASS**

Run: `npm run test -w @agent-citadel/client -- models`
Expected: PASS (wszystkie bloki).

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/index.ts packages/client/src/theme/models.ts packages/client/tests/models.test.ts
git commit -m "feat(shared): rejestr modeli (sprite/okno) — typy, resolvery, walidacja"
```

---

## Task 2: Serwer — persystencja `model-config.json`

**Files:**
- Create: `packages/server/src/model-config.ts`
- Test: `packages/server/test/model-config.test.ts`

- [ ] **Step 1: Napisz failing test `packages/server/test/model-config.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadModelConfig, saveModelConfig, invalidateModelConfigCache } from '../src/model-config.js';
import { DEFAULT_MODEL_CONFIG, type ModelConfig } from '@agent-citadel/shared';

function tmpPath(name = 'model-config.json'): string {
  return join(mkdtempSync(join(tmpdir(), 'aoa-model-')), name);
}

beforeEach(() => invalidateModelConfigCache());

const CUSTOM: ModelConfig = {
  sprites: [{ match: { kind: 'pattern', pattern: 'opus' }, sprite: 'opus' }],
  windows: [{ match: { kind: 'pattern', pattern: 'opus' }, contextWindow: 500_000 }],
  fallback: { sprite: 'sonnet', contextWindow: 200_000 },
};

describe('loadModelConfig', () => {
  it('brak pliku → DEFAULT', async () => {
    expect(await loadModelConfig(tmpPath())).toEqual(DEFAULT_MODEL_CONFIG);
  });
  it('poprawny plik → wczytany config', async () => {
    const p = tmpPath();
    writeFileSync(p, JSON.stringify(CUSTOM));
    expect(await loadModelConfig(p)).toEqual(CUSTOM);
  });
  it('uszkodzony JSON → DEFAULT', async () => {
    const p = tmpPath();
    writeFileSync(p, '{ nie json');
    expect(await loadModelConfig(p)).toEqual(DEFAULT_MODEL_CONFIG);
  });
  it('niepoprawny config (zły sprite) → DEFAULT', async () => {
    const p = tmpPath();
    writeFileSync(p, JSON.stringify({ sprites: [{ match: { kind: 'pattern', pattern: 'x' }, sprite: 'nope' }], windows: [], fallback: { sprite: 'sonnet', contextWindow: 1 } }));
    expect(await loadModelConfig(p)).toEqual(DEFAULT_MODEL_CONFIG);
  });
});

describe('saveModelConfig', () => {
  it('tworzy katalog, zapisuje, load oddaje nowy config', async () => {
    const p = join(mkdtempSync(join(tmpdir(), 'aoa-model-')), 'nested', 'model-config.json');
    const saved = await saveModelConfig(CUSTOM, p);
    expect(saved).toEqual(CUSTOM);
    expect(existsSync(p)).toBe(true);
    expect(JSON.parse(readFileSync(p, 'utf8'))).toEqual(CUSTOM);
    expect(await loadModelConfig(p)).toEqual(CUSTOM);
  });
  it('odrzuca niepoprawny config', async () => {
    await expect(saveModelConfig({ sprites: [], windows: [], fallback: { sprite: 'nope', contextWindow: 1 } } as unknown as ModelConfig, tmpPath())).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npm run test -w @agent-citadel/server -- model-config`
Expected: FAIL — `../src/model-config.js` nie istnieje.

- [ ] **Step 3: Utwórz `packages/server/src/model-config.ts`**

```ts
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { DEFAULT_MODEL_CONFIG, validateModelConfig, type ModelConfig } from '@agent-citadel/shared';

/**
 * Trwałość edytowalnego rejestru modeli. Lokalny serwer = źródło prawdy: plik
 * `~/.age-of-agents/model-config.json`. Brak/uszkodzony plik → DEFAULT
 * (serwer nigdy się nie wywala). Bliźniak mapping-config.ts. Cache keyowany ścieżką.
 */
export function defaultModelConfigPath(): string {
  return join(homedir(), '.age-of-agents', 'model-config.json');
}

const cache = new Map<string, ModelConfig>();

export function invalidateModelConfigCache(): void {
  cache.clear();
}

export async function loadModelConfig(path = defaultModelConfigPath()): Promise<ModelConfig> {
  const hit = cache.get(path);
  if (hit) return hit;

  let config: ModelConfig = DEFAULT_MODEL_CONFIG;
  try {
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
    const res = validateModelConfig(parsed);
    if (res.ok) config = res.config;
  } catch {
    /* brak pliku / zły JSON → DEFAULT */
  }
  cache.set(path, config);
  return config;
}

export async function saveModelConfig(
  config: ModelConfig,
  path = defaultModelConfigPath(),
): Promise<ModelConfig> {
  const res = validateModelConfig(config);
  if (!res.ok) throw new Error(res.error);

  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(res.config, null, 2), 'utf8');
  await rename(tmp, path); // zapis atomowy
  cache.set(path, res.config);
  return res.config;
}
```

- [ ] **Step 4: Uruchom — PASS**

Run: `npm run test -w @agent-citadel/server -- model-config`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/model-config.ts packages/server/test/model-config.test.ts
git commit -m "feat(server): persystencja model-config.json (load/save/cache)"
```

---

## Task 3: Serwer — trasy `GET/PUT /model-config` + rejestracja

**Files:**
- Create: `packages/server/src/model-routes.ts`
- Modify: `packages/server/src/server.ts:5` (import) i rejestracja w obu trybach
- Test: `packages/server/test/model-routes.test.ts`

- [ ] **Step 1: Napisz failing test `packages/server/test/model-routes.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerModelRoutes } from '../src/model-routes.js';
import { invalidateModelConfigCache } from '../src/model-config.js';
import { DEFAULT_MODEL_CONFIG } from '@agent-citadel/shared';

function tmpPath(): string {
  return join(mkdtempSync(join(tmpdir(), 'aoa-modelroutes-')), 'model-config.json');
}

beforeEach(() => invalidateModelConfigCache());

const CFG = {
  sprites: [{ match: { kind: 'pattern', pattern: 'opus' }, sprite: 'opus' }],
  windows: [{ match: { kind: 'pattern', pattern: 'opus' }, contextWindow: 500_000 }],
  fallback: { sprite: 'sonnet', contextWindow: 200_000 },
};

describe('registerModelRoutes — persist=true', () => {
  it('PUT zapisuje plik, GET zwraca zapis', async () => {
    const path = tmpPath();
    const app = Fastify();
    registerModelRoutes(app, { persist: true, modelConfigPath: path });

    const put = await app.inject({ method: 'PUT', url: '/model-config', payload: CFG });
    expect(put.statusCode).toBe(200);
    expect(JSON.parse(put.body)).toEqual(CFG);
    expect(existsSync(path)).toBe(true);

    const get = await app.inject({ method: 'GET', url: '/model-config' });
    expect(JSON.parse(get.body)).toEqual(CFG);
    await app.close();
  });

  it('PUT niepoprawny config → 400', async () => {
    const path = tmpPath();
    const app = Fastify();
    registerModelRoutes(app, { persist: true, modelConfigPath: path });
    const put = await app.inject({ method: 'PUT', url: '/model-config', payload: { sprites: [], windows: [], fallback: { sprite: 'nope', contextWindow: 1 } } });
    expect(put.statusCode).toBe(400);
    expect(JSON.parse(put.body).error).toBeTruthy();
    expect(existsSync(path)).toBe(false);
    await app.close();
  });
});

describe('registerModelRoutes — persist=false (demo)', () => {
  it('PUT waliduje + echo, nie zapisuje; GET zwraca DEFAULT', async () => {
    const path = tmpPath();
    const app = Fastify();
    registerModelRoutes(app, { persist: false, modelConfigPath: path });

    const put = await app.inject({ method: 'PUT', url: '/model-config', payload: CFG });
    expect(put.statusCode).toBe(200);
    expect(JSON.parse(put.body)).toEqual(CFG);
    expect(existsSync(path)).toBe(false);

    const get = await app.inject({ method: 'GET', url: '/model-config' });
    expect(JSON.parse(get.body)).toEqual(DEFAULT_MODEL_CONFIG);
    await app.close();
  });
});
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npm run test -w @agent-citadel/server -- model-routes`
Expected: FAIL — brak `model-routes.js`.

- [ ] **Step 3: Utwórz `packages/server/src/model-routes.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { DEFAULT_MODEL_CONFIG, validateModelConfig, type ModelConfig } from '@agent-citadel/shared';
import { loadModelConfig, saveModelConfig } from './model-config.js';

export interface ModelRoutesOptions {
  /** true → PUT zapisuje na dysk; false (demo) → tylko waliduje i echo. */
  persist: boolean;
  /** Ścieżka pliku gdy persist. Domyślnie ~/.age-of-agents/model-config.json. */
  modelConfigPath?: string;
}

/**
 * Rejestruje GET/PUT /model-config. Bliźniak registerMappingRoutes, ale BEZ
 * onSaved — okno kontekstu używane tylko na kliencie, więc serwer nie ma
 * cache'a zależnego od rejestru. PUT po prostu zapisuje.
 */
export function registerModelRoutes(app: FastifyInstance, opts: ModelRoutesOptions): void {
  app.get('/model-config', async () =>
    opts.persist ? loadModelConfig(opts.modelConfigPath) : DEFAULT_MODEL_CONFIG,
  );

  app.put('/model-config', async (request, reply) => {
    if (!opts.persist) {
      const res = validateModelConfig(request.body);
      if (!res.ok) return reply.code(400).send({ error: res.error });
      return res.config;
    }
    try {
      return await saveModelConfig(request.body as ModelConfig, opts.modelConfigPath);
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : 'niepoprawny config' });
    }
  });
}
```

- [ ] **Step 4: Zarejestruj trasy w `packages/server/src/server.ts`**

Po linii `import { registerMappingRoutes } from './mapping-routes.js';` (`server.ts:5`) dodaj:

```ts
import { registerModelRoutes } from './model-routes.js';
```

W gałęzi demo, zaraz po `registerMappingRoutes(app, { persist: false });` (`server.ts:38`):

```ts
    registerModelRoutes(app, { persist: false });
```

W gałęzi realnej, zaraz po `registerMappingRoutes(app, { persist: true, onSaved: invalidateBuildingStatsCache });` (`server.ts:54`):

```ts
    registerModelRoutes(app, { persist: true });
```

- [ ] **Step 5: Uruchom — PASS**

Run: `npm run test -w @agent-citadel/server -- model-routes`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/model-routes.ts packages/server/src/server.ts packages/server/test/model-routes.test.ts
git commit -m "feat(server): trasy GET/PUT /model-config + rejestracja (demo/realny)"
```

---

## Task 4: Klient — store `useModels` + hydrate

**Files:**
- Create: `packages/client/src/model-store.ts`
- Modify: `packages/client/src/main.tsx`
- Test: `packages/client/tests/model-store.test.ts`

- [ ] **Step 1: Napisz failing test `packages/client/tests/model-store.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useModels, resolveModelLive } from '../src/model-store';
import { DEFAULT_MODEL_CONFIG, type ModelConfig } from '../src/theme/models';

const CUSTOM: ModelConfig = {
  sprites: [{ match: { kind: 'pattern', pattern: 'opus' }, sprite: 'haiku' }],
  windows: [{ match: { kind: 'pattern', pattern: 'opus' }, contextWindow: 500_000 }],
  fallback: { sprite: 'sonnet', contextWindow: 200_000 },
};

beforeEach(() => {
  useModels.setState({ models: DEFAULT_MODEL_CONFIG, modelsLoaded: false });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe('useModels store', () => {
  it('domyślnie DEFAULT_MODEL_CONFIG', () => {
    expect(useModels.getState().models).toEqual(DEFAULT_MODEL_CONFIG);
  });
  it('setModels aktualizuje stan i wysyła PUT /model-config', () => {
    const f = vi.fn(() => Promise.resolve(new Response('{}')));
    vi.stubGlobal('fetch', f);
    useModels.getState().setModels(CUSTOM);
    expect(useModels.getState().models).toEqual(CUSTOM);
    expect(f).toHaveBeenCalledWith('/model-config', expect.objectContaining({ method: 'PUT' }));
  });
  it('resetModels przywraca DEFAULT', () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}'))));
    useModels.setState({ models: CUSTOM });
    useModels.getState().resetModels();
    expect(useModels.getState().models).toEqual(DEFAULT_MODEL_CONFIG);
  });
  it('odrzucony PUT nie psuje stanu (optymistyczny zapis)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('net'))));
    useModels.getState().setModels(CUSTOM);
    await Promise.resolve();
    expect(useModels.getState().models).toEqual(CUSTOM);
  });
  it('hydrate wczytuje config z GET', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(CUSTOM)))));
    await useModels.getState().hydrate();
    expect(useModels.getState().models).toEqual(CUSTOM);
    expect(useModels.getState().modelsLoaded).toBe(true);
  });
  it('hydrate ignoruje niepoprawny config z serwera', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ sprites: [], windows: [], fallback: { sprite: 'nope', contextWindow: 1 } })))));
    await useModels.getState().hydrate();
    expect(useModels.getState().models).toEqual(DEFAULT_MODEL_CONFIG);
  });
});

describe('resolveModelLive', () => {
  it('używa aktualnego configu ze store', () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}'))));
    expect(resolveModelLive('claude-opus-4-8').sprite).toBe('opus'); // DEFAULT
    useModels.setState({ models: CUSTOM });
    expect(resolveModelLive('claude-opus-4-8').sprite).toBe('haiku'); // custom
    expect(resolveModelLive('claude-opus-4-8').contextWindow).toBe(500_000);
  });
});
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npm run test -w @agent-citadel/client -- model-store`
Expected: FAIL — brak `../src/model-store`.

- [ ] **Step 3: Utwórz `packages/client/src/model-store.ts`**

```ts
import { create } from 'zustand';
import {
  resolveModel,
  DEFAULT_MODEL_CONFIG,
  validateModelConfig,
  type ModelConfig,
  type ResolvedModel,
} from './theme/models';

/**
 * Store edytowalnego rejestru modeli. Lokalny serwer = źródło prawdy (plik), ale
 * klient trzyma optymistyczny cache, by świat reagował NATYCHMIAST: setModels
 * ustawia stan + localStorage + PUT w tle. Bliźniak mapping-store.ts.
 */
const STORAGE_KEY = 'age-of-agents.models';

function readCache(): ModelConfig {
  if (typeof localStorage === 'undefined') return DEFAULT_MODEL_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MODEL_CONFIG;
    const res = validateModelConfig(JSON.parse(raw));
    return res.ok ? res.config : DEFAULT_MODEL_CONFIG;
  } catch {
    return DEFAULT_MODEL_CONFIG;
  }
}

function writeCache(config: ModelConfig): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    /* quota / prywatny tryb → ignoruj */
  }
}

function putModels(config: ModelConfig): void {
  if (typeof fetch === 'undefined') return;
  try {
    fetch('/model-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(config),
    }).catch(() => {
      /* PUT nieblokujący */
    });
  } catch {
    /* synchroniczny rzut fetch */
  }
}

interface ModelStore {
  models: ModelConfig;
  modelsLoaded: boolean;
  setModels(config: ModelConfig): void;
  resetModels(): void;
  hydrate(): Promise<void>;
}

export const useModels = create<ModelStore>((set, get) => ({
  models: readCache(),
  modelsLoaded: false,
  setModels: (config) => {
    set({ models: config });
    writeCache(config);
    putModels(config);
  },
  resetModels: () => get().setModels(DEFAULT_MODEL_CONFIG),
  hydrate: async () => {
    if (typeof fetch === 'undefined') {
      set({ modelsLoaded: true });
      return;
    }
    try {
      const res = await fetch('/model-config');
      if (res.ok) {
        const parsed: unknown = await res.json();
        const v = validateModelConfig(parsed);
        if (v.ok) {
          set({ models: v.config });
          writeCache(v.config);
        }
      }
    } catch {
      /* sieć padła → zostaje cache/DEFAULT */
    }
    set({ modelsLoaded: true });
  },
}));

/**
 * Resolver dla konsumentów spoza Reacta (ticker w game/view.ts): czyta aktualny
 * config ze store przez getState — bez couplingu z drzewem React.
 */
export function resolveModelLive(model: string | undefined): ResolvedModel {
  return resolveModel(model, useModels.getState().models);
}
```

- [ ] **Step 4: Hydrate w `packages/client/src/main.tsx`**

Zmień zawartość na (dodanie importu + hydrate rejestru obok mapy):

```tsx
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { connectWorld } from './ws';
import { useMapping } from './mapping-store';
import { useModels } from './model-store';

connectWorld();
// Pobierz zapisane configi z lokalnego serwera (źródło prawdy).
void useMapping.getState().hydrate();
void useModels.getState().hydrate();

createRoot(document.getElementById('root')!).render(<App />);
```

- [ ] **Step 5: Uruchom — PASS**

Run: `npm run test -w @agent-citadel/client -- model-store`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/model-store.ts packages/client/src/main.tsx packages/client/tests/model-store.test.ts
git commit -m "feat(client): store useModels (optymistyczny) + hydrate"
```

---

## Task 5: Wpięcie paska kontekstu (reaktywne okno)

**Files:**
- Modify: `packages/client/src/hud/context-bar.ts` (usuń `contextWindow`, `contextPct` bierze `windowSize`)
- Modify: `packages/client/src/hud/ContextBar.tsx` (czysty: prop `windowSize`)
- Modify: `packages/client/src/hud/SidePanel.tsx` (subskrypcja `useModels`, przekazanie okna)
- Test: `packages/client/tests/context-bar.test.ts` (nowe sygnatury)

- [ ] **Step 1: Zaktualizuj test `packages/client/tests/context-bar.test.ts` (nadpisz całość)**

```ts
import { describe, it, expect } from 'vitest';
import { contextPct, contextColor } from '../src/hud/context-bar';

describe('contextPct', () => {
  it('liczy procent wzgl. PODANEGO okna', () => {
    expect(contextPct(100_000, 200_000)).toBe(50);
    expect(contextPct(50_000, 1_000_000)).toBe(5);
  });
  it('clamp do 100; zero przy niepoprawnym oknie', () => {
    expect(contextPct(300_000, 200_000)).toBe(100);
    expect(contextPct(1000, 0)).toBe(0);
  });
});

describe('contextColor', () => {
  it('zielony nisko, czerwony wysoko', () => {
    expect(contextColor(5)).toBe('#5dcaa5');
    expect(contextColor(95)).toBe('#e24b4a');
  });
});
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npm run test -w @agent-citadel/client -- context-bar`
Expected: FAIL — `contextPct` wciąż ma starą sygnaturę (model), test podaje liczbę.

- [ ] **Step 3: Przepisz `packages/client/src/hud/context-bar.ts` (usuń `contextWindow`)**

```ts
/** Procent zapełnienia okna kontekstu, 0..100 (zaokrąglony, clamp). Okno podane z zewnątrz. */
export function contextPct(tokens: number, windowSize: number): number {
  if (!(windowSize > 0)) return 0;
  return Math.min(100, Math.round((tokens / windowSize) * 100));
}

/** Kolor wypełnienia wg %: zielony ≤10 → żółty ≤50 → ku czerwieni do 100. */
export function contextColor(pct: number): string {
  if (pct <= 10) return '#5dcaa5';
  if (pct <= 50) return '#f0d76e';
  if (pct <= 75) return '#f0b56e';
  if (pct <= 90) return '#ef7a6a';
  return '#e24b4a';
}
```

- [ ] **Step 4: Przepisz `packages/client/src/hud/ContextBar.tsx` (prop `windowSize`)**

```tsx
import { formatK } from '../util';
import { contextPct, contextColor } from './context-bar';

const SEGMENTS = 24;

/** Segmentowany pixel-pasek zapełnienia okna kontekstu (per-bohater). Czysty: dostaje gotowe okno. */
export function ContextBar({ tokens, windowSize, label }: { tokens: number; windowSize: number; label: string }) {
  const pct = contextPct(tokens, windowSize);
  const c = contextColor(pct);
  const filled = Math.round((SEGMENTS * pct) / 100);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.7, marginBottom: 5 }}>
        <span className="px" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        <span>
          <span style={{ color: c }}>{pct}%</span> · {formatK(tokens)} / {formatK(windowSize)}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 12,
              background: i < filled ? c : '#2a2926',
              boxShadow: 'inset 1px 1px 0 #ffffff22, inset -1px -1px 0 #00000055',
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Podłącz okno w `packages/client/src/hud/SidePanel.tsx` (subskrypcja `useModels`)**

Dodaj importy obok istniejących (`SidePanel.tsx:4` ma już `useMapping`):

```ts
import { useModels } from '../model-store';
import { resolveSprite, resolveContextWindow } from '../theme/models';
```

W ciele komponentu, obok innych hooków store (np. tam, gdzie czytane są `useWorld`/`useSettings`), dodaj subskrypcję:

```ts
  const models = useModels((s) => s.models);
```

Zamień użycie `ContextBar` (linia z `tokens={hero.contextTokens} model={hero.model}`) na wersję z gotowym oknem:

```tsx
      {typeof hero.contextTokens === 'number' && (
        <ContextBar
          tokens={hero.contextTokens}
          windowSize={resolveContextWindow(hero.model, models)}
          label={t.context}
        />
      )}
```

Zamień linię nazwy modelu (`{hero.model ?? t.modelUnknown}`) na nazwę z rejestru:

```tsx
              {resolveSprite(hero.model, models).displayName ?? hero.model ?? t.modelUnknown}
```

- [ ] **Step 6: Uruchom testy klienta — PASS**

Run: `npm run test -w @agent-citadel/client -- context-bar`
Expected: PASS.

- [ ] **Step 7: Typecheck/build klienta**

Run: `npm run build:web`
Expected: build OK (brak błędów typów po zmianie propsa `ContextBar`).

- [ ] **Step 8: Commit**

```bash
git add packages/client/src/hud/context-bar.ts packages/client/src/hud/ContextBar.tsx packages/client/src/hud/SidePanel.tsx packages/client/tests/context-bar.test.ts
git commit -m "feat(client): pasek kontekstu czyta okno z rejestru modeli (reaktywnie)"
```

---

## Task 6: Wpięcie sprite + override w doborze bohatera

**Files:**
- Modify: `packages/client/src/game/archetype.ts` (import `SPRITE_IDS`, param `spriteOverride`)
- Modify: `packages/client/src/game/view.ts:435` (przekaż `resolveModelLive(...).sprite`)
- Test: `packages/client/tests/archetype.test.ts` (dodaj przypadek override)

- [ ] **Step 1: Dodaj failing przypadek do `packages/client/tests/archetype.test.ts`**

Dopisz w pliku (w istniejącym `describe` dla `sessionToArchetypeKey` lub nowym):

```ts
import { sessionToArchetypeKey } from '../src/game/archetype';
import type { HeroSnapshot } from '@agent-citadel/shared';

describe('sessionToArchetypeKey — override sprite', () => {
  const base = { permissionMode: 'default' } as HeroSnapshot;
  it('spriteOverride wygrywa nad zgadywaniem z nazwy', () => {
    expect(sessionToArchetypeKey({ ...base, model: 'llama3.1:8b' }, 'haiku')).toBe('haiku-default');
  });
  it('bez override — stara logika podciągu', () => {
    expect(sessionToArchetypeKey({ ...base, model: 'claude-opus-4-8[1m]' })).toBe('opus-default');
  });
});
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npm run test -w @agent-citadel/client -- archetype`
Expected: FAIL — `sessionToArchetypeKey` nie przyjmuje drugiego argumentu.

- [ ] **Step 3: Zmień `packages/client/src/game/archetype.ts`**

Zamień linię importu (`archetype.ts:1`) i deklarację `MODELS` (`archetype.ts:9`):

```ts
import type { HeroSnapshot, HeroStateKind } from '@agent-citadel/shared';
import { SPRITE_IDS, type SpriteId } from '@agent-citadel/shared';
```

```ts
// Lista modeli = pula sprite'ów (jedno źródło prawdy w shared).
export const MODELS = SPRITE_IDS;
```

Zamień `sessionToArchetypeKey` (`archetype.ts:19-29`) na wersję z opcjonalnym override:

```ts
export function sessionToArchetypeKey(hero: HeroSnapshot, spriteOverride?: SpriteId): string {
  // Override z rejestru modeli ma pierwszeństwo; inaczej dopasowanie po fragmencie nazwy.
  const model: SpriteId | undefined =
    spriteOverride ?? MODELS.find((m) => (hero.model ?? '').toLowerCase().includes(m));
  if (!model) return ARCHETYPE_FALLBACK; // nieznany/brak modelu → cały klucz na fallback
  const mode = (MODES as readonly string[]).includes(hero.permissionMode ?? '')
    ? (hero.permissionMode as string)
    : 'default';
  return `${model}-${mode}`;
}
```

- [ ] **Step 4: Przekaż override w `packages/client/src/game/view.ts:435`**

Dodaj import (obok innych importów z game/archetype lub stores):

```ts
import { resolveModelLive } from '../model-store';
```

Zamień wywołanie (`view.ts:435`):

```ts
        const sheet = getHeroSheet(sessionToArchetypeKey(hero, resolveModelLive(hero.model).sprite));
```

- [ ] **Step 5: Uruchom — PASS**

Run: `npm run test -w @agent-citadel/client -- archetype`
Expected: PASS (nowe przypadki + dotychczasowe).

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/game/archetype.ts packages/client/src/game/view.ts packages/client/tests/archetype.test.ts
git commit -m "feat(client): dobór sprite'a z rejestru modeli (override + fallback)"
```

---

## Task 7: i18n — etykiety zakładki Modele

**Files:**
- Modify: `packages/client/src/i18n.ts` (interfejs `UiStrings` + EN/PL/IT)

- [ ] **Step 1: Dodaj klucze do interfejsu `UiStrings`**

Po `addTriggerConfirm: string;` (`i18n.ts:91`) dodaj:

```ts
  // Zakładka Modele
  tabBuildingReactions: string;
  tabModels: string;
  models: string;
  modelsHint: string;
  spriteAndName: string;
  contextWindowSection: string;
  seenModels: string;
  usesFallback: string;
  matchExact: string;
  matchPattern: string;
  matchValue: string;
  spriteLabel: string;
  displayNameLabel: string;
  windowLabel: string;
  fallbackLabel: string;
  addRow: string;
```

- [ ] **Step 2: Dodaj wartości EN** (po `addTriggerConfirm: 'Add trigger',`)

```ts
  tabBuildingReactions: 'Building reactions',
  tabModels: 'Models',
  models: 'Models',
  modelsHint: 'Tell the world how to recognize each model: which character it appears as, and how big its context window is. The 1M tag matters for the window. Edit visually or as JSON — both stay in sync.',
  spriteAndName: 'Character & name',
  contextWindowSection: 'Context window',
  seenModels: 'Models in your sessions',
  usesFallback: 'falls back to default',
  matchExact: 'exact id',
  matchPattern: 'contains',
  matchValue: 'model text',
  spriteLabel: 'character',
  displayNameLabel: 'display name',
  windowLabel: 'tokens',
  fallbackLabel: 'Default (unmatched)',
  addRow: '+ add',
```

- [ ] **Step 3: Dodaj wartości PL** (po `addTriggerConfirm: 'Dodaj wyzwalacz',`)

```ts
  tabBuildingReactions: 'Reakcje budynków',
  tabModels: 'Modele',
  models: 'Modele',
  modelsHint: 'Powiedz światu, jak rozpoznać każdy model: jako który bohater się pokazuje i jak duże ma okno kontekstu. Tag 1M ma znaczenie dla okna. Edytuj wizualnie albo jako JSON — oba są zsynchronizowane.',
  spriteAndName: 'Bohater i nazwa',
  contextWindowSection: 'Okno kontekstu',
  seenModels: 'Modele w Twoich sesjach',
  usesFallback: 'spada na domyślne',
  matchExact: 'dokładne id',
  matchPattern: 'zawiera',
  matchValue: 'tekst modelu',
  spriteLabel: 'bohater',
  displayNameLabel: 'nazwa',
  windowLabel: 'tokeny',
  fallbackLabel: 'Domyślne (niedopasowane)',
  addRow: '+ dodaj',
```

- [ ] **Step 4: Dodaj wartości IT** (po `addTriggerConfirm: 'Aggiungi trigger',`)

```ts
  tabBuildingReactions: 'Reazioni degli edifici',
  tabModels: 'Modelli',
  models: 'Modelli',
  modelsHint: 'Indica al mondo come riconoscere ogni modello: con quale personaggio appare e quanto è grande la sua finestra di contesto. Il tag 1M conta per la finestra. Modifica visivamente o come JSON — restano sincronizzati.',
  spriteAndName: 'Personaggio e nome',
  contextWindowSection: 'Finestra di contesto',
  seenModels: 'Modelli nelle tue sessioni',
  usesFallback: 'usa il predefinito',
  matchExact: 'id esatto',
  matchPattern: 'contiene',
  matchValue: 'testo del modello',
  spriteLabel: 'personaggio',
  displayNameLabel: 'nome',
  windowLabel: 'token',
  fallbackLabel: 'Predefinito (non abbinato)',
  addRow: '+ aggiungi',
```

- [ ] **Step 5: Typecheck (wszystkie 3 obiekty kompletne)**

Run: `npm run build:web`
Expected: build OK — brak błędu „property missing in type UiStrings".

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/i18n.ts
git commit -m "feat(i18n): etykiety zakładki Modele (EN/PL/IT)"
```

---

## Task 8: SettingsPanel — zakładki

**Files:**
- Modify: `packages/client/src/hud/SettingsPanel.tsx`
- Modify: `packages/client/src/hud/hud.css` (dopisz style zakładek)

> Uwaga: `ModelRegistryEditor` powstaje w Task 9. Tu importujemy go z wyprzedzeniem — Task 8 i 9 commitujemy razem na końcu Task 9, więc build uruchamiamy dopiero po Task 9. Jeśli wykonujesz taski pojedynczo, zrób Task 9 przed buildem.

- [ ] **Step 1: Dodaj zakładki w `SettingsPanel.tsx`**

Zmień import Reacta (`SettingsPanel.tsx:1`) i dodaj import edytora:

```ts
import { useEffect, useRef, useState } from 'react';
import { useUi } from '../i18n';
import { BuildingReactionsEditor } from './BuildingReactionsEditor';
import { ModelRegistryEditor } from './ModelRegistryEditor';
```

W ciele komponentu, po `const dialogRef = useRef...` dodaj stan zakładki:

```ts
  const [tab, setTab] = useState<'buildings' | 'models'>('buildings');
```

Zamień nagłówek + render (`SettingsPanel.tsx:59-65`) na:

```tsx
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong className="px" style={{ fontSize: 16, color: '#fac775' }}>
            ⚙ {t.settings}
          </strong>
          <button className="ghost" onClick={onClose} aria-label={t.notifClose}>✕</button>
        </div>
        <div className="settings-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'buildings'}
            className={`settings-tab${tab === 'buildings' ? ' active' : ''}`}
            onClick={() => setTab('buildings')}
          >
            {t.tabBuildingReactions}
          </button>
          <button
            role="tab"
            aria-selected={tab === 'models'}
            className={`settings-tab${tab === 'models' ? ' active' : ''}`}
            onClick={() => setTab('models')}
          >
            {t.tabModels}
          </button>
        </div>
        {tab === 'buildings' ? <BuildingReactionsEditor /> : <ModelRegistryEditor />}
```

- [ ] **Step 2: Dopisz style zakładek na końcu `packages/client/src/hud/hud.css`**

```css
/* Zakładki ustawień. */
.settings-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 2px solid #45443f;
}
.settings-tab {
  background: none;
  border: 0;
  color: #a8a69d;
  font: inherit;
  font-size: 13px;
  padding: 6px 12px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
}
.settings-tab:hover { color: #f1efe8; }
.settings-tab.active {
  color: #fac775;
  border-bottom-color: #fac775;
}
```

- [ ] **Step 3: (build po Task 9)** — przejdź do Task 9.

---

## Task 9: ModelRegistryEditor — edytor rejestru

**Files:**
- Create: `packages/client/src/hud/ModelRegistryEditor.tsx`

- [ ] **Step 1: Utwórz `packages/client/src/hud/ModelRegistryEditor.tsx`**

```tsx
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  validateModelConfig,
  resolveSprite,
  resolveContextWindow,
  matchModel,
  SPRITE_IDS,
  type ModelConfig,
  type ModelMatch,
  type SpriteId,
  type SpriteRule,
  type WindowRule,
} from '../theme/models';
import { useModels } from '../model-store';
import { useWorld } from '../store';
import { useUi, type UiStrings } from '../i18n';
import { formatK } from '../util';

export function ModelRegistryEditor() {
  const models = useModels((s) => s.models);
  const setModels = useModels((s) => s.setModels);
  const resetModels = useModels((s) => s.resetModels);
  const heroes = useWorld((s) => s.heroes);
  const t = useUi();

  // Odrębne modele widziane w bieżących sesjach.
  const seen = useMemo(() => {
    const set = new Set<string>();
    for (const h of Object.values(heroes)) if (h.model) set.add(h.model);
    return [...set];
  }, [heroes]);

  const setSprites = (sprites: SpriteRule[]) => setModels({ ...models, sprites });
  const setWindows = (windows: WindowRule[]) => setModels({ ...models, windows });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.75 }}>{t.modelsHint}</div>

      {/* Widziane modele — prosta wersja: dopasowanie sprite/okno + flaga fallback. */}
      {seen.length > 0 && (
        <div className="cov-strip" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <span className="px" style={{ opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 11 }}>
            {t.seenModels}
          </span>
          {seen.map((m) => {
            const matched =
              models.sprites.some((r) => matchModel(m, r.match)) ||
              models.windows.some((r) => matchModel(m, r.match));
            return (
              <div key={m} style={{ display: 'flex', gap: 8, fontSize: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <code style={{ opacity: 0.9 }}>{m}</code>
                <span className="bre-chip bre-chip--exact">{resolveSprite(m, models).sprite}</span>
                <span className="bre-chip bre-chip--prefix">{formatK(resolveContextWindow(m, models))}</span>
                {!matched && <span style={{ color: '#ef9f27' }}>⚠ {t.usesFallback}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Oś tożsamości. */}
      <Section title={`👤 ${t.spriteAndName}`}>
        {models.sprites.map((r, i) => (
          <SpriteRow
            key={i}
            rule={r}
            t={t}
            onChange={(next) => setSprites(models.sprites.map((x, j) => (j === i ? next : x)))}
            onRemove={() => setSprites(models.sprites.filter((_, j) => j !== i))}
          />
        ))}
        <button
          className="bre-addbtn"
          onClick={() => setSprites([...models.sprites, { match: { kind: 'pattern', pattern: '' }, sprite: SPRITE_IDS[0] }])}
        >
          {t.addRow}
        </button>
      </Section>

      {/* Oś pojemności. */}
      <Section title={`📦 ${t.contextWindowSection}`}>
        {models.windows.map((r, i) => (
          <WindowRow
            key={i}
            rule={r}
            t={t}
            onChange={(next) => setWindows(models.windows.map((x, j) => (j === i ? next : x)))}
            onRemove={() => setWindows(models.windows.filter((_, j) => j !== i))}
          />
        ))}
        <button
          className="bre-addbtn"
          onClick={() => setWindows([...models.windows, { match: { kind: 'pattern', pattern: '' }, contextWindow: 200_000 }])}
        >
          {t.addRow}
        </button>
      </Section>

      {/* Fallback (niedopasowane). */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
        <span className="px" style={{ opacity: 0.7 }}>{t.fallbackLabel}:</span>
        <select
          className="bre-input"
          aria-label={t.spriteLabel}
          value={models.fallback.sprite}
          onChange={(e) => setModels({ ...models, fallback: { ...models.fallback, sprite: e.target.value as SpriteId } })}
        >
          {SPRITE_IDS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          className="bre-input"
          style={{ width: 110 }}
          type="number"
          min={1}
          aria-label={t.windowLabel}
          value={models.fallback.contextWindow}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (n > 0) setModels({ ...models, fallback: { ...models.fallback, contextWindow: n } });
          }}
        />
        <span style={{ opacity: 0.6 }}>{t.windowLabel}</span>
      </div>

      {/* JSON — zapis/wgranie (debounce 400 ms, walidacja). */}
      <ModelJsonEditor models={models} setModels={setModels} t={t} />

      <div>
        <button className="ghost" onClick={resetModels}>↺ {t.restoreDefaults}</button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="px" style={{ fontSize: 13 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}

function MatchEditor({ match, t, onChange }: { match: ModelMatch; t: UiStrings; onChange: (m: ModelMatch) => void }) {
  const value = match.kind === 'exact' ? match.id : match.pattern;
  return (
    <>
      <select
        className="bre-input"
        aria-label="match kind"
        value={match.kind}
        onChange={(e) =>
          onChange(e.target.value === 'exact' ? { kind: 'exact', id: value } : { kind: 'pattern', pattern: value })
        }
      >
        <option value="pattern">{t.matchPattern}</option>
        <option value="exact">{t.matchExact}</option>
      </select>
      <input
        className="bre-input"
        style={{ width: 150 }}
        placeholder={t.matchValue}
        value={value}
        onChange={(e) =>
          onChange(match.kind === 'exact' ? { kind: 'exact', id: e.target.value } : { kind: 'pattern', pattern: e.target.value })
        }
      />
    </>
  );
}

function SpriteRow({ rule, t, onChange, onRemove }: { rule: SpriteRule; t: UiStrings; onChange: (r: SpriteRule) => void; onRemove: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <MatchEditor match={rule.match} t={t} onChange={(match) => onChange({ ...rule, match })} />
      <select
        className="bre-input"
        aria-label={t.spriteLabel}
        value={rule.sprite}
        onChange={(e) => onChange({ ...rule, sprite: e.target.value as SpriteId })}
      >
        {SPRITE_IDS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <input
        className="bre-input"
        style={{ width: 120 }}
        placeholder={t.displayNameLabel}
        value={rule.displayName ?? ''}
        onChange={(e) => onChange({ ...rule, displayName: e.target.value || undefined })}
      />
      <button className="bre-addbtn" onClick={onRemove} aria-label={t.remove}>✕</button>
    </div>
  );
}

function WindowRow({ rule, t, onChange, onRemove }: { rule: WindowRule; t: UiStrings; onChange: (r: WindowRule) => void; onRemove: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <MatchEditor match={rule.match} t={t} onChange={(match) => onChange({ ...rule, match })} />
      <input
        className="bre-input"
        style={{ width: 120 }}
        type="number"
        min={1}
        aria-label={t.windowLabel}
        value={rule.contextWindow}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (n > 0) onChange({ ...rule, contextWindow: n });
        }}
      />
      <span style={{ opacity: 0.6, fontSize: 12 }}>{t.windowLabel}</span>
      <button className="bre-addbtn" onClick={onRemove} aria-label={t.remove}>✕</button>
    </div>
  );
}

function ModelJsonEditor({ models, setModels, t }: { models: ModelConfig; setModels: (c: ModelConfig) => void; t: UiStrings }) {
  const [text, setText] = useState(() => JSON.stringify(models, null, 2));
  const [error, setError] = useState<string | undefined>();
  const focused = useRef(false);
  const applyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Gdy rejestr zmieni się z panelu, odśwież textarea — ale nie podczas pisania.
  useEffect(() => {
    if (focused.current) return;
    setText(JSON.stringify(models, null, 2));
    setError(undefined);
  }, [models]);

  useEffect(() => () => clearTimeout(applyTimer.current), []);

  const onChange = (v: string) => {
    setText(v);
    let parsed: unknown;
    try {
      parsed = JSON.parse(v);
    } catch {
      setError(t.jsonInvalid);
      return;
    }
    const res = validateModelConfig(parsed);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(undefined);
    clearTimeout(applyTimer.current);
    applyTimer.current = setTimeout(() => setModels(res.config), 400);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ opacity: 0.7 }}>{`{ } ${t.jsonSynced}`}</span>
        {error && <span style={{ color: '#e24b4a' }}>{error}</span>}
      </div>
      <textarea
        className={`bre-json${error ? ' invalid' : ''}`}
        value={text}
        spellCheck={false}
        onFocus={() => (focused.current = true)}
        onBlur={() => (focused.current = false)}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Build klienta (Task 8 + 9 razem)**

Run: `npm run build:web`
Expected: build OK — komponent kompiluje się, `SettingsPanel` renderuje obie zakładki.

- [ ] **Step 3: Commit (Task 8 + 9)**

```bash
git add packages/client/src/hud/SettingsPanel.tsx packages/client/src/hud/hud.css packages/client/src/hud/ModelRegistryEditor.tsx
git commit -m "feat(client): zakładka Modele w ustawieniach + edytor rejestru (sprite/okno/JSON)"
```

---

## Task 10: Weryfikacja na żywo, pełne testy, bump wersji

**Files:**
- Modify: `package.json` (wersja `0.3.5` → `0.3.6`)

- [ ] **Step 1: Pełne testy + build**

Run: `npm test && npm run build`
Expected: wszystkie testy zielone; build (web + server) OK.

- [ ] **Step 2: Weryfikacja reaktywności w przeglądarce (preview)**

Uruchom aplikację w trybie demo i sprawdź realne zachowanie (NIE pytaj użytkownika — zweryfikuj sam preview-narzędziami):
1. `preview_start` (dev/demo: serwer 8123 + klient 5173, np. `npm run demo`).
2. Kliknij bohatera, by otworzyć `SidePanel` z paskiem kontekstu (`preview_click` + `preview_snapshot`).
3. Otwórz ustawienia (⚙) → zakładka **Modele**; zmień okno modelu tej sesji (np. opus → 500000).
4. `preview_snapshot`: pasek w `SidePanel` od razu pokazuje nowy mianownik i przeliczony % — **bez przeładowania**.
5. Zmień sprite/nazwę modelu → bohater na mapie i etykieta w panelu aktualizują się.
6. Wklej JSON w edytorze (np. zmień fallback.contextWindow) → po debouncie pasek się przelicza.
7. `preview_screenshot` jako dowód.
Expected: każda zmiana widoczna natychmiast (subskrypcja `useModels`).

- [ ] **Step 3: Bump wersji do 0.3.6**

W `package.json` zmień `"version": "0.3.5"` na `"version": "0.3.6"`.

- [ ] **Step 4: Commit wersji**

```bash
git add package.json
git commit -m "chore(release): v0.3.6 — rejestr modeli (okno kontekstu + sprite + nazwa)"
```

- [ ] **Step 5: Release (akcja wydawnicza — wg stylu projektu)**

Wydanie idzie prosto na `main` + npm przez tag (publish.yml odpala na `v*`). Po `git pull --rebase && git push` (CLAUDE.md: praca nie jest skończona bez pusha), opcjonalnie:

```bash
git tag v0.3.6
git push origin main --tags
```

Tagowanie/publikację potwierdź z użytkownikiem, jeśli nie ma wyraźnej zgody.

---

## Self-Review (wypełnione przy pisaniu planu)

**Spec coverage:** §3 dwie osie → Task 1 (resolveSprite/resolveContextWindow). §4 model danych + walidacja + DEFAULT → Task 1. §5 serwer → Task 2+3. §6 store + hydrate → Task 4. §7 wpięcie (okno reaktywne, sprite, nazwa) → Task 5+6. §8 UI zakładki + edytor + „widziane modele" + JSON → Task 8+9. §9 kolejność + release → Task 0 (merge) + Task 10 (bump, jeden tag v0.3.6). §10 testy → Task 1–6 (TDD) + Task 10 (preview). Brak luk.

**Placeholder scan:** brak TBD/TODO; wartości okien Claude mają konkretne liczby + krok weryfikacji przez claude-api (Task 1, Step 4).

**Type consistency:** `ModelConfig {sprites,windows,fallback}`, `SpriteRule {match,sprite,displayName?}`, `WindowRule {match,contextWindow}`, `ModelMatch {kind:'exact',id}|{kind:'pattern',pattern}`, `resolveSprite`/`resolveContextWindow`/`resolveModel`/`validateModelConfig`/`resolveModelLive`, store `useModels {models,modelsLoaded,setModels,resetModels,hydrate}`, `registerModelRoutes`, `loadModelConfig`/`saveModelConfig`/`invalidateModelConfigCache` — nazwy spójne między taskami i z kodem konsumentów (SidePanel, view, ModelRegistryEditor).
