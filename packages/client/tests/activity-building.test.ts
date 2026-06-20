import { describe, expect, it } from 'vitest';
import { DEFAULT_MAPPING } from '@agent-citadel/shared';
import { activityBuildingForAction, activityBuildingForHero } from '../src/game/home-building';

describe('activity building attribution', () => {
  it('keeps working sessions on their mapped tool building', () => {
    expect(activityBuildingForHero('fantasy', {
      state: 'working',
      currentTool: 'Read',
      projectName: 'age-of-agents',
      projectDir: '/repo/age-of-agents',
    }, DEFAULT_MAPPING)).toBe('library');
  });

  it('sends awaiting-input sessions to the theme waiting building', () => {
    expect(activityBuildingForHero('fantasy', {
      state: 'awaiting-input',
      projectName: 'age-of-agents',
      projectDir: '/repo/age-of-agents',
    }, DEFAULT_MAPPING)).toBe('shrine');
  });

  it('does not infer idle or sleeping physical location from project home', () => {
    expect(activityBuildingForHero('fantasy', {
      state: 'idle',
      projectName: 'age-of-agents',
      projectDir: '/repo/age-of-agents',
    }, DEFAULT_MAPPING)).toBeUndefined();
    expect(activityBuildingForHero('fantasy', {
      state: 'sleeping',
      projectName: 'age-of-agents',
      projectDir: '/repo/age-of-agents',
    }, DEFAULT_MAPPING)).toBeUndefined();
  });

  it('does not count returning sessions as social-building presence', () => {
    expect(activityBuildingForHero('fantasy', {
      state: 'returning',
      projectName: 'age-of-agents',
      projectDir: '/repo/age-of-agents',
    }, DEFAULT_MAPPING)).toBeUndefined();
  });

  it('assigns completed action entries to theme resting buildings', () => {
    expect(activityBuildingForAction({ kind: 'completed', projectName: 'age-of-agents', projectDir: '/repo/age-of-agents' }, 'fantasy', DEFAULT_MAPPING)).toBe('garden');
    expect(activityBuildingForAction({ kind: 'completed', projectName: 'age-of-agents', projectDir: '/repo/age-of-agents' }, 'scifi', DEFAULT_MAPPING)).toBe('hydroponics');
  });
});
