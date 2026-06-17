# awaiting→kaplica + pobierz/wgraj JSON — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** (A) Bohater w `awaiting-input` idzie do kaplicy (fantasy `shrine`) / poczekalni (sci-fi `lounge`) zamiast zamierać; (B) panel ustawień zyskuje Pobierz/Wgraj JSON mapowania (textarea live zostaje).

**Architecture:** Czysta funkcja `awaitingBuilding(themeId)` + jedna gałąź w `steer`. Czysty `parseUploadedMapping`/`downloadMapping` + dwa przyciski w `JsonEditor`. Logika testowana jednostkowo; ruch jednostki i przyciski — wizualnie.

**Tech Stack:** TypeScript ESM, React 19 + zustand, PixiJS (game/view), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-17-awaiting-chapel-json-io-design.md`
**Beads:** `AgeOfAgents-gzb`
**Branch:** `feat/awaiting-chapel-json-io` (na origin/main @ eb33ffb, aktywny)

**Komendy:** test klienta `npm run test -w @agent-citadel/client -- <pattern>`; typecheck `npx tsc --noEmit -p packages/client`; pełne `npm test`.

---

## Task 1: `awaiting-input` → kaplica/poczekalnia

**Files:** Modify `packages/client/src/game/home-building.ts`, `packages/client/src/game/view.ts`; Create `packages/client/tests/awaiting-building.test.ts`

- [ ] **Step 1: Failing test**

`packages/client/tests/awaiting-building.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { awaitingBuilding } from '../src/game/home-building';

describe('awaitingBuilding', () => {
  it('fantasy → shrine, scifi → lounge, nieznany → citadel', () => {
    expect(awaitingBuilding('fantasy')).toBe('shrine');
    expect(awaitingBuilding('scifi')).toBe('lounge');
    expect(awaitingBuilding('coś-innego')).toBe('citadel');
  });
});
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npm run test -w @agent-citadel/client -- awaiting-building`
Expected: FAIL (brak eksportu `awaitingBuilding`).

- [ ] **Step 3: Implementacja w `home-building.ts`**

Dodaj (np. pod `HOME_BUILDINGS`):
```ts
/** Budynek „poczekalni", do którego idzie bohater czekający na usera (awaiting-input).
 *  fantasy: kaplica (shrine); sci-fi: poczekalnia (lounge); fallback: citadel. */
