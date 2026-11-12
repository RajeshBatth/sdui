import { NODE_TYPES, viewNodeRegistry } from '../../src';
import { SNAPSHOT_MANIFEST } from '../../src/manifest/snapshot';

export type Path = (string | number)[];
export type Json = unknown;

const NODE_TYPE_SET = new Set<string>(NODE_TYPES);
const SKIP_KEYS = new Set(['action', 'tracking', 'style', 'fallback', 'dayAction']);

export const isNode = (v: unknown): v is Record<string, unknown> & { type: string } =>
  !!v && typeof v === 'object' && !Array.isArray(v) && NODE_TYPE_SET.has((v as { type?: unknown }).type as string);

export const pathKey = (p: Path) => p.map(String).join('.');
export const parseKey = (k: string): Path => (k === '' ? [] : k.split('.').map((s) => (/^\d+$/.test(s) ? Number(s) : s)));

export function getAt(root: Json, path: Path): Json {
  let cur: Json = root;
  for (const seg of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, Json>)[seg];
  }
  return cur;
}

export function setAt(root: Json, path: Path, value: Json): Json {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  const base = Array.isArray(root) ? [...root] : { ...(root as Record<string, Json>) };
  const next = setAt((root as Record<string | number, Json>)?.[head!], rest, value);
  if (next === undefined && !Array.isArray(base)) delete (base as Record<string, Json>)[head as string];
  else (base as Record<string | number, Json>)[head!] = next;
  return base;
}

export function removeAt(root: Json, path: Path): Json {
  const parentPath = path.slice(0, -1);
  const last = path[path.length - 1]!;
  const parent = getAt(root, parentPath);
  if (Array.isArray(parent)) return setAt(root, parentPath, parent.filter((_, i) => i !== last));
  return setAt(root, path, undefined);
}

export function insertAt(root: Json, arrayPath: Path, index: number, value: Json): Json {
  const arr = (getAt(root, arrayPath) as Json[] | undefined) ?? [];
  const next = [...arr];
  next.splice(index, 0, value);
  return setAt(root, arrayPath, next);
}

export function moveAt(root: Json, path: Path, delta: number): { root: Json; path: Path } {
  const parentPath = path.slice(0, -1);
  const i = path[path.length - 1];
  const arr = getAt(root, parentPath);
  if (!Array.isArray(arr) || typeof i !== 'number') return { root, path };
  const j = i + delta;
  if (j < 0 || j >= arr.length) return { root, path };
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return { root: setAt(root, parentPath, next), path: [...parentPath, j] };
}

/** Every node directly under `node`, in any slot (children, base, layers[].node, rows[].cells[], …). */
export function childNodes(node: Json, base: Path = []): { path: Path; node: Record<string, unknown> & { type: string } }[] {
  const out: { path: Path; node: Record<string, unknown> & { type: string } }[] = [];
  const visit = (v: Json, p: Path, depth: number) => {
    if (depth > 6 || v === null || typeof v !== 'object') return;
    if (depth > 0 && isNode(v)) {
      out.push({ path: p, node: v });
      return;
    }
    if (Array.isArray(v)) v.forEach((x, i) => visit(x, [...p, i], depth + 1));
    else
      for (const [k, x] of Object.entries(v as Record<string, Json>)) {
        if (depth === 0 && SKIP_KEYS.has(k)) continue;
        visit(x, [...p, k], depth + 1);
      }
  };
  visit(node, base, 0);
  return out;
}

export interface TreeRow {
  path: Path;
  key: string;
  node: Record<string, unknown> & { type: string };
  depth: number;
  hasChildren: boolean;
}

export function flattenTree(root: Json, collapsed: Set<string>): TreeRow[] {
  const rows: TreeRow[] = [];
  const walk = (node: Json, path: Path, depth: number) => {
    if (!isNode(node)) return;
    const kids = childNodes(node, path);
    const key = pathKey(path);
    rows.push({ path, key, node, depth, hasChildren: kids.length > 0 });
    if (!collapsed.has(key)) kids.forEach((k) => walk(k.node, k.path, depth + 1));
  };
  walk(root, [], 0);
  return rows;
}

