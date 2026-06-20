import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { interpretCodexLine, codexSource, isCodexHumanPrompt, codexToolToCanonical, codexSessionRoots } from '../src/sources/codex.js';

const line = (obj: unknown) => JSON.stringify(obj);

describe('interpretCodexLine', () => {
  it('session_meta daje meta z cwd', () => {
    const facts = interpretCodexLine(
      line({ type: 'session_meta', timestamp: '2026-06-14T10:00:00.000Z', payload: { cwd: '/Users/x/proj', model_provider: 'openai' } }),
    );
    expect(facts).toContainEqual({ kind: 'meta', cwd: '/Users/x/proj', model: 'openai' });
  });

  it('session_meta subagenta Codeksa zachowuje relację do rodzica', () => {
    const facts = interpretCodexLine(
      line({
        type: 'session_meta',
        timestamp: '2026-06-19T20:14:29.437Z',
        payload: {
          id: '019ee185-46ea-7311-bd5a-e77aa01e71f6',
          parent_thread_id: '019ee169-858c-76c3-a9d4-044415be1369',
          thread_source: 'subagent',
          agent_nickname: 'Leibniz',
          agent_role: 'worker',
          cwd: '/Users/x/proj',
          model_provider: 'openai',
        },
      }),
    );
    expect(facts).toContainEqual({
      kind: 'subagent-meta',
      agentId: '019ee185-46ea-7311-bd5a-e77aa01e71f6',
      parentSessionId: '019ee169-858c-76c3-a9d4-044415be1369',
      description: 'Leibniz',
    });
    expect(facts).toContainEqual({ kind: 'meta', cwd: '/Users/x/proj', model: 'openai' });
  });

  it('prawdziwy prompt usera → fakt prompt; wstrzyknięcia → nic', () => {
    const userMsg = (text: string) =>
      interpretCodexLine(line({ type: 'response_item', timestamp: '2026-06-14T10:00:00.000Z', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } }));
    expect(userMsg('Dodaj endpoint /health')).toContainEqual({ kind: 'prompt', text: 'Dodaj endpoint /health', ts: '2026-06-14T10:00:00.000Z' });
    expect(userMsg('<environment_context>\n  <cwd>/x</cwd>\n</environment_context>')).toEqual([]);
    expect(userMsg('# AGENTS.md instructions for /x')).toEqual([]);
    // rola developer (instrukcje permissions) → nie prompt
    expect(interpretCodexLine(line({ type: 'response_item', payload: { type: 'message', role: 'developer', content: [{ type: 'input_text', text: 'normalny tekst' }] } }))).toEqual([]);
  });

  it('reasoning → thinking; assistant output_text → assistant-text', () => {
    expect(interpretCodexLine(line({ type: 'response_item', timestamp: '2026-06-14T10:00:01.000Z', payload: { type: 'reasoning', summary: [] } })))
      .toContainEqual({ kind: 'thinking', ts: '2026-06-14T10:00:01.000Z' });
    expect(interpretCodexLine(line({ type: 'response_item', timestamp: '2026-06-14T10:00:02.000Z', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Zrobione.' }] } })))
      .toContainEqual({ kind: 'assistant-text', text: 'Zrobione.', ts: '2026-06-14T10:00:02.000Z' });
  });

  it('function_call shell/apply_patch/web_search → tool-start z nazwą kanoniczną i detalem', () => {
    const shell = interpretCodexLine(line({ type: 'response_item', timestamp: '2026-06-14T10:00:03.000Z', payload: { type: 'function_call', name: 'shell', call_id: 'c1', arguments: JSON.stringify({ command: ['bash', '-lc', 'npm test'] }) } }));
    expect(shell).toContainEqual({ kind: 'tool-start', tool: 'Bash', detail: 'npm test', messageId: 'c1', ts: '2026-06-14T10:00:03.000Z' });

    const patch = interpretCodexLine(line({ type: 'response_item', timestamp: '2026-06-14T10:00:04.000Z', payload: { type: 'function_call', name: 'apply_patch', call_id: 'c2', arguments: JSON.stringify({ input: '*** Begin Patch\n*** Update File: src/app.ts\n@@\n-x\n+y\n*** End Patch' }) } }));
    expect(patch.find((f) => f.kind === 'tool-start')).toMatchObject({ kind: 'tool-start', tool: 'Edit' });

    const web = interpretCodexLine(line({ type: 'response_item', payload: { type: 'function_call', name: 'web_search', call_id: 'c3', arguments: JSON.stringify({ query: 'rust async' }) } }));
    expect(web.find((f) => f.kind === 'tool-start')).toMatchObject({ kind: 'tool-start', tool: 'WebSearch', detail: 'rust async' });
  });

  it('token_count → usage-total; task_complete → turn-end', () => {
    expect(interpretCodexLine(line({ type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 1200, output_tokens: 300 } } } })))
      .toContainEqual({ kind: 'usage-total', input: 1200, output: 300 });
    expect(interpretCodexLine(line({ type: 'event_msg', timestamp: '2026-06-14T10:05:00.000Z', payload: { type: 'task_complete' } })))
      .toContainEqual({ kind: 'turn-end', ts: '2026-06-14T10:05:00.000Z' });
  });

  it('śmieci i nieznane rekordy → pusta lista / poprawny tool-result', () => {
    expect(interpretCodexLine('to nie json{')).toEqual([]);
    expect(interpretCodexLine(line({ type: 'response_item', payload: { type: 'function_call_output', output: { exit_code: 0 } } }))).toContainEqual({ kind: 'tool-result', isError: false, ts: expect.any(String) });
    expect(interpretCodexLine(line({ type: 'totally_unknown' }))).toEqual([]);
  });
});

