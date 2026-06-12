import type { HeroSnapshot, HeroStateKind } from '@agent-citadel/shared';
import type { World } from '../world.js';

/**
 * Tryb demo: syntetyczne sesje przechodzące przez te same zdarzenia,
 * które generuje prawdziwy watcher. Klient nie odróżnia demo od produkcji.
 */

const TOOLS = ['Read', 'Grep', 'Edit', 'Bash', 'WebSearch', 'Write'] as const;

function makeHero(world: World, sessionId: string, title: string): HeroSnapshot {
  const now = new Date().toISOString();
  return {
    sessionId,
    title,
    projectDir: '/demo/projekt',
    model: 'claude-fable-5',
    gitBranch: 'main',
    teamColor: world.claimTeamColor(),
    state: 'idle',
    tokens: { input: 0, output: 0 },
    startedAt: now,
    lastActivityAt: now,
  };
}

function patchHero(
  world: World,
  sessionId: string,
  patch: Partial<Pick<HeroSnapshot, 'state' | 'currentTool' | 'toolDetail' | 'tokens'>>,
): void {
  const hero = world.getHero(sessionId);
  if (!hero) return;
  world.upsertHero({ ...hero, ...patch, lastActivityAt: new Date().toISOString() });
}

export function startDemo(world: World): void {
  const heroes = [
    makeHero(world, 'demo-1', 'Napraw testy auth'),
    makeHero(world, 'demo-2', 'Refactor API płatności'),
  ];
  for (const hero of heroes) world.upsertHero(hero);

  world.startMission({
    id: 'demo-m1',
    sessionId: 'demo-1',
    prompt: 'Napraw failujące testy modułu auth',
    status: 'active',
    startedAt: new Date().toISOString(),
  });

  // Prosty cykl życia: każdy bohater co kilka sekund myśli -> pracuje innym
  // narzędziem -> wraca. Etap 2 zastąpi to skryptowanym scenariuszem.
  let tick = 0;
  setInterval(() => {
    tick++;
    for (const [index, hero] of heroes.entries()) {
      const phase = (tick + index * 2) % 6;
      const state: HeroStateKind = phase === 0 ? 'thinking' : phase === 5 ? 'returning' : 'working';
      const tool = TOOLS[(tick + index * 3) % TOOLS.length];
      patchHero(world, hero.sessionId, {
        state,
        currentTool: state === 'working' ? tool : undefined,
        toolDetail: state === 'working' && tool === 'Bash' ? 'npm test -- auth' : undefined,
        tokens: { input: tick * 900, output: tick * 320 },
      });
    }

    if (tick === 4) {
      world.upsertPeon({
        agentId: 'demo-peon-1',
        parentSessionId: 'demo-1',
        state: 'working',
        currentTool: 'Grep',
        description: 'Szukam użyć starego API',
      });
    }
    if (tick === 9) world.completePeon('demo-peon-1');
    if (tick === 12) world.completeMission('demo-m1', 'completed', new Date().toISOString());
  }, 2500);
}
