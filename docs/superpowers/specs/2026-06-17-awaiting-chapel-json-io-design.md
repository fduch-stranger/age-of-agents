# Spec — awaiting-input → kaplica + pobierz/wgraj JSON mapowania

Data: 2026-06-17
Status: zatwierdzony do implementacji
Beads: AgeOfAgents-gzb
Baza: origin/main @ eb33ffb (v0.3.5)

## Cel

Dwa dopracowania (oba w obszarze drugiego toru — przy merge możliwa kolizja, rozwiązać jak wcześniej):
1. Bohater w stanie `awaiting-input` idzie do **kaplicy/poczekalni** zamiast zamierać w miejscu.
2. Panel ustawień (reakcje budynków): textarea JSON zostaje **live** (bez zmian), dochodzą przyciski **Pobierz JSON** (plik) i **Wgraj JSON** (walidacja → zastosuj).

## Część A — `awaiting-input` → kaplica/poczekalnia

**Stan obecny** (`packages/client/src/game/view.ts`, `steer`): hero w `thinking | awaiting-input | error` → `targets.delete` + `return` (zamiera przy warsztacie). Czyli `awaiting-input` nigdzie nie idzie.

**Zmiana:**
- Nowy czysty helper w `packages/client/src/game/home-building.ts`:
  ```ts
  const AWAITING_BY_THEME: Record<string, BuildingId> = { fantasy: 'shrine', scifi: 'lounge' };
  /** Budynek „poczekalni", do którego idzie bohater czekający na usera (awaiting-input). */
  export function awaitingBuilding(themeId: string): BuildingId {
    return AWAITING_BY_THEME[themeId] ?? 'citadel';
  }
  ```
- W `steer`: wydzielić `awaiting-input` z gałęzi „zostań w miejscu". Hero (nie peon) w `awaiting-input` → `buildingId = awaitingBuilding(this.theme.id)`; **NIE** aktualizować `lastBuilding` (po odpowiedzi wraca do swojego warsztatu). `thinking`/`error` zostają jak są (zamierają).
- Po zmianie stanu działa naturalnie: `working` → warsztat narzędzia, `idle` → `lastBuilding` (warsztat).

**Decyzje:** sci-fi odpowiednik kaplicy = `lounge` (poczekalnia). Tylko `awaiting-input` zmienia zachowanie; `thinking`/`error` bez zmian.

## Część B — pobierz/wgraj JSON

**Stan obecny:** `JsonEditor` (w `BuildingReactionsEditor.tsx`) — textarea live: poprawny JSON auto-stosuje się po 400 ms debounce (`setMapping`), dwukierunkowo zsync z chipami. Persystencja: `setMapping` → localStorage + PUT `/tool-mapping`.

**Zmiana (textarea zostaje bez zmian):**
- Nowy czysty helper `packages/client/src/hud/mapping-io.ts`:
  ```ts
  import { validateMapping, type MappingConfig } from '../theme/mapping';
  /** Parsuje treść wgranego pliku → config albo błąd (do komunikatu). */
  export function parseUploadedMapping(text: string):
    | { ok: true; config: MappingConfig }
    | { ok: false; error: string } {
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { return { ok: false, error: 'invalid JSON' }; }
    return validateMapping(parsed);
  }
  /** Pobiera config jako plik tool-mapping.json (DOM-only; no-op bez document). */
  export function downloadMapping(mapping: MappingConfig): void {
    if (typeof document === 'undefined') return;
    const blob = new Blob([JSON.stringify(mapping, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'tool-mapping.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  ```
  (`validateMapping` zwraca `{ ok: true; config }` | `{ ok: false; error }` — patrz `theme/mapping`.)
- W `JsonEditor` (pod textareą) dwa przyciski:
  - **⬇ Pobierz JSON** → `downloadMapping(mapping)`.
  - **⬆ Wgraj JSON** → ukryty `<input type="file" accept="application/json,.json">`; on change: `await file.text()` → `parseUploadedMapping` → ok: `setMapping(config)` (czyści błąd), błąd: pokaż `t.jsonInvalid`.
- i18n: nowe klucze `downloadJson`, `uploadJson` (EN/PL/IT).

**Decyzje:** textarea live zostaje (edycja tekstu nadal auto-stosuje się — osobny przycisk „zastosuj" niepotrzebny). „Wgraj" pełni rolę „załaduj config z pliku".

## Poza zakresem

- Zmiana modelu zapisu textarei (live → jawny „Apply") — zostaje live.
- Dedykowane budynki dla `thinking`/`error` — bez zmian.

## Testy

- `awaitingBuilding`: `fantasy`→`shrine`, `scifi`→`lounge`, nieznany→`citadel`.
- `parseUploadedMapping`: poprawny JSON+config → `{ok:true,config}`; zły JSON → `{ok:false}`; poprawny JSON ale zła struktura → `{ok:false}`.
- Routing `steer` (awaiting→shrine/lounge, lastBuilding nietknięty) i przyciski Pobierz/Wgraj — weryfikacja wizualna (preview).

## File structure

| Plik | Akcja |
|---|---|
| `packages/client/src/game/home-building.ts` | Modify — `awaitingBuilding(themeId)` |
| `packages/client/src/game/view.ts` | Modify — `steer`: awaiting-input → awaitingBuilding, bez nadpisania lastBuilding |
| `packages/client/src/hud/mapping-io.ts` | Create — `parseUploadedMapping` + `downloadMapping` |
| `packages/client/src/hud/BuildingReactionsEditor.tsx` | Modify — przyciski Pobierz/Wgraj w `JsonEditor` |
| `packages/client/src/i18n.ts` | Modify — `downloadJson`, `uploadJson` (3 języki) |
| `packages/client/tests/awaiting-building.test.ts` | Create — test `awaitingBuilding` |
| `packages/client/tests/mapping-io.test.ts` | Create — test `parseUploadedMapping` |
