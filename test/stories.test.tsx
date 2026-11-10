import { describe, expect, it } from 'vitest';
import { parseView, viewNodeRegistry } from '../src';
import { STORIES } from '../playground/stories';
import { renderView } from './helpers';

describe('viewer stories', () => {
  it.each(STORIES.map((s) => [s.id, s] as const))('%s parses cleanly and renders', (_, story) => {
    const parsed = parseView(viewNodeRegistry, story.raw);
    expect(parsed.issues).toEqual([]);
    expect(() => renderView(story.raw)).not.toThrow();
  });
});
