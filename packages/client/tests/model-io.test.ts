import { describe, expect, it } from 'vitest';
import { parseUploadedModelConfig } from '../src/hud/model-io';
import { DEFAULT_MODEL_CONFIG } from '../src/theme/models';

describe('parseUploadedModelConfig', () => {
  it('poprawny config → ok', () => {
    const res = parseUploadedModelConfig(JSON.stringify(DEFAULT_MODEL_CONFIG));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.config.windows.length).toBe(DEFAULT_MODEL_CONFIG.windows.length);
  });
  it('niepoprawny JSON → błąd', () => {
    expect(parseUploadedModelConfig('{ to nie json').ok).toBe(false);
  });
  it('poprawny JSON, zła struktura → błąd', () => {
    expect(parseUploadedModelConfig('{"foo":1}').ok).toBe(false);
  });
});
