import type { TemplateManifest } from '../../src/authoring/template';
import type { PlaygroundContext, PlaygroundFocus } from '../server/context';

export interface TemplateSummary {
  id: string;
  name: string;
  prompt: string;
  variants: { id: string; label: string }[];
  origin?: TemplateManifest['origin'];
  updatedAt: number;
}

export interface TemplateBundle {
  manifest: TemplateManifest;
  sources: Record<string, string>;
  updatedAt: number;
}

export const CLIENT_ID = `playground-${Math.random().toString(36).slice(2, 8)}`;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'content-type': 'application/json', 'x-client-id': CLIENT_ID, ...init?.headers } });
  const body = await res.json();
  if (!res.ok) throw new Error((body as { error?: string }).error ?? res.statusText);
  return body as T;
}

export const api = {
  list: () => call<TemplateSummary[]>('/api/templates'),
  get: (id: string) => call<TemplateBundle>(`/api/templates/${encodeURIComponent(id)}`),
  put: (id: string, patch: { manifest?: TemplateManifest; sources?: Record<string, string> }) =>
    call<TemplateBundle>(`/api/templates/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(patch) }),
  remove: (id: string) => call<{ ok: true }>(`/api/templates/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  addReference: (id: string, r: { name: string; imageBase64?: string; figma?: string; sample?: number; scale?: number }) =>
    call<TemplateBundle>(`/api/templates/${encodeURIComponent(id)}/references`, { method: 'POST', body: JSON.stringify(r) }),
  removeReference: (id: string, name: string) => call<TemplateBundle>(`/api/templates/${encodeURIComponent(id)}/references/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  assetUrl: (id: string, file: string) => `/api/templates/${encodeURIComponent(id)}/assets/${encodeURIComponent(file)}`,
  putContext: (ctx: PlaygroundContext) => call<{ ok: true }>('/api/context', { method: 'PUT', body: JSON.stringify(ctx) }),
};

export interface ChangeEvent {
  type: 'changed';
  id: string;
  by: string;
  at: number;
}

export type FocusEvent = PlaygroundFocus & { type: 'focus' };

export function subscribe(onChange: (e: ChangeEvent) => void, onFocus?: (e: FocusEvent) => void): () => void {
  const es = new EventSource('/api/events');
  es.onmessage = (m) => {
    try {
      const e = JSON.parse(m.data) as ChangeEvent | FocusEvent;
      if (e.type === 'focus') onFocus?.(e);
      else onChange(e);
    } catch {}
  };
  return () => es.close();
}
