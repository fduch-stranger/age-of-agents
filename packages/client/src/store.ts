import { create } from 'zustand';
import type {
  GameEvent,
  HeroSnapshot,
  MissionSnapshot,
  PeonSnapshot,
  TranscriptLine,
} from '@agent-citadel/shared';

interface WorldStore {
  connected: boolean;
  heroes: Record<string, HeroSnapshot>;
  peons: Record<string, PeonSnapshot>;
  missions: Record<string, MissionSnapshot>;
  /** Ostatnie linie transkryptu per sesja (bufor do panelu bocznego). */
  transcripts: Record<string, TranscriptLine[]>;
  selectedSessionId?: string;
  setConnected(connected: boolean): void;
  select(sessionId?: string): void;
  apply(event: GameEvent): void;
}

const TRANSCRIPT_BUFFER = 200;

export const useWorld = create<WorldStore>((set) => ({
  connected: false,
  heroes: {},
  peons: {},
  missions: {},
  transcripts: {},
  setConnected: (connected) => set({ connected }),
  select: (selectedSessionId) => set({ selectedSessionId }),
  apply: (event) =>
    set((state) => {
      switch (event.type) {
        case 'snapshot':
          return {
            heroes: Object.fromEntries(event.heroes.map((h) => [h.sessionId, h])),
            peons: Object.fromEntries(event.peons.map((p) => [p.agentId, p])),
            missions: Object.fromEntries(event.missions.map((m) => [m.id, m])),
          };
        case 'hero-spawned':
        case 'hero-updated':
          return { heroes: { ...state.heroes, [event.hero.sessionId]: event.hero } };
        case 'hero-removed': {
          const heroes = { ...state.heroes };
          delete heroes[event.sessionId];
          return { heroes };
        }
        case 'peon-spawned':
        case 'peon-updated':
          return { peons: { ...state.peons, [event.peon.agentId]: event.peon } };
        case 'peon-completed': {
          const peons = { ...state.peons };
          delete peons[event.agentId];
          return { peons };
        }
        case 'mission-started':
        case 'mission-completed':
          return { missions: { ...state.missions, [event.mission.id]: event.mission } };
        case 'transcript-line': {
          const lines = state.transcripts[event.line.sessionId] ?? [];
          return {
            transcripts: {
              ...state.transcripts,
              [event.line.sessionId]: [...lines, event.line].slice(-TRANSCRIPT_BUFFER),
            },
          };
        }
        default:
          return state;
      }
    }),
}));
