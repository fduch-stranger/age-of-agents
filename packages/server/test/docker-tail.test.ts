import { describe, expect, it } from 'vitest';
import { ContainerTailRegistry } from '../src/sources/docker-tail.js';

describe('ContainerTailRegistry', () => {
  const key = ContainerTailRegistry.key('abc', '/root/.claude/projects/p/s.jsonl');

  it('dostarcza tylko pełne linie, częściową trzyma w buforze', () => {
    const tails = new ContainerTailRegistry();
    const chunk1 = '{"a":1}\n{"b":2}\n{"c":';
    expect(tails.feed(key, chunk1.length, chunk1)).toEqual(['{"a":1}', '{"b":2}']);

    const rest = '3}\n';
    expect(tails.feed(key, chunk1.length + rest.length, rest)).toEqual(['{"c":3}']);
  });

  it('registerAtEnd pomija historię (offset = rozmiar)', () => {
    const tails = new ContainerTailRegistry();
    tails.registerAtEnd(key, 100);
    expect(tails.getOffset(key)).toBe(100);
  });

  it('wykrywa skrócenie pliku i zaczyna od zera', () => {
    const tails = new ContainerTailRegistry();
    const first = '{"a":1}\n{"b":2}\n';
    tails.feed(key, first.length, first);
    // Plik nadpisany na krótszy: size < offset → reset, nowe bajty od zera.
    const reset = '{"od-nowa":1}\n';
    expect(tails.feed(key, reset.length, reset)).toEqual(['{"od-nowa":1}']);
  });

  it('brak nowych bajtów → pusta lista', () => {
    const tails = new ContainerTailRegistry();
    expect(tails.feed(key, 0, '')).toEqual([]);
  });
});
