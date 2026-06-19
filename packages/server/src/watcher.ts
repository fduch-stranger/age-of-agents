import { watch, type FSWatcher } from 'chokidar';
import { sep } from 'node:path';
import type { PeonSnapshot } from '@agent-citadel/shared';
import { TailRegistry } from './transcript/tail.js';
import { DEFAULT_THRESHOLDS, SessionTracker, type StateThresholds } from './state-machine.js';
import type { AgentSource, ClassifiedFile } from './sources/types.js';
import type { World } from './world.js';

/**
 * Czy sesja jest „żywa" przy starcie serwera. Okno = removeAfterMs (z progów):
 * tworzymy bohatera tylko dla sesji, której maszyna stanów i tak by od razu nie
 * usunęła. Dzięki temu sesje w toku, ale chwilowo ciche (czekają na input, autor
 * odszedł na chwilę), pojawiają się od razu, a stare nie migoczą (nie powstają
 * tylko po to, by zniknąć na pierwszym sweepie). Wcześniej sztywne 10 min gubiło
 * trwające sesje, które przez moment nic nie dopisały do transkryptu.
 */
export function isLiveAtStartup(mtimeMs: number, nowMs: number, windowMs: number): boolean {
  return mtimeMs > nowMs - windowMs;
}
/** Większe pliki tail-ujemy od końca zamiast odtwarzać całą historię. */
const REPLAY_MAX_BYTES = 2 * 1024 * 1024;
const SWEEP_INTERVAL_MS = 15_000;

interface PeonEntry {
  peon: PeonSnapshot;
  lastWriteMs: number;
}

interface SubagentTarget {
  agentId: string;
  parentSessionId: string;
  description?: string;
}

/**
 * Obserwuje korzeń(e) jednego źródła (Claude/Codex): główne transkrypty sesji
 * (bohaterowie) i — jeśli źródło je rozpoznaje — subagentów (peony).
 * Cała wiedza o lokalizacji i formacie pochodzi z AgentSource.
 */
export class SourceWatcher {
  private tails = new TailRegistry();
  private trackers = new Map<string, SessionTracker>();
  private peons = new Map<string, PeonEntry>();
  private subagentFiles = new Map<string, SubagentTarget>();
  private watcher?: FSWatcher;
  private sweepTimer?: NodeJS.Timeout;
  private queue = Promise.resolve();
  private roots: string[];

  constructor(
    private readonly world: World,
    private readonly source: AgentSource,
    private readonly thresholds: StateThresholds = DEFAULT_THRESHOLDS,
  ) {
    this.roots = source.roots();
  }

  get id() {
    return this.source.id;
  }

  start(): void {
    this.refreshRoots();
    this.watcher = watch(this.roots, {
      depth: this.source.depth ?? 6,
      ignoreInitial: false,
      alwaysStat: true,
      // Ignorujemy tylko POTWIERDZONE pliki bez .jsonl (bez stats nie wolno —
      // ucięlibyśmy traversal drzewa).
      ignored: (path, stats) => stats?.isFile() === true && !path.endsWith('.jsonl'),
    });
    const enqueue = (path: string, stats?: { mtimeMs?: number; size?: number }, initial = false) => {
      this.queue = this.queue
        .then(() => this.handleFile(path, stats, initial))
        .catch((err) => console.error('[watcher]', this.source.id, path, err));
    };
    this.watcher.on('add', (path, stats) => enqueue(path, stats, true));
    this.watcher.on('change', (path, stats) => enqueue(path, stats, false));
    this.watcher.on('error', (err) => console.error('[watcher]', this.source.id, err));
    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    clearInterval(this.sweepTimer);
    await this.watcher?.close();
  }

  /** Szybki kanał: fakty z hooków HTTP trafiają do tej samej maszyny stanów. */
  applyExternalFacts(sessionId: string, projectDir: string, facts: import('./transcript/facts.js').Fact[]): void {
    let tracker = this.trackers.get(sessionId);
    if (!tracker) {
      tracker = new SessionTracker(this.world, sessionId, projectDir, this.thresholds, this.source.id);
      this.trackers.set(sessionId, tracker);
    }
    for (const fact of facts) tracker.apply(fact);
  }

  private rootFor(path: string): string | undefined {
    return this.roots.find((r) => path === r || path.startsWith(r + sep));
  }

