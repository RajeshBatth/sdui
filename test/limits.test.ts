import { describe, expect, it } from 'vitest';
import { resolveViewLimits, VIEW_CEILING, VIEW_LIMITS } from '../src/limits';

describe('resolveViewLimits', () => {
  it('uses the default budget', () => expect(resolveViewLimits(undefined)!.hard).toEqual(VIEW_LIMITS));
  it('honours a lower declared hard', () => expect(resolveViewLimits({ hard: { nodes: 50 } })!.hard.nodes).toBe(50));
  it('clamps above the ceiling', () => {
    const r = resolveViewLimits({ hard: { nodes: 5000, depth: 40 } })!;
    expect(r.hard).toEqual(VIEW_CEILING);
    expect(r.clamped).toEqual(['nodes', 'depth']);
  });
  it('returns null when soft exceeds resolved hard', () => expect(resolveViewLimits({ soft: { nodes: 300 } })).toBeNull());
  it('sheets use the ceiling as base', () => expect(resolveViewLimits(undefined, VIEW_CEILING)!.hard).toEqual(VIEW_CEILING));
});
