import { claudeSource } from './claude.js';
import { codexSource } from './codex.js';
import { opencodeSource } from './opencode.js';
import { kodaSource } from './koda.js';
import { filterSources } from './config.js';
import type { AgentSource } from './types.js';

/** Wszystkie znane źródła agentów. */
export const ALL_SOURCES: AgentSource[] = [claudeSource, codexSource, opencodeSource, kodaSource];

export function activeSources(raw = process.env.AOA_SOURCES): AgentSource[] {
  return filterSources(ALL_SOURCES, raw);
}

/** Wszystkie aktywne źródła agentów dla domyślnego środowiska. */
export const SOURCES: AgentSource[] = activeSources();
