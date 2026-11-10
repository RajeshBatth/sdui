export const BIND_DEPTH_LIMIT = 4 * (16 + 2);
export const TOO_DEEP: unique symbol = Symbol('sdui.bind.too-deep');
const OMIT: unique symbol = Symbol('sdui.bind.omit');

type Props = Record<string, unknown>;
interface Scope {
  props: Props;
  item: unknown;
  at: number;
}

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const WHOLE_HOLE = /^\{\{\s*([^{}]+?)\s*\}\}$/;
const ANY_HOLE = /\{\{\s*([^{}]+?)\s*\}\}/g;

class TooDeep extends Error {}

function own(value: unknown, key: string): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return Object.prototype.hasOwnProperty.call(value, key) ? (value as Props)[key] : undefined;
}

function readPath(path: string, scope: Scope): unknown {
  let base: unknown;
  let rest: string;
  if (path === '.') return scope.item;
  if (path.startsWith('.')) {
    base = scope.item;
    rest = path.slice(1);
  } else {
    base = scope.props;
    rest = path;
  }
  if (rest === '') return base;
  let cur = base;
  for (const seg of rest.split('.')) {
    if (seg === '' || BLOCKED_KEYS.has(seg)) return undefined;
    cur = own(cur, seg);
    if (cur === undefined) return undefined;
  }
  return cur;
}

function truthy(v: unknown): boolean {
  if (v === undefined || v === null || v === false || v === '') return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}

function asComparable(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  return typeof v === 'string' ? v : JSON.stringify(v);
}

export function evaluateCondition(cond: string, scope: Scope): boolean {
  const ne = cond.indexOf('!=');
  const eq = cond.indexOf('=');
  if (ne > 0 || (eq > 0 && cond[eq - 1] !== '!')) {
    const negate = ne > 0;
    const idx = negate ? ne : eq;
    const left = cond.slice(0, idx).trim();
    const rightRaw = cond.slice(idx + (negate ? 2 : 1)).trim();
    const l = asComparable(readPath(left, scope));
    const r = rightRaw.startsWith('$') ? asComparable(readPath(rightRaw.slice(1), scope)) : rightRaw;
    return negate ? l !== r : l === r;
  }
  const trimmed = cond.trim();
  if (trimmed.startsWith('!')) return !truthy(readPath(trimmed.slice(1).trim(), scope));
  return truthy(readPath(trimmed, scope));
}

function bindString(s: string, scope: Scope): unknown {
  const whole = WHOLE_HOLE.exec(s);
  if (whole) {
    const v = readPath(whole[1]!, scope);
    return v === undefined || v === null ? OMIT : v;
  }
  if (!s.includes('{{')) return s;
  return s.replace(ANY_HOLE, (_, p: string) => {
    const v = readPath(p, scope);
    if (v === undefined || v === null) return '';
    return typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v);
  });
}

function bindValue(node: unknown, scope: Scope, depth: number): unknown {
  if (typeof node === 'string') return bindString(node, scope);
  if (node === null || typeof node !== 'object') return node;
  if (depth > BIND_DEPTH_LIMIT) throw new TooDeep();
  if (Array.isArray(node)) return bindList(node, scope, depth + 1);
  return bindMap(node as Props, scope, depth + 1);
}

function bindList(list: unknown[], scope: Scope, depth: number): unknown[] {
  const out: unknown[] = [];
  for (const member of list) {
    if (member !== null && typeof member === 'object' && !Array.isArray(member) && '$each' in member && !('$cycle' in member)) {
      const m = member as Props;
      const src = typeof m.$each === 'string' ? readPath(m.$each, scope) : undefined;
      if (!Array.isArray(src)) continue;
      const template = Object.fromEntries(Object.entries(m).filter(([k]) => k !== '$each'));
      src.forEach((item, at) => {
        const v = bindValue(template, { props: scope.props, item, at }, depth);
        if (v !== OMIT) out.push(v);
      });
      continue;
    }
    const v = bindValue(member, scope, depth);
    if (v !== OMIT) out.push(v);
  }
  return out;
}

function bindMap(map: Props, scope: Scope, depth: number): unknown {
  if ('$cycle' in map) {
    const c = map.$cycle;
    if (Array.isArray(c) && c.length > 0) return c[scope.at % c.length];
  }
  if ('$when' in map && typeof map.$when === 'string') {
    const holds = evaluateCondition(map.$when, scope);
    if (holds && '$value' in map) return bindValue(map.$value, scope, depth);
    if (!holds) return '$else' in map ? bindValue(map.$else, scope, depth) : OMIT;
  }
  const out: Props = {};
  for (const [k, v] of Object.entries(map)) {
    if (k.startsWith('$') || BLOCKED_KEYS.has(k)) continue;
    const b = bindValue(v, scope, depth);
    if (b !== OMIT) out[k] = b;
  }
  return out;
}

export type BindResult = unknown | typeof TOO_DEEP;

export function bindLayout(layout: unknown, props: Props = {}): BindResult {
  try {
    const v = bindValue(layout, { props, item: undefined, at: 0 }, 0);
    return v === OMIT ? null : v;
  } catch (e) {
    if (e instanceof TooDeep) return TOO_DEEP;
    return null;
  }
}