export function isContainer(type: string): boolean {
  return ['stack', 'card', 'scroll-row', 'carousel', 'grid', 'form', 'accordion', 'timeline'].includes(type);
}

const clip = (s: string, n = 28) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function nodeLabel(node: Record<string, unknown>): string {
  const t = node.type as string;
  const spans = node.spans as { text: string }[] | undefined;
  const text =
    (typeof node.value === 'string' && node.value) ||
    (spans && spans.map((s) => s.text).join('')) ||
    (typeof node.label === 'string' && node.label) ||
    (Array.isArray(node.label) && (node.label as { text: string }[]).map((s) => s.text).join('')) ||
    (typeof node.name === 'string' && t === 'icon' && node.name) ||
    (Array.isArray(node.images) && (node.images as { alt: string }[])[0]?.alt) ||
    (typeof node.look === 'string' && node.look) ||
    (typeof node.id === 'string' && node.id) ||
    '';
  return text ? clip(String(text)) : '';
}

export const FAMILY_OF: [string, string[]][] = [
  ['Foundation', ['stack', 'text', 'markdown']],
  ['Content', ['icon', 'image', 'pill', 'button', 'menu', 'divider']],
  ['Layout', ['card', 'scroll-row', 'carousel', 'grid', 'overlay']],
  ['Domain', ['rating']],
  ['Structured', ['table', 'timeline', 'disclosure', 'accordion']],
  ['Selection', ['tabs', 'form', 'choice', 'stepper', 'textInput']],
  ['Chart', ['bars', 'pie', 'trend', 'calendar']],
];

export const TYPE_GLYPH: Record<string, string> = {
  stack: '☰', text: 'T', markdown: 'M↓', icon: '★', image: '▣', pill: '◖', button: '⏺', menu: '⋮', indicator: '•••', divider: '—',
  card: '▢', 'scroll-row': '⇆', carousel: '◫', grid: '▦', overlay: '⧉', rating: '★', table: '⊞', timeline: '┊', disclosure: '▸',
  accordion: '≡', tabs: '⊟', form: '✎', choice: '◉', stepper: '±', textInput: '⌨', bars: '▮', pie: '◔', trend: '⟋', calendar: '▤',
};

const msg = (text: string) => ({ kind: 'message', text });
const txt = (value: string, style = 'body') => ({ type: 'text', style, value });
const cardOf = (title: string) => ({ type: 'card', look: 'glass', children: [txt(title, 'heading'), txt('Supporting text', 'caption')] });
let counter = 1;
const uniq = (base: string) => `${base}${counter++}`;

