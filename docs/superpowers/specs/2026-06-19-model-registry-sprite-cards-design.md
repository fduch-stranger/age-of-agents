# Rejestr modeli — karty spiritów z grafiką (zakładka Modele)

Data: 2026-06-19
Status: zatwierdzony projekt (przed planem implementacji)
Bazuje na: [rejestr modeli v0.3.7](2026-06-19-model-registry-settings-design.md)

## 1. Problem

Wspieramy wielu providerów (Claude, Codex, OpenCode, Koda), każdy z wieloma
modelami. Płaska, tekstowa mapa tożsamości w zakładce „Modele" (dropdown sprite +
nazwa per wiersz) nie pokazuje **jak wygląda** dany spirit ani że **jeden spirit
obejmuje wiele modeli**. User chce widzieć grafiki spiritów i relację
wiele-modeli→jeden-spirit, bliźniaczo do kart budynków.

## 2. Zakres

- **Sekcja tożsamości** w `ModelRegistryEditor` przebudowana z płaskich wierszy na
  **karty per spirit** (jak karty budynków): grafika + nazwa + chipy model-wzorców.
- **„Widziane modele"** — przy każdym widzianym modelu miniatura rozwiązanego spirita.
- **Sekcja „Okno kontekstu" — bez zmian** (osobna oś).
- Tylko klient. **Zero zmian** w shared/serwerze/`model-config.json`/JSON I/O.

### Świadomie poza zakresem (przyszłość — „herby")
Rozróżnienie providera (`AgentKind`: claude/codex/opencode/koda) jako **emblemat/herb**
nakładany na sprite. Dziś to `AGENT_BADGE` (kolorowy badge) w `SidePanel` — fundament
pod przyszłe herby. Ten increment tego nie buduje.

## 3. Kluczowa decyzja: model danych bez zmian

`ModelConfig.sprites: SpriteRule[]` (i `validateModelConfig`, `resolveSprite`,
format pliku, JSON I/O) **zostają nietknięte**. Karta-per-spirit to **widok-projekcja**
grupująca `sprites[]` po polu `.sprite`. Brak migracji formatu (v0.3.7 zgodny).

Konsekwencja: `displayName` żyje per-reguła. W widoku-karcie nazwa jest jedna na
spirit — synchronizowana na wszystkich regułach danego spirita; gdy spirit nie ma
reguł, nazwa to stan lokalny pola, utrwalany przy dodaniu pierwszego modelu.

## 4. Komponenty (klient)

### 4.1 `SpriteThumb` (miniatura spirita)
Mały komponent renderujący **klatkę `idle_00`** spirita (lewy-górny róg arkusza,
68×68 — jednolite dla wszystkich spiritów i motywów, potwierdzone w atlasach).
- Źródło: `/assets/${themeId}/heroes/${sprite}-default.png` (`themeId` z `useSettings`).
- Kadr: `div` z `backgroundImage`, `backgroundPosition: '0 0'`, `backgroundRepeat: 'no-repeat'`,
  `imageRendering: 'pixelated'`. Pole ~64px (klatka 68px skalowana wew. `transform: scale`
  z `transform-origin: top left` w kontenerze `overflow: hidden`).
- Brak assetu → puste pole (jak fallback miniatury budynku); nazwa spirita i tak jest obok.
- Stała `SPRITE_FRAME = 68` w module (bez czytania atlasu w runtime).

### 4.2 `model-sprite-edit.ts` (czyste helpery — testowalne)
Operacje na płaskim `sprites[]`, bez Reacta:
- `groupBySprite(config): Record<SpriteId, { name?: string; rules: { match: ModelMatch; index: number }[] }>`
  — dla każdego `SPRITE_ID`: reguły z tym sprite'em (z oryginalnym indeksem) + nazwa
  (z pierwszej reguły, która ma `displayName`).
- `addSpriteModel(config, sprite, pattern, name?): ModelConfig` — dopisuje regułę
  `{ match: { kind: 'pattern', pattern }, sprite, displayName: name }` (pomija pusty pattern).
- `removeSpriteRule(config, index): ModelConfig` — usuwa regułę o indeksie.
- `renameSprite(config, sprite, name): ModelConfig` — ustawia `displayName` na wszystkich
  regułach danego spirita (`undefined` gdy pusty string).
- `setFallbackSprite(config, sprite): ModelConfig` — ustawia `fallback.sprite`.

### 4.3 `ModelRegistryEditor` — sekcja „Bohaterowie (spirity)"
Zastępuje płaskie wiersze tożsamości. Pętla po `SPRITE_IDS` (zawsze 4 karty) —
układ bliźniaczy do `BuildingCard`:
- `SpriteThumb` + nazwa wyświetlana (input, `renameSprite` przy zmianie),
- chipy model-wzorców z `groupBySprite(...)[sprite].rules` (✕ → `removeSpriteRule`),
  reguły `exact` renderowane z subtelnym prefiksem `=`,
- input „+ dodaj model" (Enter / ✓ → `addSpriteModel` z kind `pattern`),
- znacznik domyślnego: na karcie `sprite === fallback.sprite` etykieta `t.defaultMark`;
  na pozostałych klikalne `t.setDefault` → `setFallbackSprite`.

Sekcja „Okno kontekstu" (`windows[]` + fallback.contextWindow) — bez zmian.

### 4.4 „Widziane modele"
Do każdego wiersza dorzucić `SpriteThumb` rozwiązanego spirita (`resolveSprite(m).sprite`)
obok dotychczasowego okna i flagi fallback.

## 5. i18n

Reużyj istniejących (`spriteAndName` jako tytuł sekcji, `addRow`/`matchValue`/
`displayNameLabel`/`spriteLabel`). Nowe klucze (EN/PL/IT):
- `defaultMark` — „default" / „domyślny" / „predefinito",
- `setDefault` — „set default" / „ustaw domyślny" / „imposta predefinito".

## 6. Testy

`model-sprite-edit.test.ts` (czyste helpery):
- `groupBySprite` grupuje po sprite, niesie indeksy i nazwę z pierwszej reguły,
- `addSpriteModel` dopisuje regułę pattern (pomija pusty), z nazwą,
- `removeSpriteRule` usuwa właściwy indeks,
- `renameSprite` ustawia/zeruje displayName na wszystkich regułach spirita,
- `setFallbackSprite` zmienia fallback.sprite,
- wynik każdej operacji przechodzi `validateModelConfig` (nie psujemy formatu).

UI (karty, miniatury, reaktywność, „widziane modele") — weryfikacja na żywo w
preview (jak przy v0.3.7): otwórz Modele, sprawdź 4 karty z grafikami, dodaj/usuń
model, zmień nazwę, ustaw domyślny; potwierdź brak błędów konsoli.

## 7. Świadomie poza zakresem (YAGNI)
Selektor kind (exact/pattern) w karcie (exact tylko z JSON), nowe sprite'y dla
nie-Claude (provider = przyszłe herby), animowana miniatura, kolor per spirit.
