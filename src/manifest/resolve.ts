import type { TextStyle } from 'react-native';
import { reportCount } from '../report';
import { ICON_NAME, TOKEN_NAME } from '../wire/primitives';
import type { FontTable, GradientToken, LookFields, Manifest, ShadowValue, StrokeToken, StyleSpec, TextToken, TokenScale } from './types';

type TokenValue<S extends TokenScale> = S extends 'color'
  ? string
  : S extends 'gradient'
    ? GradientToken
    : S extends 'text'
      ? TextToken
      : S extends 'stroke'
        ? StrokeToken
        : S extends 'shadow'
          ? ShadowValue
          : number;

export function resolveToken<S extends TokenScale>(manifest: Manifest, scale: S, name: unknown): TokenValue<S> | undefined {
  if (typeof name !== 'string' || !TOKEN_NAME.test(name)) return undefined;
  const table = manifest[scale] as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(table, name)) return table[name] as TokenValue<S>;
  reportCount({ kind: 'unknownToken', scale, name });
  return undefined;
}

export const LITERAL_RANGE: Partial<Record<TokenScale, [number, number]>> = {
  size: [0, 400],
  space: [0, 64],
  radius: [0, 400],
  stroke: [0, 16],
  aspect: [0.2, 5],
  opacity: [0, 1],
};

const inRange = (scale: TokenScale, v: unknown): v is number => {
  const r = LITERAL_RANGE[scale];
  return r !== undefined && typeof v === 'number' && Number.isFinite(v) && v >= r[0] && v <= r[1];
};

const FONT_WEIGHT: Record<TextToken['face'], TextStyle['fontWeight']> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
};

export const DEFAULT_FAMILY = 'default';
const CASE: Record<NonNullable<TextToken['case']>, TextStyle['textTransform']> = {
  upper: 'uppercase',
  lower: 'lowercase',
  title: 'capitalize',
};

export function textStyleOf(t: TextToken, fonts?: FontTable): TextStyle {
  const fontFamily = fonts?.[t.family ?? DEFAULT_FAMILY]?.[t.face];
  return {
    ...(fontFamily ? { fontFamily } : {}),
    fontSize: t.size,
    lineHeight: t.lineHeight,
    fontWeight: FONT_WEIGHT[t.face],
    ...(t.case ? { textTransform: CASE[t.case] } : {}),
    ...(t.letterSpacing !== undefined ? { letterSpacing: t.letterSpacing } : {}),
  };
}

export function shadowCss(value: ShadowValue): string {
  return (Array.isArray(value) ? value : [value])
    .map((s) => `${s.inset ? 'inset ' : ''}${s.x}px ${s.y}px ${s.blur}px ${s.spread ?? 0}px ${s.color}`)
    .join(', ');
}

export function hasOuterShadow(value: ShadowValue | undefined): boolean {
  if (!value) return false;
  return (Array.isArray(value) ? value : [value]).some((s) => !s.inset);
}

function bucket(scale: TokenScale, v: number): number {
  return scale === 'opacity' || scale === 'aspect' ? Math.round(v * 10) / 10 : Math.round(v / 4) * 4;
}

export function validateStyle(nodeType: string, spec: StyleSpec, style: unknown): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (style === null || typeof style !== 'object' || Array.isArray(style)) return out;
  for (const [field, value] of Object.entries(style as Record<string, unknown>)) {
    const s = spec[field];
    if (s === undefined) continue;
    let ok = false;
    if (typeof s === 'object') ok = typeof value === 'string' && s.keyword.includes(value);
    else if (s === 'icon') ok = typeof value === 'string' && ICON_NAME.test(value);
    else if (typeof value === 'string') ok = TOKEN_NAME.test(value);
    else if (inRange(s as TokenScale, value)) {
      ok = true;
      reportCount({ kind: 'styleLiteral', node: nodeType, field, bucket: bucket(s as TokenScale, value) });
    }
    if (ok) out[field] = value as string | number;
    else reportCount({ kind: 'styleRejected', node: nodeType, field });
  }
  return out;
}

export interface LookSelection {
  look?: unknown;
  legacy?: unknown;
  hue?: unknown;
  spent?: boolean;
  cardSpent?: boolean;
}