export function snippet(type: string): Record<string, unknown> {
  switch (type) {
    case 'stack':
      return { type, gap: 'md', children: [txt('First item'), txt('Second item')] };
    case 'text':
      return txt('New text');
    case 'markdown':
      return { type, value: '**Bold** and _italic_ text\n- a bullet' };
    case 'icon':
      return { type, name: 'star', size: 'iconLg' };
    case 'image':
      return { type, look: 'hero', images: [{ url: '/placeholder-photo.svg', alt: 'Photo' }] };
    case 'pill':
      return { type, look: 'chip', label: 'Pill' };
    case 'button':
      return { type, look: 'primary', label: 'Button', action: msg('Button tapped') };
    case 'menu':
      return { type, items: [{ label: 'Share', action: msg('Share') }, { label: 'Save', action: msg('Save') }] };
    case 'divider':
      return { type };
    case 'card':
      return cardOf('Card title');
    case 'scroll-row':
      return { type, itemWidth: 'sm', gap: 'md', children: [cardOf('One'), cardOf('Two'), cardOf('Three')] };
    case 'carousel':
      return { type, dots: 'dots', gap: 'md', children: [cardOf('Slide one'), cardOf('Slide two')] };
    case 'grid':
      return { type, columns: 2, gap: 'md', children: [cardOf('A'), cardOf('B')] };
    case 'overlay':
      return {
        type,
        base: { type: 'image', look: 'hero', images: [{ url: '/placeholder-photo.svg', alt: 'Photo' }] },
        layers: [{ anchor: 'top-start', inset: { x: 'md', y: 'md' }, node: { type: 'pill', look: 'chip', label: 'Tag' } }],
      };
    case 'rating':
      return { type, value: 4.5, countLabel: '(1.2k reviews)' };
    case 'table':
      return { type, look: 'box', bleed: false, columns: [{ label: 'Name' }, { label: 'Value' }], rows: [{ cells: [txt('Row', 'caption'), txt('₹1,200', 'caption')] }] };
    case 'timeline':
      return { type, children: [txt('Step one'), txt('Step two')] };
    case 'disclosure':
      return { type, summary: txt('Summary', 'bodyStrong'), detail: txt('Detail text', 'caption') };
    case 'accordion':
      return { type, gap: 'md', dividers: true, children: [snippet('disclosure'), snippet('disclosure')] };
    case 'tabs':
      return { type, labels: ['First', 'Second'], children: [txt('First pane'), txt('Second pane')] };
    case 'form':
      return { type, gap: 'md', children: [snippet('textInput'), { type: 'button', look: 'primary', fullWidth: true, label: 'Submit', action: msg('Submit') }] };
    case 'choice':
      return { type, name: uniq('pick'), label: 'Pick one', mode: 'single', display: 'list', options: [{ id: 'a', label: 'Option A' }, { id: 'b', label: 'Option B' }] };
    case 'stepper':
      return { type, name: uniq('count'), label: 'Count', value: 1, min: 0, max: 9 };
    case 'textInput':
      return { type, name: uniq('note'), label: 'Label', placeholder: 'Type here' };
    case 'bars':
      return { type, selected: 1, bars: [{ value: 3, valueLabel: '₹3K', label: 'Mon' }, { value: 2, valueLabel: '₹2K', label: 'Tue' }, { value: 4, valueLabel: '₹4K', label: 'Wed' }] };
    case 'pie':
      return { type, slices: [{ label: 'Flights', value: 2 }, { label: 'Hotels', value: 1 }] };
    case 'trend':
      return { type, points: [3, 5, 4, 6, 5], xLabels: ['Mon', 'Fri'] };
    case 'calendar':
      return {
        type,
        weekdays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
        weekStart: 0,
        months: [{ month: '2026-12', title: 'December 2026', days: Array.from({ length: 31 }, () => ({})) }],
      };
    default:
      return { type };
  }
}

export const INPUT_TYPES = new Set(['choice', 'stepper', 'textInput']);

export function insideForm(root: Json, path: Path): boolean {
  for (let i = path.length; i >= 0; i--) {
    const n = getAt(root, path.slice(0, i));
    if (isNode(n) && n.type === 'form') return true;
  }
  return false;
}

/* ---------- schema introspection for the property form ---------- */

type ZDef = { type: string; innerType?: ZSchema; options?: unknown[]; values?: unknown[]; in?: ZSchema; shape?: Record<string, ZSchema>; entries?: Record<string, string> };
type ZSchema = { _zod?: { def: ZDef }; def?: ZDef; shape?: Record<string, ZSchema> };

const defOf = (s: ZSchema | undefined): ZDef | undefined => s?._zod?.def ?? s?.def;

function unwrap(s: ZSchema | undefined): ZSchema | undefined {
  let cur = s;
  for (let i = 0; i < 6; i++) {
    const d = defOf(cur);
    if (!d) return cur;
    if (['optional', 'nullable', 'catch', 'default', 'readonly', 'nonoptional'].includes(d.type)) cur = d.innerType;
    else return cur;
  }
  return cur;
}

export function shapeOf(type: string): Record<string, ZSchema> {
  let s = viewNodeRegistry.get(type)?.schema as unknown as ZSchema | undefined;
  for (let i = 0; i < 4 && s; i++) {
    if (s.shape) return s.shape;
    const d = defOf(s);
    s = d?.in ?? d?.innerType;
  }
  return {};
}

export type FieldKind =
  | { kind: 'token'; scale: string; options: string[] }
  | { kind: 'enum'; options: string[] }
  | { kind: 'boolean' }
  | { kind: 'number' }
  | { kind: 'string'; multiline?: boolean }
  | { kind: 'json' };

