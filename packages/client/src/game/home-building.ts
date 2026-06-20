import type { BuildingId } from '@agent-citadel/shared';
import type { HeroSnapshot } from '@agent-citadel/shared';
import type { ThemeDef } from '../theme/types';

/**
 * Gathering points where a new session spawns before being sent to work. Chosen
 * from a STABLE hash of the project name, so sessions from the same project
 * cluster at the same point, while different projects distribute across the map
 * instead of piling up in front of the citadel.
 *
 * The buildings per theme are ordered so each "hosts" a different subset of
 * projects (hash % count). The split is deterministic and does not depend on
 * arrival order.
 */
const HOME_BUILDINGS: Record<string, BuildingId[]> = {
  fantasy: ['arena', 'tavern', 'garden', 'bar', 'shrine'],
  scifi: ['holodeck', 'mess', 'hydroponics', 'lounge', 'medbay'],
};

/** "Waiting room" building where a hero awaiting user input goes (awaiting-input).
 *  fantasy: chapel (shrine); sci-fi: waiting room (lounge); fallback: citadel. */
const AWAITING_BY_THEME: Record<string, BuildingId> = { fantasy: 'shrine', scifi: 'lounge' };
export function awaitingBuilding(themeId: string): BuildingId {
  return AWAITING_BY_THEME[themeId] ?? 'citadel';
}

/** djb2: fast, deterministic, sufficient to spread 100+ projects. */
function projectHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Returns the building id where a NEW unit for this session should appear. If
 * the theme has no gathering points or the project is missing, fall back to the
 * citadel (the original destination).
 */
export function homeBuilding(theme: ThemeDef, hero: Pick<HeroSnapshot, 'projectName' | 'projectDir'>): BuildingId {
  const options = HOME_BUILDINGS[theme.id];
  if (!options || options.length === 0) return 'citadel';
  // Prefer projectName (shorter and more stable than an absolute path), but use
  // projectDir as fallback when missing. Both lead to the same destination if
  // the same project appears multiple times.
  const key = hero.projectName ?? hero.projectDir ?? '';
  if (!key) return 'citadel';
  return options[projectHash(key) % options.length];
}
