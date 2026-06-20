import type { AgentKind, HeroSnapshot } from '@agent-citadel/shared';

/** Jeden widziany model + zbiór providerów, pod którymi go uruchamiano (do herbów). */
export interface SeenModel {
  model: string;
  agents: AgentKind[];
}

/**
 * Agreguje widziane sesje do listy (model → providerzy). Zachowuje kolejność
 * pierwszego wystąpienia (Map/Set) i deduplikuje providerów. Brak agenta → 'claude'
 * (zgodność wsteczna z HeroSnapshot.agent?). Bohaterowie bez modelu są pomijani.
 */
export function seenModelsByAgent(heroes: HeroSnapshot[]): SeenModel[] {
  const byModel = new Map<string, Set<AgentKind>>();
  for (const h of heroes) {
    if (!h.model) continue;
    let agents = byModel.get(h.model);
    if (!agents) byModel.set(h.model, (agents = new Set()));
    agents.add(h.agent ?? 'claude');
  }
  return [...byModel].map(([model, agents]) => ({ model, agents: [...agents] }));
}
