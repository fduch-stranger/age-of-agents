import { describe, it, expect, beforeEach } from 'vitest';
import { useWorld } from '../src/store';
import type { ProjectArsenal } from '@agent-citadel/shared';

beforeEach(() => {
  useWorld.setState({ autofollow: false, selectedSessionId: undefined, selectedBuildingId: undefined, heroes: {} });
});

describe('autofollow in store', () => {
  it('disabled by default', () => {
    expect(useWorld.getState().autofollow).toBe(false);
  });

  it('setAutofollow(true) enables it', () => {
    useWorld.getState().setAutofollow(true);
    expect(useWorld.getState().autofollow).toBe(true);
  });

  it('selection change to a DIFFERENT unit resets autofollow', () => {
    useWorld.getState().select('hero-1');
    useWorld.getState().setAutofollow(true);
    useWorld.getState().select('hero-2');
    expect(useWorld.getState().autofollow).toBe(false);
    expect(useWorld.getState().selectedSessionId).toBe('hero-2');
  });

  it('clicking the SAME followed unit again does NOT break autofollow', () => {
    useWorld.getState().select('hero-1');
    useWorld.getState().setAutofollow(true);
    useWorld.getState().select('hero-1');
    expect(useWorld.getState().autofollow).toBe(true);
  });

  it('closing the panel (select(undefined)) resets autofollow', () => {
    useWorld.getState().select('hero-1');
    useWorld.getState().setAutofollow(true);
    useWorld.getState().select(undefined);
    expect(useWorld.getState().autofollow).toBe(false);
  });

  it('selectBuilding resetuje autofollow', () => {
    useWorld.getState().select('hero-1');
    useWorld.getState().setAutofollow(true);
    useWorld.getState().selectBuilding('forge');
    expect(useWorld.getState().autofollow).toBe(false);
  });

  it('removing the FOLLOWED hero clears selection and autofollow', () => {
    useWorld.getState().select('hero-1');
    useWorld.getState().setAutofollow(true);
    useWorld.getState().apply({ type: 'hero-removed', sessionId: 'hero-1' });
    expect(useWorld.getState().selectedSessionId).toBeUndefined();
    expect(useWorld.getState().autofollow).toBe(false);
  });

  it('removing a DIFFERENT hero does not change selection/autofollow', () => {
    useWorld.getState().select('hero-1');
    useWorld.getState().setAutofollow(true);
    useWorld.getState().apply({ type: 'hero-removed', sessionId: 'hero-2' });
    expect(useWorld.getState().selectedSessionId).toBe('hero-1');
    expect(useWorld.getState().autofollow).toBe(true);
  });
});

function arsenal(over: Partial<ProjectArsenal>): ProjectArsenal {
  return { projectDir: 'PD', projectName: 'p', activeSessions: 1, skills: [], connectors: [], hooks: [], agents: [], refreshedAt: 1, ...over };
}

describe('store arsenal-updated', () => {
  it('stores arsenal per projectDir', () => {
    useWorld.getState().apply({ type: 'arsenal-updated', arsenal: arsenal({ projectDir: 'PD' }) });
    expect(useWorld.getState().arsenal['PD']?.projectName).toBe('p');
  });
});
