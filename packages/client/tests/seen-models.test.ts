import { describe, it, expect } from 'vitest';
import { seenModelsByAgent } from '../src/hud/seen-models';
import type { AgentKind, HeroSnapshot } from '@agent-citadel/shared';

/**
 * seenModelsByAgent zastępuje inline'owy `seen` memo w ModelRegistryEditor:
 * dawniej zwijał bohaterów do Set<model>, gubiąc providera. Teraz zachowuje
 * zbiór providerów per model (do herbów obok „Widzianych modeli").
 */
const hero = (model: string | undefined, agent?: AgentKind): HeroSnapshot =>
  ({ model, agent }) as HeroSnapshot;

describe('seenModelsByAgent', () => {
  it('grupuje różne modele, zachowując kolejność pierwszego wystąpienia', () => {
    const out = seenModelsByAgent([hero('opus', 'claude'), hero('sonnet', 'claude'), hero('opus', 'claude')]);
    expect(out.map((m) => m.model)).toEqual(['opus', 'sonnet']);
  });

  it('zbiera wielu providerów per model (distinct, w kolejności wystąpienia)', () => {
    const out = seenModelsByAgent([hero('glm', 'opencode'), hero('glm', 'koda'), hero('glm', 'opencode')]);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ model: 'glm', agents: ['opencode', 'koda'] });
  });

  it('brak agenta → traktuje jak claude', () => {
    const out = seenModelsByAgent([hero('opus', undefined)]);
    expect(out[0].agents).toEqual(['claude']);
  });

  it('pomija bohaterów bez modelu', () => {
    const out = seenModelsByAgent([hero(undefined, 'codex'), hero('opus', 'codex')]);
    expect(out.map((m) => m.model)).toEqual(['opus']);
  });

  it('pusta lista → []', () => {
    expect(seenModelsByAgent([])).toEqual([]);
  });
});
