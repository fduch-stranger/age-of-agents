import { describe, expect, it } from 'vitest';
import { parseUploadedMapping } from '../src/hud/mapping-io';
import { DEFAULT_MAPPING } from '../src/theme/mapping';

describe('parseUploadedMapping', () => {
  it('poprawny config → ok', () => {
    const res = parseUploadedMapping(JSON.stringify(DEFAULT_MAPPING));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.config.rules.length).toBe(DEFAULT_MAPPING.rules.length);
  });
  it('niepoprawny JSON → błąd', () => {
    expect(parseUploadedMapping('{ to nie json').ok).toBe(false);
  });
  it('poprawny JSON, zła struktura → błąd', () => {
    expect(parseUploadedMapping('{"foo":1}').ok).toBe(false);
  });
});
