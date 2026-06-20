import { describe, it, expect } from 'vitest';
import { contextPct, contextColor } from '../src/hud/context-bar';

describe('contextPct', () => {
  it('calculates percent relative to the PROVIDED window', () => {
    expect(contextPct(100_000, 200_000)).toBe(50);
    expect(contextPct(50_000, 1_000_000)).toBe(5);
  });
  it('clamps to 100; zero for invalid window', () => {
    expect(contextPct(300_000, 200_000)).toBe(100);
    expect(contextPct(1000, 0)).toBe(0);
  });
});

describe('contextColor', () => {
  it('green low, red high', () => {
    expect(contextColor(5)).toBe('#5dcaa5');
    expect(contextColor(95)).toBe('#e24b4a');
  });
});