  private refreshRoots(): void {
    const nextRoots = Array.from(new Set(this.source.roots()));
    const currentRoots = new Set(this.roots);
    const newRoots = nextRoots.filter((root) => !currentRoots.has(root));
    if (newRoots.length === 0) return;
    this.roots = [...this.roots, ...newRoots];
    this.watcher?.add(newRoots);
  }

  private classify(path: string): ClassifiedFile {
    const root = this.rootFor(path);
    if (!root) return { kind: 'other' };
    return this.source.classify(path, root);
  }

  private async handleFile(
    path: string,
    stats: { mtimeMs?: number; size?: number } | undefined,
    initial: boolean,
  ): Promise<void> {
    if (!path.endsWith('.jsonl')) return;
    const target = this.classify(path);
    if (target.kind === 'other') return;

    if (!this.tails.has(path)) {
      const fresh = !initial || isLiveAtStartup(stats?.mtimeMs ?? 0, Date.now(), this.thresholds.removeAfterMs);
      if (!fresh) return; // stara sesja — obudzi się przy zdarzeniu 'change'
      if ((stats?.size ?? 0) > REPLAY_MAX_BYTES) await this.tails.registerAtEnd(path);
    }

    const lines = await this.tails.readNewLines(path);
    if (lines.length === 0) return;

    if (target.kind === 'session') {
      const knownSubagent = this.subagentFiles.get(path);
      if (knownSubagent) {
        this.applyPeonLines(knownSubagent.agentId, knownSubagent.parentSessionId, lines, knownSubagent.description);
        return;
      }

      const sessionId = target.sessionId!;
      const parsed = lines.flatMap((line) => this.source.parseLine(line));
      const subagentMeta = parsed.find((fact): fact is import('./transcript/facts.js').Fact & { kind: 'subagent-meta' } => fact.kind === 'subagent-meta');
      if (subagentMeta) {
        const subagent = {
          agentId: subagentMeta.agentId,
          parentSessionId: subagentMeta.parentSessionId,
          description: subagentMeta.description,
        };
        this.subagentFiles.set(path, subagent);
        this.applyPeonFacts(subagent.agentId, subagent.parentSessionId, parsed, subagent.description);
        return;
      }

      let tracker = this.trackers.get(sessionId);
      if (!tracker) {
        tracker = new SessionTracker(this.world, sessionId, target.projectDir ?? '', this.thresholds, this.source.id);
        this.trackers.set(sessionId, tracker);
      }
      for (const fact of parsed) tracker.apply(fact);
    } else {
      this.applyPeonLines(target.agentId!, target.parentSessionId!, lines);
    }
  }

  private applyPeonLines(agentId: string, parentSessionId: string, lines: string[], description?: string): void {
    this.applyPeonFacts(agentId, parentSessionId, lines.flatMap((line) => this.source.parseLine(line)), description);
  }

  private applyPeonFacts(
    agentId: string,
    parentSessionId: string,
    facts: import('./transcript/facts.js').Fact[],
    description?: string,
  ): void {
    let entry = this.peons.get(agentId);
    if (!entry) {
      entry = {
        peon: { agentId, parentSessionId, state: 'working', description },
        lastWriteMs: Date.now(),
      };
      this.peons.set(agentId, entry);
    } else if (description && !entry.peon.description) {
      entry.peon = { ...entry.peon, description };
    }
    entry.lastWriteMs = Date.now();

    for (const fact of facts) {
      if (fact.kind === 'tool-start') {
        entry.peon = { ...entry.peon, state: 'working', currentTool: fact.tool, description: entry.peon.description ?? fact.detail };
      } else if (fact.kind === 'thinking') {
        entry.peon = { ...entry.peon, state: 'thinking', currentTool: undefined };
      } else if (fact.kind === 'prompt' && !entry.peon.description) {
        entry.peon = { ...entry.peon, description: fact.text.slice(0, 80) };
      }
    }
    this.world.upsertPeon(entry.peon);
  }

  private sweep(): void {
    this.refreshRoots();
    const now = Date.now();
    for (const [sessionId, tracker] of this.trackers) {
      if (tracker.tick(now) === 'remove') this.trackers.delete(sessionId);
    }
    for (const [agentId, entry] of this.peons) {
      if (now - entry.lastWriteMs > this.thresholds.peonDoneAfterMs) {
        this.world.completePeon(agentId);
        this.peons.delete(agentId);
      }
    }
  }
}
