import { NODE_TYPES } from '../nodes/schemas';

/** `scroll-row` → `ScrollRow`, `textInput` → `TextInput`. */
export function tagOf(type: string): string {
  return type
    .split('-')
    .map((p) => p[0]!.toUpperCase() + p.slice(1))
    .join('');
}

export const TYPE_OF_TAG: ReadonlyMap<string, string> = new Map(NODE_TYPES.map((t) => [tagOf(t), t]));

/** Dotted helper tags that name a slot of their parent instead of a node. */
export const SLOT_TAGS = {
  'Overlay.Base': 'base',
  'Overlay.Layer': 'layer',
  'Disclosure.Summary': 'summary',
  'Disclosure.Detail': 'detail',
  'Table.Row': 'row',
  'Tabs.Pane': 'pane',
} as const;
export type SlotTag = keyof typeof SLOT_TAGS;

/** Node types whose JSX children are their text. */
export const TEXT_CHILD_FIELD: Readonly<Record<string, 'value' | 'label'>> = {
  text: 'value',
  markdown: 'value',
  button: 'label',
  pill: 'label',
};

/** Node types whose JSX children fill the `children` list. */
export const LIST_PARENTS = new Set(['stack', 'card', 'scroll-row', 'carousel', 'grid', 'form', 'accordion', 'timeline', 'choice', 'table']);
