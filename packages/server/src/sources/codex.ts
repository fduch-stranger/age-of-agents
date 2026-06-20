import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Fact } from '../transcript/facts.js';
import { parseCodexLookbackDays } from './config.js';
import type { AgentSource, ClassifiedFile } from './types.js';

/** Skraca tekst (jak w parserze Claude). */
function clip(text: string, max = 240): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const CODEX_RUNTIME_LOOKAHEAD_DAYS = 7;
const pad2 = (n: number): string => String(n).padStart(2, '0');

function codexDateRoot(base: string, date: Date): string {
  return join(base, String(date.getFullYear()), pad2(date.getMonth() + 1), pad2(date.getDate()));
}

/* ─────────────────────────────────────────────────────────────────
 * TUNING POINT 1: heuristic for "real prompt vs. injections".
 * Codex injects as role 'user': AGENTS.md, <environment_context>,
 * permission instructions, etc. Conservatively: only role 'user' and no
 * explicit system markers. Tune this list for your sessions.
 * ───────────────────────────────────────────────────────────────── */
export function isCodexHumanPrompt(text: string, role: string | undefined): boolean {
  if (role !== 'user') return false; // 'developer'/'system' are not human prompts
  const t = text.trim();
  if (!t) return false;
  if (t.startsWith('<')) return false; // <environment_context>, <permissions…>, <INSTRUCTIONS>
  if (t.startsWith('# AGENTS.md')) return false;
  if (t.includes('<environment_context>') || t.includes('AGENTS.md instructions')) return false;
  return true;
}

/* ─────────────────────────────────────────────────────────────────
 * TUNING POINT 2: Codex tool -> canonical game name.
 * The canonical name flows into toolToBuilding (shared), so it controls which
 * building the unit walks to. This is the heart of the Codex metaphor.
 * ───────────────────────────────────────────────────────────────── */
export function codexToolToCanonical(name: string): string {
  switch (name) {
    case 'shell':
    case 'local_shell':
    case 'exec':
      return 'Bash'; // kopalnia (git w argumentach → targ, jak u Claude)
    case 'apply_patch':
      return 'Edit'; // forge
    case 'read_file':
    case 'view_image':
      return 'Read'; // biblioteka
    case 'web_search':
      return 'WebSearch'; // tower
    case 'update_plan':
      return 'update_plan'; // no mapping -> citadel
    default:
      // Codex MCP tools: 'server__tool' or 'server.tool'.
      if (name.includes('__')) return `mcp__${name}`;
      if (name.includes('.')) return `mcp__${name.replace(/\./g, '__')}`;
      return name; // nieznane → twierdza (fallback w toolToBuilding)
  }
}

/** Bubble detail from function_call arguments (Claude toolDetail analog). */
function codexToolDetail(name: string, argumentsRaw: unknown): string | undefined {
  let args: any;
  if (typeof argumentsRaw === 'string') {
    try {
      args = JSON.parse(argumentsRaw);
    } catch {
      return clip(argumentsRaw, 60);
    }
  } else if (argumentsRaw && typeof argumentsRaw === 'object') {
    args = argumentsRaw;
  } else {
    return undefined;
  }
  if (name === 'shell' || name === 'local_shell' || name === 'exec') {
    const cmd = Array.isArray(args.command) ? args.command.join(' ') : str(args.command);
    // skip typical 'bash -lc' wrapper to show the command essence
    return cmd ? clip(cmd.replace(/^bash\s+-lc\s+/, ''), 60) : undefined;
  }
  if (name === 'web_search') return str(args.query);
  if (name === 'apply_patch') {
    const patch = str(args.input) ?? '';
    const m = patch.match(/\*\*\* (?:Update|Add|Delete) File: (.+)/);
    return m ? m[1].split('/').pop() : undefined;
  }
  return str(args.path) ?? str(args.file_path);
}

/** Whether function_call result indicates an error (best-effort; formats differ). */
function codexOutputIsError(output: unknown): boolean {
  if (output && typeof output === 'object') {
    const o = output as any;
    if (typeof o.exit_code === 'number') return o.exit_code !== 0;
    if (o.success === false) return true;
  }
  return false;
}

/** Extracts cumulative token usage from token_count payload (several shapes). */
function extractCodexUsage(payload: any): { input: number; output: number } | undefined {
  const u = payload?.info?.total_token_usage ?? payload?.total_token_usage ?? payload;
  if (!u || typeof u !== 'object') return undefined;
  const input = Number(u.input_tokens ?? u.input ?? 0);
  const output = Number(u.output_tokens ?? u.output ?? 0);
  if (!input && !output) return undefined;
  return { input, output };
}

