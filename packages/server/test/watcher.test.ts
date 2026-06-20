import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isLiveAtStartup } from '../src/watcher.js';
import { DEFAULT_THRESHOLDS } from '../src/state-machine.js';
import { SourceWatcher } from '../src/watcher.js';
import { World } from '../src/world.js';
import type { AgentSource } from '../src/sources/types.js';
import type { Fact } from '../src/transcript/facts.js';

const chokidarWatchSpy = vi.hoisted(() => vi.fn<typeof import('chokidar').watch>());

vi.mock('chokidar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('chokidar')>();
  chokidarWatchSpy.mockImplementation(actual.watch);
  return { ...actual, watch: chokidarWatchSpy };
});

async function waitFor(check: () => boolean): Promise<void> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  expect(check()).toBe(true);
}

describe('isLiveAtStartup — okno wykrywania sesji przy starcie', () => {
  const now = Date.parse('2026-06-14T12:00:00.000Z');
  // Okno startowe = removeAfterMs: tworzymy bohatera tylko dla sesji, która i tak
  // by nie została od razu usunięta przez maszynę stanów (brak migotania).
  const W = DEFAULT_THRESHOLDS.removeAfterMs;

  it('sesja cicha od 20 min jest żywa przy starcie (regresja: stare 10-min okno ją gubiło)', () => {
    expect(isLiveAtStartup(now - 20 * 60_000, now, W)).toBe(true);
  });

  it('sesja cicha od 40 min (poza removeAfterMs) nie jest żywa przy starcie', () => {
    expect(isLiveAtStartup(now - 40 * 60_000, now, W)).toBe(false);
  });

  it('świeżo zapisana sesja (1 min) jest żywa', () => {
    expect(isLiveAtStartup(now - 60_000, now, W)).toBe(true);
  });
});

describe('SourceWatcher — subagenci z metadanych źródła', () => {
  it('does not create a chokidar watcher when a source has no roots', async () => {
    chokidarWatchSpy.mockClear();
    const world = new World();
    const source: AgentSource = {
      id: 'koda',
      roots: () => [],
      classify: () => ({ kind: 'other' }),
      parseLine: () => [],
    };
    const watcher = new SourceWatcher(world, source, DEFAULT_THRESHOLDS);

    try {
      expect(() => watcher.start()).not.toThrow();
      await watcher.stop();
      expect(chokidarWatchSpy).not.toHaveBeenCalled();
      expect(world.snapshot()).toEqual({ heroes: [], peons: [], missions: [] });
    } finally {
      chokidarWatchSpy.mockClear();
    }
  });

  it('uses polling for transcript roots to avoid native watcher exhaustion', async () => {
    chokidarWatchSpy.mockClear();
    const fakeWatcher = {
      add: vi.fn(),
      close: vi.fn(),
      on: vi.fn().mockReturnThis(),
    };
    chokidarWatchSpy.mockReturnValueOnce(fakeWatcher as unknown as ReturnType<typeof import('chokidar').watch>);
    const source: AgentSource = {
      id: 'codex',
      roots: () => ['/virtual/codex/sessions/2026/06/20'],
      classify: () => ({ kind: 'other' }),
      parseLine: () => [],
    };
    const watcher = new SourceWatcher(new World(), source, DEFAULT_THRESHOLDS);

    try {
      watcher.start();
      expect(chokidarWatchSpy).toHaveBeenCalledWith(
        ['/virtual/codex/sessions/2026/06/20'],
        expect.objectContaining({ usePolling: true, interval: 1_000 }),
      );
    } finally {
      await watcher.stop();
      chokidarWatchSpy.mockClear();
    }
  });

  it('plik sklasyfikowany jako sesja może zostać przekierowany do peona po subagent-meta', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'aoa-watcher-'));
    const world = new World();
    const source: AgentSource = {
      id: 'codex',
      roots: () => [dir],
      classify: (path) => path.endsWith('.jsonl')
        ? { kind: 'session', sessionId: 'child-session', projectDir: '' }
        : { kind: 'other' },
      parseLine: (line): Fact[] => JSON.parse(line) as Fact[],
    };
    const watcher = new SourceWatcher(world, source, DEFAULT_THRESHOLDS);
    try {
      watcher.start();
      await writeFile(
        join(dir, 'rollout-child-session.jsonl'),
        [
          JSON.stringify([{ kind: 'subagent-meta', agentId: 'child-session', parentSessionId: 'parent-session', description: 'Leibniz' }]),
          JSON.stringify([{ kind: 'tool-start', tool: 'Bash', detail: 'npm test', messageId: 'c1', ts: '2026-06-19T20:14:30.000Z' }]),
        ].join('\n') + '\n',
      );

      await waitFor(() => world.snapshot().peons.length === 1);
      expect(world.snapshot().heroes).toEqual([]);
      expect(world.snapshot().peons[0]).toMatchObject({
        agentId: 'child-session',
        parentSessionId: 'parent-session',
        description: 'Leibniz',
        state: 'working',
        currentTool: 'Bash',
      });
    } finally {
      await watcher.stop();
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('SourceWatcher — odświeżanie korzeni', () => {
  it('dodaje nowe korzenie podczas sweep bez usuwania starych', () => {
    const dir1 = '/virtual/aoa-watcher-root-a';
    const dir2 = '/virtual/aoa-watcher-root-b';
    const world = new World();
    let roots = [dir1];
    const source: AgentSource = {
      id: 'codex',
      roots: () => roots,
      classify: (path) => path.endsWith('.jsonl')
        ? { kind: 'session', sessionId: 'new-session', projectDir: '' }
        : { kind: 'other' },
      parseLine: (line): Fact[] => JSON.parse(line) as Fact[],
    };
    const watcher = new SourceWatcher(world, source, DEFAULT_THRESHOLDS);
    const fakeWatcher = { add: vi.fn() };
    const internals = watcher as unknown as {
      watcher: typeof fakeWatcher;
      sweep(): void;
      rootFor(path: string): string | undefined;
    };
    internals.watcher = fakeWatcher;

    roots = [dir2];
    internals.sweep();

    expect(fakeWatcher.add).toHaveBeenCalledWith([dir2]);
    expect(internals.rootFor(join(dir1, 'rollout-old-session.jsonl'))).toBe(dir1);
    expect(internals.rootFor(join(dir2, 'rollout-new-session.jsonl'))).toBe(dir2);
  });
});