const AWAITING_BY_THEME: Record<string, BuildingId> = { fantasy: 'shrine', scifi: 'lounge' };
export function awaitingBuilding(themeId: string): BuildingId {
  return AWAITING_BY_THEME[themeId] ?? 'citadel';
}
```

- [ ] **Step 4: Uruchom — PASS**

Run: `npm run test -w @agent-citadel/client -- awaiting-building`
Expected: PASS.

- [ ] **Step 5: Wepnij w `steer` (`view.ts`)**

a) Import (linia ~21): zmień
```ts
import { homeBuilding } from './home-building';
```
na
```ts
import { homeBuilding, awaitingBuilding } from './home-building';
```

b) W `steer`, zastąp gałąź thinking/awaiting/error:
```ts
    } else if (!unit.isPeon && (state === 'thinking' || state === 'awaiting-input' || state === 'error')) {
      this.targets.delete(unit.id); // bohater: zostań gdzie jesteś (myśli przy swoim warsztacie)
      return;
    } else {
```
na:
```ts
    } else if (!unit.isPeon && state === 'awaiting-input') {
      // Czeka na usera → idzie do kaplicy/poczekalni. NIE nadpisujemy lastBuilding,
      // by po odpowiedzi wrócił do swojego warsztatu (idle → ostatni warsztat).
      buildingId = awaitingBuilding(this.theme.id);
    } else if (!unit.isPeon && (state === 'thinking' || state === 'error')) {
      this.targets.delete(unit.id); // bohater: zostań gdzie jesteś (myśli przy warsztacie)
      return;
    } else {
```
(Reszta `steer` — `key`, `route`, `idleScatter` — działa bez zmian; dla awaiting-input `key = home:<shrine|lounge>`.)

- [ ] **Step 6: Typecheck + pełne testy klienta**

Run: `npx tsc --noEmit -p packages/client` → CLEAN
Run: `npm run test -w @agent-citadel/client` → green

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/game/home-building.ts packages/client/src/game/view.ts packages/client/tests/awaiting-building.test.ts
git commit -m "feat(game): awaiting-input → kaplica/poczekalnia (shrine/lounge) (AgeOfAgents-gzb)"
```

---

## Task 2: Pobierz/Wgraj JSON mapowania

**Files:** Create `packages/client/src/hud/mapping-io.ts`, `packages/client/tests/mapping-io.test.ts`; Modify `packages/client/src/hud/BuildingReactionsEditor.tsx`, `packages/client/src/i18n.ts`

- [ ] **Step 1: Failing test**

`packages/client/tests/mapping-io.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseUploadedMapping } from '../src/hud/mapping-io';
import { DEFAULT_MAPPING } from '../src/theme/mapping';

describe('parseUploadedMapping', () => {
  it('poprawny config → ok', () => {
    const res = parseUploadedMapping(JSON.stringify(DEFAULT_MAPPING));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.config.rules.length).toBe(DEFAULT_MAPPING.rules.length);
  });
  it('niepoprawny JSON → błąd', () => {
    expect(parseUploadedMapping('{ to nie json').ok).toBe(false);
  });
  it('poprawny JSON, zła struktura → błąd', () => {
    expect(parseUploadedMapping('{"foo":1}').ok).toBe(false);
  });
});
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npm run test -w @agent-citadel/client -- mapping-io`
Expected: FAIL (brak modułu).

- [ ] **Step 3: Implementacja `mapping-io.ts`**

```ts
import { validateMapping, type MappingConfig } from '../theme/mapping';

/** Parsuje treść wgranego pliku → config albo błąd (do komunikatu). */
export function parseUploadedMapping(text: string):
  | { ok: true; config: MappingConfig }
  | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
  return validateMapping(parsed);
}

/** Pobiera config jako plik tool-mapping.json (DOM-only; no-op bez document). */
export function downloadMapping(mapping: MappingConfig): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([JSON.stringify(mapping, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tool-mapping.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Uruchom — PASS**

Run: `npm run test -w @agent-citadel/client -- mapping-io`
Expected: PASS (3 testy).

- [ ] **Step 5: i18n — `downloadJson`/`uploadJson`**

W `packages/client/src/i18n.ts`:
- `UiStrings` (obok `restoreDefaults`/`jsonSynced`): `downloadJson: string;` `uploadJson: string;`
- EN: `downloadJson: '⬇ Download JSON',` `uploadJson: '⬆ Upload JSON',`
- PL: `downloadJson: '⬇ Pobierz JSON',` `uploadJson: '⬆ Wgraj JSON',`
- IT: `downloadJson: '⬇ Scarica JSON',` `uploadJson: '⬆ Carica JSON',`

- [ ] **Step 6: Przyciski w `JsonEditor` (`BuildingReactionsEditor.tsx`)**

a) Importy na górze pliku — dodaj:
```ts
import { useRef } from 'react'; // jeśli już importowane z 'react', tylko dopisz useRef do istniejącego importu
import { parseUploadedMapping, downloadMapping } from './mapping-io';
```
(`useRef` jest już używany w pliku — upewnij się tylko, że jest w imporcie z `react`.)

b) Wewnątrz `JsonEditor`, dodaj `fileRef` przy innych hookach:
```ts
  const fileRef = useRef<HTMLInputElement>(null);
```

c) Pod `<textarea …/>` (przed zamknięciem `</div>` zwracanym przez `JsonEditor`) dodaj pasek przycisków:
```tsx
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <button className="ghost" onClick={() => downloadMapping(mapping)}>{t.downloadJson}</button>
        <button className="ghost" onClick={() => fileRef.current?.click()}>{t.uploadJson}</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = ''; // pozwól wgrać ten sam plik ponownie
            if (!file) return;
            const res = parseUploadedMapping(await file.text());
            if (res.ok) {
              setError(undefined);
              setText(JSON.stringify(res.config, null, 2));
              setMapping(res.config);
            } else {
              setError(t.jsonInvalid);
            }
          }}
        />
      </div>
```
(`setError`, `setText`, `mapping`, `setMapping`, `t` są już w zasięgu `JsonEditor`.)

- [ ] **Step 7: Typecheck + pełne testy klienta**

Run: `npx tsc --noEmit -p packages/client` → CLEAN
Run: `npm run test -w @agent-citadel/client` → green

- [ ] **Step 8: Commit**

```bash
git add packages/client/src/hud/mapping-io.ts packages/client/tests/mapping-io.test.ts packages/client/src/hud/BuildingReactionsEditor.tsx packages/client/src/i18n.ts
git commit -m "feat(settings): pobierz/wgraj JSON mapowania (AgeOfAgents-gzb)"
```

---

## Definition of Done

- [ ] Bohater `awaiting-input` idzie do shrine (fantasy)/lounge (sci-fi); po odpowiedzi wraca do warsztatu (lastBuilding nietknięty).
- [ ] Panel ustawień: textarea live bez zmian + działające „Pobierz JSON" (plik) i „Wgraj JSON" (walidacja→zastosuj, błąd→komunikat).
- [ ] `npm test` zielone; `npx tsc --noEmit -p packages/client` zielone.
- [ ] Zweryfikowane wizualnie (preview).
- [ ] `bd close AgeOfAgents-gzb` po scaleniu.
