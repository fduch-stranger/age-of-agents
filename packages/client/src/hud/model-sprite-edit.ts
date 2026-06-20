import { SPRITE_IDS, type ModelConfig, type ModelMatch, type SpriteId, type SpriteRule } from '../theme/models';

/** Reguły jednego spirita (z oryginalnym indeksem w sprites[]) + nazwa wyświetlana. */
export interface SpriteGroup {
  name?: string;
  rules: { match: ModelMatch; index: number }[];
}

/**
 * Grupuje płaskie `sprites[]` po polu `.sprite` — widok-projekcja dla kart.
 * Zawsze zawiera WSZYSTKIE SPRITE_IDS (puste karty też się renderują).
 * `name` = displayName pierwszej reguły danego spirita, jeśli jest.
 */
export function groupBySprite(config: ModelConfig): Record<SpriteId, SpriteGroup> {
  const out = {} as Record<SpriteId, SpriteGroup>;
  for (const s of SPRITE_IDS) out[s] = { rules: [] };
  config.sprites.forEach((rule, index) => {
    const g = out[rule.sprite];
    if (!g) return; // nieznany sprite (nie przeszedłby walidacji) — pomiń
    g.rules.push({ match: rule.match, index });
    if (g.name === undefined && rule.displayName) g.name = rule.displayName;
  });
  return out;
}

/** Dopisuje regułę `pattern` dla spirita (pomija pusty pattern). */
export function addSpriteModel(config: ModelConfig, sprite: SpriteId, pattern: string, name?: string): ModelConfig {
  const p = pattern.trim();
  if (!p) return config;
  const rule: SpriteRule = { match: { kind: 'pattern', pattern: p }, sprite };
  const dn = name?.trim();
  if (dn) rule.displayName = dn; // spójnie z renameSprite — przyciętą nazwę, pusty/whitespace → brak
  return { ...config, sprites: [...config.sprites, rule] };
}

/** Usuwa regułę o danym indeksie w sprites[]. */
export function removeSpriteRule(config: ModelConfig, index: number): ModelConfig {
  return { ...config, sprites: config.sprites.filter((_, i) => i !== index) };
}

/** Ustawia displayName na WSZYSTKICH regułach spirita (pusty string → undefined). */
export function renameSprite(config: ModelConfig, sprite: SpriteId, name: string): ModelConfig {
  const displayName = name.trim() || undefined;
  return {
    ...config,
    sprites: config.sprites.map((r) => (r.sprite === sprite ? { ...r, displayName } : r)),
  };
}

/** Ustawia domyślny sprite (fallback dla niedopasowanych modeli). */
export function setFallbackSprite(config: ModelConfig, sprite: SpriteId): ModelConfig {
  return { ...config, fallback: { ...config.fallback, sprite } };
}
