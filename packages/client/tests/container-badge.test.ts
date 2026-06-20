import { describe, expect, it } from 'vitest';
import { containerLabel } from '../src/hud/container-badge';

describe('containerLabel', () => {
  it('formatuje nazwę i obraz kontenera z prefiksem 🐳', () => {
    expect(containerLabel({ id: 'abc', name: 'devbox', image: 'node:20' })).toBe('🐳 devbox · node:20');
  });

  it('gdy brak obrazu, pokazuje samą nazwę', () => {
    expect(containerLabel({ id: 'abc', name: 'devbox', image: '' })).toBe('🐳 devbox');
  });
});