function handleMessage(payload: any, ts: string, facts: Fact[]): void {
  const role = typeof payload.role === 'string' ? payload.role : undefined;
  const blocks: any[] = Array.isArray(payload.content) ? payload.content : [];
  for (const b of blocks) {
    const text = typeof b?.text === 'string' ? b.text : '';
    if (!text) continue;
    if (b.type === 'input_text' && isCodexHumanPrompt(text, role)) {
      facts.push({ kind: 'prompt', text: clip(text), ts });
    } else if (b.type === 'output_text' && role === 'assistant' && text.trim()) {
      facts.push({ kind: 'assistant-text', text: clip(text), ts });
    }
  }
}

/**
 * Parses one Codex rollout line -> Facts. Unknown/broken record -> [].
 * Format changes between CLI versions: read defensively.
 */
export function interpretCodexLine(line: string): Fact[] {
  let record: any;
  try {
    record = JSON.parse(line);
  } catch {
    return [];
  }
  if (!record || typeof record !== 'object') return [];
  const ts: string = typeof record.timestamp === 'string' ? record.timestamp : new Date().toISOString();
  const payload = record.payload && typeof record.payload === 'object' ? record.payload : undefined;
  const facts: Fact[] = [];

  switch (record.type) {
    case 'session_meta':
      if (payload) {
        if (payload.thread_source === 'subagent') {
          const agentId = str(payload.id);
          const parentSessionId = str(payload.parent_thread_id) ?? str(payload.source?.subagent?.thread_spawn?.parent_thread_id);
          if (agentId && parentSessionId) {
            facts.push({
              kind: 'subagent-meta',
              agentId,
              parentSessionId,
              description: str(payload.agent_nickname) ?? str(payload.agent_role),
            });
          }
        }
        facts.push({ kind: 'meta', cwd: str(payload.cwd), model: str(payload.model) ?? str(payload.model_provider) });
      }
      break;

    case 'turn_context': {
      if (payload) {
        const cwd = str(payload.cwd);
        const model = str(payload.model);
        if (cwd || model) facts.push({ kind: 'meta', cwd, model });
      }
      break;
    }

    case 'response_item': {
      if (!payload) break;
      switch (payload.type) {
        case 'message':
          handleMessage(payload, ts, facts);
          break;
        case 'reasoning':
          facts.push({ kind: 'thinking', ts });
          break;
        case 'function_call': {
          const name = str(payload.name);
          if (name) {
            facts.push({
              kind: 'tool-start',
              tool: codexToolToCanonical(name),
              detail: codexToolDetail(name, payload.arguments),
              messageId: str(payload.call_id) ?? `codex-${ts}`,
              ts,
            });
          }
          break;
        }
        case 'function_call_output':
          facts.push({ kind: 'tool-result', isError: codexOutputIsError(payload.output), ts });
          break;
      }
      break;
    }

    case 'event_msg': {
      if (!payload) break;
      if (payload.type === 'token_count') {
        const u = extractCodexUsage(payload);
        if (u) facts.push({ kind: 'usage-total', input: u.input, output: u.output });
      } else if (payload.type === 'task_complete' || payload.type === 'turn_complete') {
        facts.push({ kind: 'turn-end', ts });
      }
      break;
    }
  }

  return facts;
}

/**
 * Codex source: ~/.codex/sessions/YYYY/MM/DD/rollout-<ts>-<uuid>.jsonl.
 * Path encodes DATE, not project; projectName comes from cwd in session_meta.
 */
export function codexSessionRoots(
  base = join(homedir(), '.codex', 'sessions'),
  now = new Date(),
  lookbackDays?: number,
  lookaheadDays = 1,
): string[] {
  const roots: string[] = [];
  const resolvedLookbackDays = lookbackDays ?? parseCodexLookbackDays();
  for (let offset = -resolvedLookbackDays; offset <= lookaheadDays; offset++) {
    const date = new Date(now);
    date.setDate(now.getDate() + offset);
    roots.push(codexDateRoot(base, date));
  }
  return roots;
}

export const codexSource: AgentSource = {
  id: 'codex',
  roots: () => codexSessionRoots(join(homedir(), '.codex', 'sessions'), new Date(), undefined, CODEX_RUNTIME_LOOKAHEAD_DAYS),
  depth: 6,
  classify(path: string): ClassifiedFile {
    const file = path.split('/').pop() ?? '';
    if (!file.startsWith('rollout-') || !file.endsWith('.jsonl')) return { kind: 'other' };
    const m = file.match(UUID_RE);
    if (!m) return { kind: 'other' };
    return { kind: 'session', sessionId: m[0], projectDir: '' };
  },
  parseLine: interpretCodexLine,
};