describe('helpery (punkty dostrojenia)', () => {
  it('isCodexHumanPrompt: prawda dla zadania, fałsz dla wstrzyknięć/roli', () => {
    expect(isCodexHumanPrompt('Napraw bug', 'user')).toBe(true);
    expect(isCodexHumanPrompt('<environment_context></environment_context>', 'user')).toBe(false);
    expect(isCodexHumanPrompt('Napraw bug', 'developer')).toBe(false);
  });
  it('codexToolToCanonical: mapuje narzędzia Codeksa na nazwy gry', () => {
    expect(codexToolToCanonical('shell')).toBe('Bash');
    expect(codexToolToCanonical('apply_patch')).toBe('Edit');
    expect(codexToolToCanonical('read_file')).toBe('Read');
    expect(codexToolToCanonical('web_search')).toBe('WebSearch');
    expect(codexToolToCanonical('pencil__draw')).toBe('mcp__pencil__draw');
  });
});

describe('codexSource.classify', () => {
  const root = '/Users/x/.codex/sessions';
  it('rollout → sesja z sessionId z UUID nazwy', () => {
    const p = `${root}/2026/02/07/rollout-2026-02-07T01-14-55-019c3573-9d33-7fc2-8fc8-56cebffe1d6b.jsonl`;
    expect(codexSource.classify(p, root)).toEqual({ kind: 'session', sessionId: '019c3573-9d33-7fc2-8fc8-56cebffe1d6b', projectDir: '' });
  });
  it('plik nie-rollout → other', () => {
    expect(codexSource.classify(`${root}/2026/02/07/notes.jsonl`, root).kind).toBe('other');
  });
});

describe('codexSessionRoots', () => {
  it('scopes watching to recent date folders instead of the whole sessions tree', () => {
    const roots = codexSessionRoots('/Users/x/.codex/sessions', new Date(2026, 5, 19, 12), 1);
    expect(roots).toEqual([
      join('/Users/x/.codex/sessions', '2026', '06', '18'),
      join('/Users/x/.codex/sessions', '2026', '06', '19'),
      join('/Users/x/.codex/sessions', '2026', '06', '20'),
    ]);
  });

  it('can include a bounded future window for runtime watchers', () => {
    const roots = codexSessionRoots('/Users/x/.codex/sessions', new Date(2026, 5, 19, 12), 1, 7);
    expect(roots).toEqual([
      join('/Users/x/.codex/sessions', '2026', '06', '18'),
      join('/Users/x/.codex/sessions', '2026', '06', '19'),
      join('/Users/x/.codex/sessions', '2026', '06', '20'),
      join('/Users/x/.codex/sessions', '2026', '06', '21'),
      join('/Users/x/.codex/sessions', '2026', '06', '22'),
      join('/Users/x/.codex/sessions', '2026', '06', '23'),
      join('/Users/x/.codex/sessions', '2026', '06', '24'),
      join('/Users/x/.codex/sessions', '2026', '06', '25'),
      join('/Users/x/.codex/sessions', '2026', '06', '26'),
    ]);
  });
});
