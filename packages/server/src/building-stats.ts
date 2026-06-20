import { readFile, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  resolveBuilding,
  DEFAULT_MAPPING,
  type BuildingId,
  type BuildingStatsResponse,
  type BuildingWindowStats,
  type MappingConfig,
} from '@agent-citadel/shared';
import { loadMappingConfig } from './mapping-config.js';

/**
 * Token usage per building for day/week/30-day windows.
 *
 * Historical data does NOT exist in memory (watcher sees only live sessions), so
 * scan transcripts under ~/.claude/projects: assign each assistant message's
 * OUTPUT tokens to the building of the tool it used (toolToBuilding), split
 * evenly when it touched multiple buildings. A message without a tool (reasoning/
 * text only) is assigned to the building where the session is CURRENTLY working
 * (last used tool); otherwise Citadel (fallback) would swallow most tokens. The
 * result is cached.
 *
 * USER CONTRIBUTION (learning): attribution (even split, reasoning->last building,
 * fallback→citadel) i okna czasowe to decyzje do strojenia.
 */

const DAY = 86_400_000;
const MONTH = 30 * DAY;
const CACHE_TTL = 60_000;

interface Bucket {
  today: number;
  week: number;
  month: number;
}

export interface MsgSample {
  ts: number; // epoch ms
  output: number; // message output tokens
  tools: { name: string; detail?: string }[];
}

/**
 * Pure: add one assistant message to the accumulator (tokens->building, by time).
 * `fallback` = building for a message without a tool (current session work building).
 */
export function accumulateMessage(
  acc: Map<BuildingId, Bucket>,
  msg: MsgSample,
  now: number,
  dayStart: number,
  fallback: BuildingId = 'citadel',
  config: MappingConfig = DEFAULT_MAPPING,
): void {
  if (msg.output <= 0) return;
  const age = now - msg.ts;
  if (age < 0 || age > MONTH) return; // poza oknem 30 dni

  const buildings = msg.tools.length
    ? [...new Set(msg.tools.map((t) => resolveBuilding(t.name, t.detail, config)))]
    : [fallback]; // reasoning only -> current session work building
  const share = msg.output / buildings.length;

  for (const b of buildings) {
    const cur = acc.get(b) ?? { today: 0, week: 0, month: 0 };
    cur.month += share;
    if (age <= 7 * DAY) cur.week += share;
    if (msg.ts >= dayStart) cur.today += share;
    acc.set(b, cur);
  }
}

/** Extracts a sample from an assistant record (or null when irrelevant). */
function sampleFromRecord(rec: any): MsgSample | undefined {
  if (rec?.type !== 'assistant' || !rec.message) return undefined;
  const ts = Date.parse(rec.timestamp);
  if (!ts) return undefined;
  const output = Number(rec.message.usage?.output_tokens ?? 0);
  if (output <= 0) return undefined;
  const blocks: any[] = Array.isArray(rec.message.content) ? rec.message.content : [];
  const tools = blocks
    .filter((b) => b?.type === 'tool_use' && typeof b.name === 'string')
    .map((b) => ({
      name: b.name as string,
      detail: b.name === 'Bash' && typeof b.input?.command === 'string' ? (b.input.command as string) : undefined,
    }));
  return { ts, output, tools };
}

async function scanFile(
  path: string,
  acc: Map<BuildingId, Bucket>,
  now: number,
  dayStart: number,
  config: MappingConfig,
): Promise<void> {
  const content = await readFile(path, 'utf8');
  let current: BuildingId = 'citadel'; // current session work building (last tool)
  for (const line of content.split('\n')) {
    if (!line) continue;
    let rec: any;
    try {
      rec = JSON.parse(line);
    } catch {
      continue;
    }
    const sample = sampleFromRecord(rec);
    if (!sample) continue;
    if (sample.tools.length) {
      const last = sample.tools[sample.tools.length - 1];
      current = resolveBuilding(last.name, last.detail, config);
    }
    accumulateMessage(acc, sample, now, dayStart, current, config);
  }
}

export async function computeBuildingStats(
  root: string,
  now: number,
  config: MappingConfig = DEFAULT_MAPPING,
): Promise<BuildingStatsResponse> {
  const ds = new Date(now);
  ds.setHours(0, 0, 0, 0);
  const dayStart = ds.getTime();

  const acc = new Map<BuildingId, Bucket>();
  let entries: string[] = [];
  try {
    entries = await readdir(root, { recursive: true });
  } catch {
    return { updatedAt: new Date(now).toISOString(), buildings: {} };
  }

  for (const rel of entries) {
    if (!rel.endsWith('.jsonl')) continue;
    const path = join(root, rel);
    try {
      const s = await stat(path);
      if (now - s.mtimeMs > MONTH) continue; // file has no events in the 30-day window
      await scanFile(path, acc, now, dayStart, config);
    } catch {
      /* skip unreadable file */
    }
  }

  const buildings: BuildingStatsResponse['buildings'] = {};
  for (const [b, v] of acc) {
    buildings[b] = {
      today: Math.round(v.today),
      week: Math.round(v.week),
      month: Math.round(v.month),
    } satisfies BuildingWindowStats;
  }
  return { updatedAt: new Date(now).toISOString(), buildings };
}

// Cache: scan is expensive (many sessions x 30 days), so compute at most once/min.
let cache: { at: number; data: BuildingStatsResponse } | undefined;
let inflight: Promise<BuildingStatsResponse> | undefined;
// Epoch counter: invalidation bumps it; a pass writes cache ONLY when the epoch
// has not changed since it started. Otherwise PUT during a scan would cache a
// result computed with the OLD config for the entire TTL.
let epoch = 0;

/** After map edit (PUT /tool-mapping), drop cache so numbers catch up with the new config. */
export function invalidateBuildingStatsCache(): void {
  cache = undefined;
  inflight = undefined; // abandon in-flight pass; its result is already stale
  epoch++;
}

export async function getBuildingStats(
  root = join(homedir(), '.claude', 'projects'),
): Promise<BuildingStatsResponse> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL) return cache.data;
  if (inflight) return inflight;
  const startEpoch = epoch;
  inflight = loadMappingConfig()
    .then((config) => computeBuildingStats(root, now, config))
    .then((data) => {
      // Save cache only if the map was not invalidated in the meantime.
      if (epoch === startEpoch) {
        cache = { at: Date.now(), data };
        inflight = undefined;
      }
      return data;
    })
    .catch((err) => {
      if (epoch === startEpoch) inflight = undefined;
      throw err;
    });
  return inflight;
}
