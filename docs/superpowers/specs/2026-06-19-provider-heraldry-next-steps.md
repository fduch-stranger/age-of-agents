# Next steps: „Herby" providerów (emblemat AgentKind na sprite'cie)

Data: 2026-06-19
Status: **pomysł / next steps** (NIE zaczęte) — wymaga osobnego brainstormu → spec → plan
Kontekst bazowy: [[2026-06-19-model-registry-sprite-cards-design.md]], [[2026-06-19-model-registry-settings-design.md]]

## Pomysł (jednym zdaniem)

Provider (Claude / Codex / OpenCode / Koda) ma być **osobną osią wizualną** —
mały **emblemat/„herb"** nakładany na sprite bohatera — bo sprite (grafika ducha)
opisuje *tier modelu*, a nie *kto go uruchamia*. Dziś modele nie-Claude (np.
`glm-52-nvfp4` z OpenCode) lecą na **fallback-spirit** i nie widać, że to inny provider.

## Dlaczego

- Wspieramy wielu providerów; każdy ma wiele modeli. Spirit = tier (opus/sonnet/haiku/fable),
  „podpisany iloma modelami". Provider to **prostopadła** informacja, której spirit nie niesie.
- Po dodaniu kart spiritów (v0.3.9) widać grafikę i przypisanie modeli, ale nie providera.
  Użytkownik wprost prosił: „czy kodeks, czy klapko (Koda), czy opencode — później **herbami** rozwiązywane".

## Co już mamy (cegiełki)

- `AgentKind = 'claude' | 'codex' | 'opencode' | 'koda'` (shared) — `HeroSnapshot.agent`.
- `AGENT_BADGE` w `packages/client/src/hud/SidePanel.tsx` — `{ label, color }` per provider
  (Claude / Codex `#10a37f` / OpenCode `#f59e0b` / Koda `#8b5cf6`) — dziś kolorowy badge tekstowy.
- Provider jest **znany w runtime** ze źródła (watchery/pollery serwera ustawiają `hero.agent`),
  więc heraldyka to render, NIE nowa konfiguracja danych (w odróżnieniu od rejestru modeli).
- Sprite/render: `archetype.ts` (`sessionToArchetypeKey`), `sprites.ts` (`getHeroSheet`),
  `game/view.ts` (render bohatera na mapie), miniatura `SpriteThumb` w `ModelRegistryEditor`.

## Kierunek (do rozstrzygnięcia w brainstormie)

**Czym jest „herb":**
- (A) **Emblemat-asset** per provider (mały PNG/ikona), nakładany w rogu sprite'a. Najładniej,
  ale wymaga grafik (4 emblematy × ewentualnie motyw) — np. PixelLab.
- (B) **Badge CSS** z koloru `AGENT_BADGE` (kropka/róg/obwódka) — zero nowych assetów, spójne z dzisiejszym badge. Najszybsze MVP.
- (C) Obwódka/tinta sprite'a kolorem providera — subtelne, ale słabiej czytelne.

Rekomendacja na MVP: **(B)** — róg/kropka koloru providera; (A) jako Faza 2, gdy będą emblematy.

**Gdzie pokazać herb:**
- bohater na mapie (`game/view.ts`) — overlay na sprite,
- karty spiritów / „Widziane modele" w `ModelRegistryEditor` — emblemat przy modelu (model→provider znany? patrz niżej),
- `SidePanel` — już jest `AGENT_BADGE`; ujednolicić z herbem.

**Skąd provider dla danego stringa modelu (w ustawieniach):** w panelu mamy listę
*widzianych modeli* z `hero.model` + `hero.agent` — można pokazać herb providera obok modelu
z realnych sesji. Dla statycznej konfiguracji (model→provider) prawdopodobnie **niepotrzebne** —
provider jest runtime'owy; nie dodawać do rejestru bez wyraźnej potrzeby (YAGNI).

## Otwarte decyzje (na brainstorm)

1. Herb jako asset (A) czy badge CSS (B) na MVP?
2. Gdzie nakładać: tylko panel ustawień / „widziane modele", czy też bohater na mapie + SidePanel?
3. Czy potrzebny piąty „nieznany provider" stan i jego wygląd?
4. Czy provider ma być gdziekolwiek **konfigurowalny** przez usera, czy wyłącznie runtime z `hero.agent`?

## Szkic implementacji (niewiążący, gdy ruszymy)

- `ProviderEmblem({ agent, size })` w `hud/` — MVP: kropka/róg z `AGENT_BADGE[agent].color` + tooltip `label`.
- Render na mapie: w `game/view.ts` dorysować emblemat w rogu sprite'a bohatera wg `hero.agent`.
- W `ModelRegistryEditor` „Widziane modele": obok modelu pokazać `ProviderEmblem` (provider z `hero.agent` dla tego `hero.model`).
- Ewentualne emblematy-assety (Faza 2): `/assets/<theme>/emblems/<provider>.png` + fallback na badge CSS.
- Testy: render badge per AgentKind; mapowanie agent→kolor/label (czyste).

## Poza zakresem MVP

Pełne emblematy graficzne per motyw, animowane herby, konfiguracja provider→model w rejestrze,
nowe sprite'y per provider (sprite zostaje osią tieru, nie providera).
