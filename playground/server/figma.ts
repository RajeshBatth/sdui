/// <reference types="node" />
/** Fetch a PNG of a Figma node through the Figma REST API. Needs FIGMA_TOKEN (a personal access token). */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Git-ignored files at the project root that may hold FIGMA_TOKEN=… (first match wins). */
export const ENV_FILES = ['../../.env.local', '../../.env'].map((p) => resolve(import.meta.dirname, p));

/** FIGMA_TOKEN from the environment, else from .env.local / .env (read on every call, so no restart is needed). */
export function figmaToken(): string | undefined {
  if (process.env.FIGMA_TOKEN) return process.env.FIGMA_TOKEN;
  for (const file of ENV_FILES) {
    if (!existsSync(file)) continue;
    const m = /^\s*(?:export\s+)?FIGMA_TOKEN\s*=\s*["']?([^"'\s#]+)/m.exec(readFileSync(file, 'utf8'));
    if (m) return m[1];
  }
  return undefined;
}

export function parseFigmaUrl(url: string): { file: string; node: string } {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error('Not a URL');
  }
  if (!/(^|\.)figma\.com$/.test(u.hostname)) throw new Error('Not a figma.com link');
  const parts = u.pathname.split('/').filter(Boolean);
  const kind = parts[0];
  if (!kind || !['design', 'file', 'proto'].includes(kind) || !parts[1]) throw new Error('Expected a figma.com/design/<file>/… link');
  const file = parts[2] === 'branch' && parts[3] ? parts[3] : parts[1];
  const node = u.searchParams.get('node-id')?.replace(/-/g, ':');
  if (!node) throw new Error('The link has no node-id. In Figma, select the frame and use “Copy link to selection”.');
  return { file, node };
}

export async function fetchFigmaPng(url: string, scale = 2): Promise<Buffer> {
  const { file, node } = parseFigmaUrl(url);
  const token = figmaToken();
  if (!token) throw new Error('No Figma token. Add FIGMA_TOKEN=… to .env at the project root (git-ignored), or paste a screenshot instead.');
  // Figma renders a node and its children only, so a bare shape exports as a blank box.
  const meta = await fetch(`https://api.figma.com/v1/files/${encodeURIComponent(file)}/nodes?ids=${encodeURIComponent(node)}&depth=1`, { headers: { 'X-Figma-Token': token } });
  if (meta.ok) {
    const doc = ((await meta.json()) as { nodes?: Record<string, { document?: { type?: string; name?: string } } | null> }).nodes?.[node]?.document;
    if (!doc) throw new Error('Figma has no node with that id (was it deleted?)');
    if (!['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'GROUP', 'SECTION'].includes(doc.type ?? '')) {
      throw new Error(`That link points at a ${String(doc.type).toLowerCase()} (“${doc.name}”), not a frame, so it would export blank. Select the frame (or the layers, then ⌥⌘G) and copy its link, or paste a screenshot.`);
    }
  }
  const res = await fetch(`https://api.figma.com/v1/images/${encodeURIComponent(file)}?ids=${encodeURIComponent(node)}&format=png&scale=${scale}`, {
    headers: { 'X-Figma-Token': token },
  });
  const body = (await res.json()) as { err?: string | null; images?: Record<string, string | null> };
  if (!res.ok || body.err) throw new Error(`Figma: ${body.err ?? res.statusText}`);
  const src = body.images?.[node];
  if (!src) throw new Error('Figma returned no image for that node');
  const img = await fetch(src);
  if (!img.ok) throw new Error(`Figma image download failed: ${img.statusText}`);
  return Buffer.from(await img.arrayBuffer());
}
