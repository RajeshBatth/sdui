import { printJsx } from '../../src/authoring/print';
import type { TemplateManifest } from '../../src/authoring/template';
import { figmaUrl, type Story } from '../stories';
import { api } from './api';

export const playgroundHash = (id: string) => `#/playground?t=${encodeURIComponent(id)}`;

/** Template id from the hash (#/playground?t=hotel-card), if any. */
export function templateFromHash(): string | null {
  const q = location.hash.split('?')[1];
  return q ? new URLSearchParams(q).get('t') : null;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 56) || 'template';

/**
 * Open an explorer story in the playground: reuse the template made from it before, or create one
 * from the tree on screen (`raw`, which may include JSON edits). The story itself is left alone.
 */
export async function openStoryInPlayground(story: Story, raw: unknown): Promise<string> {
  const list = await api.list();
  const existing = list.find((t) => t.origin?.story === story.id);
  if (existing) return existing.id;
  const taken = new Set(list.map((t) => t.id));
  const base = slug(story.title);
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  const manifest: TemplateManifest = {
    id,
    name: story.title,
    prompt: `Shown when the user asks something like “${story.prompt}”. Describe what it shows and when the LLM should pick it.`,
    origin: { story: story.id, ...(story.figma ? { figma: figmaUrl(story.figma) } : {}) },
    schema: { type: 'object', properties: {} },
    samples: [{ name: 'default', data: {} }],
    variants: [{ id: 'v1', label: 'v1 · Default', file: 'v1.sdui.jsx', targets: [], fallback: true }],
  };
  await api.put(id, { manifest, sources: { v1: printJsx(raw as Record<string, unknown>) } });
  return id;
}
