import { describe, expect, it, vi } from 'vitest';
import type { HeroSnapshot } from '@agent-citadel/shared';
import { World } from '../src/world.js';

function hero(): HeroSnapshot {
  return {
    sessionId: 's1',
    title: 'Test',
    projectDir: '/x',
    teamColor: 0,
    state: 'working',
    tokens: { input: 0, output: 0 },
    startedAt: '2026-06-14T10:00:00.000Z',
    lastActivityAt: '2026-06-14T10:00:00.000Z',
  };
}

describe('World.emit - resilience to failing listeners', () => {
  it('throwing listener (for example broken socket.send) does not propagate error or block others', () => {
    const world = new World();
    const received: string[] = [];
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // First listener fails, mirroring a WS broadcast to a dead socket.
    world.onEvent(() => {
      throw new Error('boom');
    });
    // Second listener still must receive the event.
    world.onEvent((e) => {
      received.push(e.type);
    });

    // World mutation must not throw outward (otherwise it kills sweep/process).
    expect(() => world.upsertHero(hero())).not.toThrow();
    // Second listener still ran despite the first one's failure.
    expect(received).toContain('hero-spawned');
    // Error was reported, not silently swallowed.
    expect(errSpy).toHaveBeenCalled();

    errSpy.mockRestore();
  });
});
