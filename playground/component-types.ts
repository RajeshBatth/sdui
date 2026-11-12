export interface FigmaRef {
  file: string;
  node: string;
}

export const NAMESPACES = ['Core', 'Flights', 'Hotels', 'Destinations'] as const;
export type Namespace = (typeof NAMESPACES)[number];

export interface ComponentStory {
  title: string;
  prompt: string;
  figma: FigmaRef;
  raw: unknown;
}

export const t = (style: string, value: string, extra: Record<string, unknown> = {}) => ({ type: 'text', style, value, ...extra });
export const msg = (text: string) => ({ kind: 'message', text });

export interface GroupedStory extends ComponentStory {
  group: Namespace;
}

/** A component published in the repo. Its Figma reference (if any) lives in the private folder as FIGMA_REFS. */
export interface PublicComponent {
  group: Namespace;
  title: string;
  prompt: string;
  raw: unknown;
}
