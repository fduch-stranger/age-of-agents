import { useWorld } from './store';
import type { HeroStateKind } from '@agent-citadel/shared';

const STATE_LABEL: Record<HeroStateKind, string> = {
  thinking: 'myśli…',
  working: 'pracuje',
  'awaiting-input': 'czeka na Ciebie!',
  idle: 'bezczynny',
  sleeping: 'śpi',
  error: 'błąd',
  returning: 'wraca do twierdzy',
};

/**
 * Tymczasowy podgląd DOM stanu świata (etap 1).
 * Etap 3 zastąpi listę sceną PixiJS, a HUD przejmie panele.
 */
export function App() {
  const connected = useWorld((s) => s.connected);
  const heroes = useWorld((s) => s.heroes);
  const peons = useWorld((s) => s.peons);
  const missions = useWorld((s) => s.missions);

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22 }}>
        Agent Citadel <span style={{ fontSize: 13, opacity: 0.7 }}>{connected ? '● połączono' : '○ łączenie…'}</span>
      </h1>

      <h2 style={{ fontSize: 16 }}>Bohaterowie</h2>
      {Object.values(heroes).length === 0 && <p style={{ opacity: 0.6 }}>Brak aktywnych sesji.</p>}
      <ul>
        {Object.values(heroes).map((hero) => (
          <li key={hero.sessionId}>
            <strong>{hero.title}</strong> — {STATE_LABEL[hero.state]}
            {hero.currentTool ? ` (${hero.currentTool})` : ''}
            {hero.toolDetail ? ` „${hero.toolDetail}”` : ''}
            <span style={{ opacity: 0.6 }}> · {hero.tokens.output.toLocaleString('pl-PL')} tok</span>
          </li>
        ))}
      </ul>

      <h2 style={{ fontSize: 16 }}>Peony (subagenci)</h2>
      <ul>
        {Object.values(peons).map((peon) => (
          <li key={peon.agentId}>
            {peon.description ?? peon.agentId} — {STATE_LABEL[peon.state]}
            {peon.currentTool ? ` (${peon.currentTool})` : ''}
          </li>
        ))}
      </ul>

      <h2 style={{ fontSize: 16 }}>Misje</h2>
      <ul>
        {Object.values(missions).map((mission) => (
          <li key={mission.id}>
            {mission.prompt} — {mission.status === 'active' ? 'w toku' : mission.status === 'completed' ? 'ukończona' : 'nieudana'}
          </li>
        ))}
      </ul>
    </div>
  );
}
