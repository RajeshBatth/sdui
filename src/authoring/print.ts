import { tagOf, TEXT_CHILD_FIELD, TYPE_OF_TAG } from './names';

type Obj = Record<string, unknown>;
interface Scope {
  item?: string;
  depth: number;
  names?: Record<string, string>;
  taken?: Set<string>;
}

const IDENT = /^[A-Za-z_$][\w$]*$/;
const WHOLE_HOLE = /^\{\{\s*([^{}]+?)\s*\}\}$/;
const ANY_HOLE = /\{\{\s*([^{}]+?)\s*\}\}/g;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const isCond = (v: unknown): v is Obj => isObj(v) && typeof v.$when === 'string';
const isNodeObj = (v: unknown): v is Obj => isObj(v) && typeof v.type === 'string' && TYPE_OF_TAG.has(tagOf(v.type));

function pathExpr(path: string, scope: Scope): string {
  if (path === '.') return scope.item ?? 'item';
  if (path.startsWith('.')) return `${scope.item ?? 'item'}${path}`;
  return `props.${path}`;
}

function condExpr(cond: string, scope: Scope): string {
  const t = cond.trim();
  const ne = t.indexOf('!=');
  const eq = t.indexOf('=');
  if (ne > 0 || (eq > 0 && t[eq - 1] !== '!')) {
    const neg = ne > 0;
    const i = neg ? ne : eq;
    const left = pathExpr(t.slice(0, i).trim(), scope);
    const rightRaw = t.slice(i + (neg ? 2 : 1)).trim();
    const right = rightRaw.startsWith('$') ? pathExpr(rightRaw.slice(1), scope) : JSON.stringify(rightRaw);
    return `${left} ${neg ? '!==' : '==='} ${right}`;
  }
  if (t.startsWith('!')) return `!${pathExpr(t.slice(1).trim(), scope)}`;
  return pathExpr(t, scope);
}

