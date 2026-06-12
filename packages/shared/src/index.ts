/** Protokół WebSocket Agent Citadel — wspólne typy serwera i klienta. */

export type HeroStateKind =
  | 'thinking'
  | 'working'
  | 'awaiting-input'
  | 'idle'
  | 'sleeping'
  | 'error'
  | 'returning';

export interface HeroSnapshot {
  sessionId: string;
  title: string;
  projectDir: string;
  model?: string;
  gitBranch?: string;
  permissionMode?: string;
  /** Indeks w palecie kolorów drużyn (klient mapuje na barwę). */
  teamColor: number;
  state: HeroStateKind;
  /** Nazwa narzędzia gdy state === 'working', np. 'Edit' lub 'mcp__slack__send'. */
  currentTool?: string;
  /** Krótki opis do dymka nad jednostką (np. Bash.description). */
  toolDetail?: string;
  tokens: { input: number; output: number };
  startedAt: string;
  lastActivityAt: string;
}

export interface PeonSnapshot {
  agentId: string;
  parentSessionId: string;
  state: HeroStateKind;
  currentTool?: string;
  description?: string;
}

export type MissionStatus = 'active' | 'completed' | 'failed';

export interface MissionSnapshot {
  id: string;
  sessionId: string;
  prompt: string;
  status: MissionStatus;
  startedAt: string;
  completedAt?: string;
}

export interface WorldSnapshot {
  heroes: HeroSnapshot[];
  peons: PeonSnapshot[];
  missions: MissionSnapshot[];
}

/** Linia transkryptu do panelu bocznego (skrót, nie pełna treść). */
export interface TranscriptLine {
  sessionId: string;
  role: 'user' | 'assistant';
  text: string;
  ts: string;
}

export type GameEvent =
  | ({ type: 'snapshot' } & WorldSnapshot)
  | { type: 'hero-spawned'; hero: HeroSnapshot }
  | { type: 'hero-updated'; hero: HeroSnapshot }
  | { type: 'hero-removed'; sessionId: string }
  | { type: 'peon-spawned'; peon: PeonSnapshot }
  | { type: 'peon-updated'; peon: PeonSnapshot }
  | { type: 'peon-completed'; agentId: string }
  | { type: 'mission-started'; mission: MissionSnapshot }
  | { type: 'mission-completed'; mission: MissionSnapshot }
  | { type: 'transcript-line'; line: TranscriptLine };

export const SERVER_PORT = 8123;
export const WS_PATH = '/ws';