const m = SNAPSHOT_MANIFEST;
const TOKEN_FIELDS: Record<string, [string, () => string[]]> = {
  tone: ['color', () => Object.keys(m.color)],
  style: ['text', () => Object.keys(m.text)],
  gap: ['space', () => Object.keys(m.space)],
  rowGap: ['space', () => Object.keys(m.space)],
  overlap: ['space', () => Object.keys(m.space)],
  dividerInset: ['space', () => Object.keys(m.space)],
  padding: ['space', () => Object.keys(m.space)],
  width: ['size', () => Object.keys(m.size)],
  minHeight: ['size', () => Object.keys(m.size)],
  size: ['size', () => Object.keys(m.size)],
  itemWidth: ['size', () => Object.keys(m.size)],
  radius: ['radius', () => Object.keys(m.radius)],
  stroke: ['stroke', () => Object.keys(m.stroke)],
  gradient: ['gradient', () => Object.keys(m.gradient)],
  palette: ['palette', () => Object.keys(m.palette)],
  aspect: ['aspect', () => Object.keys(m.aspect)],
  dots: ['look', () => Object.keys(m.look.indicator ?? {})],
};
const ICON_FIELDS = new Set(['icon', 'leadingIcon', 'trailingIcon']);

export function fieldKind(type: string, key: string, value: unknown): FieldKind {
  if (key === 'look' || key === 'variant' || key === 'surface') return { kind: 'token', scale: 'look', options: Object.keys(m.look[type] ?? {}) };
  if (ICON_FIELDS.has(key) || (type === 'icon' && key === 'name')) return { kind: 'token', scale: 'icon', options: Object.keys(m.icon) };
  if (key === 'style' && type !== 'text') return { kind: 'json' };
  const token = TOKEN_FIELDS[key];
  if (token && (typeof value === 'string' || value === undefined)) return { kind: 'token', scale: token[0], options: token[1]() };
  const d = defOf(unwrap(shapeOf(type)[key]));
  if (d?.type === 'enum') return { kind: 'enum', options: (d.entries ? Object.values(d.entries) : (d.options ?? d.values ?? [])).map(String) };
  if (d?.type === 'literal') return { kind: 'enum', options: (d.values ?? []).map(String) };
  if (d?.type === 'boolean' || typeof value === 'boolean') return { kind: 'boolean' };
  if (d?.type === 'number' || typeof value === 'number') return { kind: 'number' };
  if (d?.type === 'string' || typeof value === 'string') return { kind: 'string', multiline: key === 'value' || key === 'caption' };
  return { kind: 'json' };
}

export const SECTIONS: [string, string[]][] = [
  ['Content', ['value', 'spans', 'label', 'labels', 'caption', 'placeholder', 'name', 'images', 'items', 'options', 'slices', 'bars', 'points', 'xLabels', 'yLabels', 'columns', 'word', 'countLabel', 'badge', 'emptyLabel', 'accessibilityLabel', 'total']],
  ['Appearance', ['look', 'variant', 'surface', 'hue', 'style', 'tone', 'gradient', 'radius', 'stroke', 'shape', 'icon', 'leadingIcon', 'trailingIcon', 'size', 'aspect', 'palette', 'dots', 'background', 'selected', 'legend']],
  ['Layout', ['direction', 'justify', 'align', 'gap', 'rowGap', 'padding', 'width', 'minHeight', 'wrap', 'dividers', 'dividerInset', 'overlap', 'overlapOrder', 'columns', 'itemWidth', 'bleed', 'collapseAfter', 'collapseLabel', 'maxLines', 'readMore', 'orientation', 'fullWidth', 'grow']],
  ['Behaviour', ['action', 'mode', 'display', 'control', 'required', 'max', 'min', 'disabled', 'ignoreFormValidity', 'spend', 'open', 'longPress', 'front', 'multiline', 'maxLength', 'dayAction']],
];

export function sectionOf(key: string): string {
  for (const [name, keys] of SECTIONS) if (keys.includes(key)) return name;
  return 'Advanced';
}

export const SLOT_KEYS = new Set(['children', 'base', 'layers', 'summary', 'detail', 'rows', 'months']);
