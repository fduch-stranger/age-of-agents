import { describe, it, expect, beforeEach } from 'vitest';
import { useWorld } from '../src/store';
import type { ProjectArsenal } from '@agent-citadel/shared';

beforeEach(() => {
  useWorld.setState({ autofollow: false, selectedSessionId: undefined, selectedBuildingId: undefined, heroes: {} });
});

describe('autofollow w store', () => {
  it('domyślnie wyłączony', () => {
    expect(useWorld.getState().autofollow).toBe(false);
  });

  it('setAutofollow(true) włącza', () => {
    useWorld.getState().setAutofollow(true);
    expect(useWorld.getState().autofollow).toBe(true);
  });

  it('zmiana zaznaczenia na INNĄ jednostkę resetuje autofollow', () => {
    useWorld.getState().select('hero-1');
    useWorld.getState().setAutofollow(true);
    useWorld.getState().select('hero-2');
    expect(useWorld.getState().autofollow).toBe(false);
    expect(useWorld.getState().selectedSessionId).toBe('hero-2');
  });

  it('ponowny klik w TĘ SAMĄ śledzoną jednostkę NIE zrywa autofollow', () => {
    useWorld.getState().select('hero-1');
    useWorld.getState().setAutofollow(true);
    useWorld.getState().select('hero-1');
    expect(useWorld.getState().autofollow).toBe(true);
  });

  it('zamknięcie panelu (select(undefined)) resetuje autofollow', () => {
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

  it('usunięcie ŚLEDZONEGO bohatera czyści selekcję i autofollow', () => {
    useWorld.getState().select('hero-1');
    useWorld.getState().setAutofollow(true);
    useWorld.getState().apply({ type: 'hero-removed', sessionId: 'hero-1' });
    expect(useWorld.getState().selectedSessionId).toBeUndefined();
    expect(useWorld.getState().autofollow).toBe(false);
  });

  it('usunięcie INNEGO bohatera nie zmienia selekcji/autofollow', () => {
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
  it('zapisuje arsenał per projectDir', () => {
    useWorld.getState().apply({ type: 'arsenal-updated', arsenal: arsenal({ projectDir: 'PD' }) });
    expect(useWorld.getState().arsenal['PD']?.projectName).toBe('p');
  });
});