/** A JS expression for an attribute value. */
function expr(v: unknown, scope: Scope, indent: string): string {
  if (typeof v === 'string') {
    const whole = WHOLE_HOLE.exec(v);
    if (whole) return pathExpr(whole[1]!, scope);
    if (ANY_HOLE.test(v)) {
      ANY_HOLE.lastIndex = 0;
      return '`' + v.replace(/[`\\$]/g, (c) => `\\${c}`).replace(/\\\$\{\{/g, '${{').replace(ANY_HOLE, (_, p: string) => `\${${pathExpr(p, scope)}}`) + '`';
    }
    return JSON.stringify(v);
  }
  if (typeof v === 'number' || typeof v === 'boolean' || v === null) return String(v);
  if (isCond(v)) {
    const test = condExpr(v.$when as string, scope);
    if ('$value' in v && '$else' in v) return `${test} ? ${expr(v.$value, scope, indent)} : ${expr(v.$else, scope, indent)}`;
    if ('$value' in v) return `${test} && ${expr(v.$value, scope, indent)}`;
  }
  if (isNodeObj(v) && !('$each' in v)) return element(v, scope, indent).trimStart();
  if (Array.isArray(v)) {
    const items = v.map((x) => expr(x, scope, indent + '  '));
    const flat = `[${items.join(', ')}]`;
    if (flat.length <= 60 && !flat.includes('\n')) return flat;
    return `[\n${items.map((i) => `${indent}  ${i}`).join(',\n')},\n${indent}]`;
  }
  if (isObj(v)) {
    const entries = Object.entries(v).map(([k, x]) => `${IDENT.test(k) ? k : JSON.stringify(k)}: ${expr(x, scope, indent + '  ')}`);
    const flat = `{ ${entries.join(', ')} }`;
    if (flat.length <= 60 && !flat.includes('\n')) return entries.length ? flat : '{}';
    return `{\n${entries.map((e) => `${indent}  ${e}`).join(',\n')},\n${indent}}`;
  }
  return 'undefined';
}

function attr(name: string, v: unknown, scope: Scope, indent: string): string {
  if (v === true) return name;
  if (typeof v === 'string' && !v.includes('"') && !v.includes('\n') && !ANY_HOLE.test(v) && !v.includes('{')) {
    ANY_HOLE.lastIndex = 0;
    return `${name}="${v}"`;
  }
  ANY_HOLE.lastIndex = 0;
  return `${name}={${expr(v, scope, indent)}}`;
}

function openTag(tag: string, attrs: [string, unknown][], scope: Scope, indent: string, selfClose: boolean): string {
  const parts = attrs.map(([k, v]) => attr(k, v, scope, indent + '  '));
  const one = `<${tag}${parts.length ? ' ' + parts.join(' ') : ''}${selfClose ? ' />' : '>'}`;
  if (one.length + indent.length <= 100 && !one.includes('\n')) return one;
  return `<${tag}\n${parts.map((p) => `${indent}  ${p}`).join('\n')}\n${indent}${selfClose ? '/>' : '>'}`;
}

/** Text children with `{paths}` and `{"…"}` escapes for characters JSX can't hold literally. */
function textChildren(v: string, scope: Scope): string {
  const out: string[] = [];
  let last = 0;
  for (const m of v.matchAll(ANY_HOLE)) {
    out.push(escapeText(v.slice(last, m.index)));
    out.push(`{${pathExpr(m[1]!, scope)}}`);
    last = m.index! + m[0].length;
  }
  out.push(escapeText(v.slice(last)));
  return out.join('');
}

function escapeText(s: string): string {
  if (!s) return '';
  if (/[{}<>]/.test(s) || /^\s|\s$/.test(s)) return `{${JSON.stringify(s)}}`;
  return s;
}

function member(v: unknown, scope: Scope, indent: string): string {
  if (isObj(v) && typeof v.$each === 'string') {
    const { $each, ...rest } = v;
    const wanted = scope.names?.[$each];
    const name = wanted && IDENT.test(wanted) && wanted !== 'props' && !scope.taken?.has(wanted) ? wanted : scope.depth === 0 ? 'item' : `item${scope.depth + 1}`;
    const inner: Scope = { item: name, depth: scope.depth + 1, names: scope.names, taken: new Set([...(scope.taken ?? []), name]) };
    return `${indent}{${pathExpr($each, scope)}.map((${name}) => (\n${element(rest, inner, indent + '  ')}\n${indent}))}`;
  }
  if (isCond(v)) {
    const test = condExpr(v.$when as string, scope);
    if ('$else' in v) return `${indent}{${test} ? (\n${branch(v.$value, scope, indent + '  ')}\n${indent}) : (\n${branch(v.$else, scope, indent + '  ')}\n${indent})}`;
    return `${indent}{${test} && (\n${branch(v.$value, scope, indent + '  ')}\n${indent})}`;
  }
  if (isObj(v) && typeof v.type === 'string') return element(v, scope, indent);
  return `${indent}{/* unsupported member */}`;
}

/** A conditional branch: an element, or a fragment around a nested conditional/loop. */
function branch(v: unknown, scope: Scope, indent: string): string {
  if (isObj(v) && typeof v.type === 'string' && !('$each' in v)) return element(v, scope, indent);
  return `${indent}<>\n${member(v, scope, indent + '  ')}\n${indent}</>`;
}

function element(node: Obj, scope: Scope, indent: string): string {
  const type = node.type as string;
  const tag = tagOf(type);
  const attrs = Object.entries(node).filter(([k]) => k !== 'type');
  const take = (key: string) => {
    const i = attrs.findIndex(([k]) => k === key);
    return i >= 0 ? attrs.splice(i, 1)[0]![1] : undefined;
  };

  const textField = TEXT_CHILD_FIELD[type];
  if (textField) {
    const spans = type === 'text' ? take('spans') : undefined;
    const raw = take(textField);
    const label = Array.isArray(raw) ? raw : undefined;
    const value = typeof raw === 'string' && raw !== '' && !raw.includes('\n') ? raw : undefined;
    if (raw !== undefined && value === undefined && !label) attrs.unshift([textField, raw]);
    const spanList = (spans ?? label) as Obj[] | undefined;
    if (spanList) {
      const anyStyled = spanList.some((sp) => Object.keys(sp).some((k) => k !== 'text'));
      const inner = spanList
        .map((sp) => {
          const { text, ...rest } = sp;
          const keys = Object.entries(rest);
          return keys.length || !anyStyled ? `${openTag('Span', keys, scope, indent, false)}${textChildren(String(text), scope)}</Span>` : textChildren(String(text), scope);
        })
        .join('');
      return `${indent}${openTag(tag, attrs, scope, indent, false)}${inner}</${tag}>`;
    }
    if (value !== undefined) return `${indent}${openTag(tag, attrs, scope, indent, false)}${textChildren(value, scope)}</${tag}>`;
    return `${indent}${openTag(tag, attrs, scope, indent, true)}`;
  }

  const blocks: string[] = [];
  const inner = indent + '  ';
  if (type === 'overlay') {
    const base = take('base');
    const layers = (take('layers') as Obj[] | undefined) ?? [];
    if (base !== undefined) blocks.push(`${inner}<Overlay.Base>\n${member(base, scope, inner + '  ')}\n${inner}</Overlay.Base>`);
    for (const l of layers) {
      const { node: n, ...rest } = l;
      blocks.push(`${inner}${openTag('Overlay.Layer', Object.entries(rest), scope, inner, false)}\n${member(n, scope, inner + '  ')}\n${inner}</Overlay.Layer>`);
    }
  } else if (type === 'disclosure') {
    const summary = take('summary');
    const detail = take('detail');
    if (summary !== undefined) blocks.push(`${inner}<Disclosure.Summary>\n${member(summary, scope, inner + '  ')}\n${inner}</Disclosure.Summary>`);
    if (detail !== undefined) blocks.push(`${inner}<Disclosure.Detail>\n${member(detail, scope, inner + '  ')}\n${inner}</Disclosure.Detail>`);
  } else if (type === 'table' && Array.isArray(node.rows)) {
    const rows = take('rows') as Obj[];
    for (const r of rows) {
      const { cells, ...rest } = r;
      blocks.push(`${inner}${openTag('Table.Row', Object.entries(rest), scope, inner, false)}\n${(cells as unknown[]).map((c) => member(c, scope, inner + '  ')).join('\n')}\n${inner}</Table.Row>`);
    }
  } else if (type === 'tabs' && Array.isArray(node.labels) && Array.isArray(node.children)) {
    const labels = take('labels') as unknown[];
    const panes = take('children') as unknown[];
    panes.forEach((p, i) => blocks.push(`${inner}${openTag('Tabs.Pane', [['label', labels[i]]], scope, inner, false)}\n${member(p, scope, inner + '  ')}\n${inner}</Tabs.Pane>`));
  } else {
    const children = take('children');
    if (Array.isArray(children) && children.length === 0) attrs.push(['children', []]);
    else if (Array.isArray(children)) for (const c of children) blocks.push(member(c, scope, inner));
  }
  if (!blocks.length) return `${indent}${openTag(tag, attrs, scope, indent, true)}`;
  return `${indent}${openTag(tag, attrs, scope, indent, false)}\n${blocks.join('\n')}\n${indent}</${tag}>`;
}

export interface PrintOptions {
  sample?: Record<string, unknown>;
  meta?: Record<string, string>;
  /** Loop variable names by `$each` path (from `compileJsx(…).itemNames`). */
  itemNames?: Record<string, string>;
}

/** A `.sdui.jsx` module for a node tree (plain or with binder syntax). */
export function printJsx(tree: Record<string, unknown>, opts: PrintOptions = {}): string {
  const head = Object.entries(opts.meta ?? {})
    .map(([k, v]) => `// @${k} ${v}`)
    .join('\n');
  const sample = opts.sample && Object.keys(opts.sample).length ? `export const sample = ${expr(opts.sample, { depth: 0 }, '')};\n\n` : '';
  const body = element(tree, { depth: 0, names: opts.itemNames }, '  ');
  return `${head ? head + '\n\n' : ''}${sample}export default (props) => (\n${body}\n);\n`;
}