export function selectLook(manifest: Manifest, type: string, sel: LookSelection, fallback?: string): string | undefined {
  const looks = manifest.look[type] ?? {};
  const has = (n: string) => Object.prototype.hasOwnProperty.call(looks, n);
  const wanted = typeof sel.look === 'string' ? sel.look : typeof sel.legacy === 'string' ? sel.legacy : undefined;
  let name: string | undefined;
  if (wanted !== undefined) {
    if (has(wanted)) name = wanted;
    else {
      reportCount({ kind: 'unknownToken', scale: `look-${type}`, name: wanted });
      name = fallback;
    }
  } else name = fallback;
  if (name !== undefined && typeof sel.hue === 'string') {
    const q = `${name}-${sel.hue}`;
    if (has(q)) name = q;
    else reportCount({ kind: 'unknownToken', scale: `look-${type}`, name: q });
  }
  if (sel.spent) {
    if (name !== undefined && has(`${name}-spent`)) return `${name}-spent`;
    if (sel.cardSpent !== false && has('spent')) return 'spent';
  }
  return name;
}

export interface Styled {
  look: string | undefined;
  raw(field: string, own?: unknown): string | number | undefined;
  color(field: string, own?: unknown): string | undefined;
  gradient(field: string, own?: unknown): GradientToken | undefined;
  text(field: string, own?: unknown): TextStyle | undefined;
  textToken(field: string, own?: unknown): TextToken | undefined;
  size(field: string, own?: unknown): number | undefined;
  space(field: string, own?: unknown): number | undefined;
  radius(field: string, own?: unknown): number | undefined;
  aspect(field: string, own?: unknown): number | undefined;
  opacity(field: string, own?: unknown): number | undefined;
  stroke(field: string, own?: unknown): StrokeToken | undefined;
  shadow(field: string, own?: unknown): ShadowValue | undefined;
  keyword<T extends string>(field: string, own?: unknown): T | undefined;
  icon(field: string, own?: unknown): string | undefined;
}

export interface StyledInput extends LookSelection {
  type: string;
  spec: StyleSpec;
  style?: unknown;
  defaultLook?: string;
}

export function styledLook(manifest: Manifest, input: StyledInput): Styled {
  const lookName = selectLook(manifest, input.type, input, input.defaultLook);
  const lookFields: LookFields = (lookName !== undefined && manifest.look[input.type]?.[lookName]) || {};
  const style = validateStyle(input.type, input.spec, input.style);
  const lookless = lookName === undefined;

  const token = <S extends TokenScale>(scale: S, field: string, own: unknown): TokenValue<S> | undefined => {
    const layers: [unknown, boolean][] = [
      [style[field], true],
      [own, lookless],
      [lookFields[field], false],
    ];
    for (const [v, literalOk] of layers) {
      if (v === undefined) continue;
      if (typeof v === 'number') {
        if (literalOk && inRange(scale, v)) {
          if (scale === 'stroke') {
            const base = (typeof lookFields[field] === 'string' && resolveToken(manifest, 'stroke', lookFields[field])) || undefined;
            return { width: v, color: base?.color ?? '#00000000', ...(base?.dash ? { dash: base.dash } : {}) } as TokenValue<S>;
          }
          return v as TokenValue<S>;
        }
        continue;
      }
      const r = resolveToken(manifest, scale, v);
      if (r !== undefined) return r;
    }
    return undefined;
  };

  const plain = (field: string, own: unknown) => style[field] ?? (own as string | number | undefined) ?? lookFields[field];

  return {
    look: lookName,
    raw: plain,
    color: (f, own) => token('color', f, own),
    gradient: (f, own) => token('gradient', f, own),
    textToken: (f, own) => token('text', f, own),
    text: (f, own) => {
      const t = token('text', f, own);
      return t ? textStyleOf(t, manifest.font) : undefined;
    },
    size: (f, own) => token('size', f, own),
    space: (f, own) => token('space', f, own),
    radius: (f, own) => token('radius', f, own),
    aspect: (f, own) => token('aspect', f, own),
    opacity: (f, own) => token('opacity', f, own),
    stroke: (f, own) => token('stroke', f, own),
    shadow: (f, own) => token('shadow', f, own),
    keyword: <T extends string>(f: string, own?: unknown) => {
      const v = plain(f, own);
      const spec = input.spec[f];
      if (typeof v !== 'string') return undefined;
      if (spec && typeof spec === 'object' && !spec.keyword.includes(v)) return undefined;
      return v as T;
    },
    icon: (f, own) => {
      const v = plain(f, own);
      return typeof v === 'string' && ICON_NAME.test(v) ? v : undefined;
    },
  };
}
