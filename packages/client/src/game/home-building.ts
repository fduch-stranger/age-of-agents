import {
  activityBuildingForAction,
  activityBuildingForHero,
  awaitingBuildingForTheme,
  homeBuildingForTheme,
  type BuildingId,
  type HeroSnapshot,
} from '@agent-citadel/shared';
import type { ThemeDef } from '../theme/types';

/** "Waiting room" building where a hero awaiting user input goes (awaiting-input).
 *  fantasy: chapel (shrine); sci-fi: waiting room (lounge); fallback: citadel. */
export function awaitingBuilding(themeId: string): BuildingId {
  return awaitingBuildingForTheme(themeId);
}

/**
 * Returns the building id where a NEW unit for this session should appear. If
 * the theme has no gathering points or the project is missing, fall back to the
 * citadel (the original destination).
 */
export function homeBuilding(theme: ThemeDef, hero: Pick<HeroSnapshot, 'projectName' | 'projectDir'>): BuildingId {
  return homeBuildingForTheme(theme.id, hero);
}

export { activityBuildingForAction, activityBuildingForHero };
