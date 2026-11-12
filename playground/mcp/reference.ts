import { z } from 'zod';
import { NODE_TYPES } from '../../src';
import { LIST_PARENTS, SLOT_TAGS, tagOf, TEXT_CHILD_FIELD } from '../../src/authoring/names';
import { SNAPSHOT_MANIFEST } from '../../src/manifest/snapshot';
import { FAMILY_OF, fieldKind, INPUT_TYPES, shapeOf, SLOT_KEYS } from '../editor/model';

const m = SNAPSHOT_MANIFEST;
const LIST_LIMIT = 40;

function familyOf(type: string): string {
  return FAMILY_OF.find(([, ts]) => ts.includes(type))?.[0] ?? 'Other';
}

function childrenRule(type: string): string {
  const tag = tagOf(type);
  if (TEXT_CHILD_FIELD[type]) return `children are its ${TEXT_CHILD_FIELD[type]} text${type === 'text' ? ' (may contain {paths} and <Span …>styled runs</Span>)' : ' ({paths} allowed)'}`;
  const slots = Object.keys(SLOT_TAGS).filter((s) => s.startsWith(`${tag}.`));
  if (slots.length) return `children are ${slots.map((s) => `<${s}>`).join(' / ')}`;
  if (LIST_PARENTS.has(type)) return 'children are nodes (elements, conditionals, .map loops)';
  return 'no children (self-closing)';
}

function jsonShape(schema: unknown): string {
  try {
    const js = z.toJSONSchema(schema as z.ZodType, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
    delete js.$schema;
    const text = JSON.stringify(js);
    return text.length > 360 ? `${text.slice(0, 360)}…` : text;
  } catch {
    return 'object';
  }
}

function propLine(type: string, key: string, schema: unknown): string {
  const k = fieldKind(type, key, undefined);
  const opts = (o: string[]) => (o.length > LIST_LIMIT ? `${o.slice(0, LIST_LIMIT).join(' | ')} | … (${o.length} total, see design_tokens)` : o.join(' | '));
  switch (k.kind) {
    case 'token':
      return `${key}: ${k.scale} token: ${opts(k.options) || '(none for this node)'}`;
    case 'enum':
      return `${key}: ${k.options.map((o) => JSON.stringify(o)).join(' | ')}`;
    case 'boolean':
    case 'number':
      return `${key}: ${k.kind}`;
    case 'string':
      return `${key}: string`;
    default:
      return `${key}: ${jsonShape(schema)}`;
  }
}

/** One-line-per-node summary of every element agents can use. */
export function nodeIndex(): string {
  const lines = ['Every element, by family. Call node_reference with a type for its props.', ''];
  for (const [family, types] of FAMILY_OF) {
    lines.push(`## ${family}`);
    for (const t of types) lines.push(`- <${tagOf(t)}> (${t}): ${childrenRule(t)}${INPUT_TYPES.has(t) ? '; must sit inside <Form>' : ''}`);
    lines.push('');
  }
  const rest = NODE_TYPES.filter((t) => !FAMILY_OF.some(([, ts]) => ts.includes(t)));
  if (rest.length) lines.push('## Other', ...rest.map((t) => `- <${tagOf(t)}> (${t}): ${childrenRule(t)}`));
  return lines.join('\n');
}

/** Props of one element, with token options and look names. */
export function nodeReference(type: string): string {
  const resolved = NODE_TYPES.find((t) => t === type || tagOf(t) === type);
  if (!resolved) throw new Error(`Unknown node "${type}". Known: ${NODE_TYPES.map(tagOf).join(', ')}`);
  const shape = shapeOf(resolved);
  const looks = Object.keys(m.look[resolved] ?? {});
  const lines = [
    `<${tagOf(resolved)}> (type "${resolved}", ${familyOf(resolved)})`,
    `JSX: ${childrenRule(resolved)}${INPUT_TYPES.has(resolved) ? '; must sit inside <Form>' : ''}.`,
    ...(looks.length ? [`Looks (look="…"): ${looks.join(', ')}`] : []),
    '',
    'Props (slots like children/base/layers are written as JSX children instead):',
    ...Object.entries(shape)
      .filter(([k]) => !SLOT_KEYS.has(k))
      .map(([k, s]) => `- ${propLine(resolved, k, s)}${TEXT_CHILD_FIELD[resolved] === k ? ' (usually written as the element’s text children)' : ''}`),
  ];
  return lines.join('\n');
}

export const TOKEN_SCALES = ['color', 'gradient', 'text', 'size', 'stroke', 'radius', 'space', 'shadow', 'aspect', 'opacity', 'palette', 'icon', 'look'] as const;
export type TokenScale = (typeof TOKEN_SCALES)[number];

/** Token names (and values where short) for one scale, or an overview of all scales. */
export function designTokens(scale?: TokenScale): string {
  if (!scale) return TOKEN_SCALES.map((s) => `${s}: ${Object.keys(m[s]).length} tokens`).join('\n') + '\n\nCall design_tokens with a scale for names and values.';
  const table = m[scale] as Record<string, unknown>;
  if (scale === 'icon') return `Icon names (icon="…"): ${Object.keys(table).join(', ')}`;
  if (scale === 'look')
    return Object.entries(m.look)
      .map(([node, looks]) => `${node}: ${Object.entries(looks).map(([name, f]) => `${name} ${JSON.stringify(f)}`).join('; ')}`)
      .join('\n');
  return Object.entries(table)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join('\n');
}
