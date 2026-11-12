import { Parser, type Comment, type Node as AcornNode } from 'acorn';
import jsx from 'acorn-jsx';
import { LIST_PARENTS, SLOT_TAGS, TEXT_CHILD_FIELD, TYPE_OF_TAG, type SlotTag } from './names';
import { bindLayout, TOO_DEEP } from '../binder';

/* Minimal ESTree/JSX shapes we read. */
type N = AcornNode & Record<string, any>;

export class JsxCompileError extends Error {
  constructor(
    message: string,
    readonly line: number,
    readonly column: number,
  ) {
    super(`${message} (line ${line}:${column + 1})`);
  }
}

export interface CompiledTemplate {
  /** The node tree. Holds binder syntax ($when/$each/{{…}}) when `bound` is true. */
  tree: Record<string, unknown>;
  bound: boolean;
  sample: Record<string, unknown>;
  meta: Record<string, string>;
  /** Source range of each compiled element object, for editors. */
  locs: WeakMap<object, SourceRange>;
  /** Loop variable names by `$each` source path, so printing keeps `rooms.map((room) => …)`. */
  itemNames: Record<string, string>;
}

export interface SourceRange {
  from: number;
  to: number;
}

const JsxParser = Parser.extend(jsx());

interface Scope {
  props: string;
  item?: string;
}

class Compiler {
  bound = false;
  locs = new WeakMap<object, SourceRange>();
  itemNames: Record<string, string> = {};
  constructor(private readonly src: string) {}

  fail(node: N, message: string): never {
    const loc = node.loc?.start ?? { line: 1, column: 0 };
    throw new JsxCompileError(message, loc.line, loc.column);
  }

  /* ---------- paths and conditions ---------- */

  path(node: N, scope: Scope): string | null {
    const segs: string[] = [];
    let cur = node;
    while (cur.type === 'MemberExpression') {
      if (cur.computed || cur.property.type !== 'Identifier') this.fail(cur, 'Only plain property access is allowed (no [index])');
      segs.unshift(cur.property.name);
      cur = cur.object;
    }
    if (cur.type !== 'Identifier') return null;
    if (cur.name === scope.props) {
      if (!segs.length) this.fail(node, `Use a property of ${scope.props}, not ${scope.props} itself`);
      this.bound = true;
      return segs.join('.');
    }
    if (scope.item && cur.name === scope.item) {
      this.bound = true;
      return segs.length ? `.${segs.join('.')}` : '.';
    }
    this.fail(cur, `Unknown name "${cur.name}". Only ${scope.props}${scope.item ? ` and ${scope.item}` : ''} are in scope`);
  }

  literalString(node: N): string | null {
    if (node.type === 'Literal' && (typeof node.value !== 'object' || node.value === null)) return String(node.value);
    if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
    return null;
  }

  condition(node: N, scope: Scope): string {
    if (node.type === 'UnaryExpression' && node.operator === '!') {
      const p = this.path(node.argument, scope);
      if (p === null) this.fail(node, 'Negate a path, e.g. !props.flag');
      return `!${p}`;
    }
    if (node.type === 'BinaryExpression' && ['===', '==', '!==', '!='].includes(node.operator)) {
      const left = this.path(node.left, scope);
      if (left === null) this.fail(node.left, 'The left side of a comparison must be a path');
      const lit = this.literalString(node.right);
      const right = lit ?? (() => {
        const p = this.path(node.right, scope);
        if (p === null) this.fail(node.right, 'Compare with a literal or another path');
        return `$${p}`;
      })();
      return `${left}${node.operator.startsWith('!') ? '!=' : '='}${right}`;
    }
    const p = this.path(node, scope);
    if (p === null) this.fail(node, 'Conditions must be a path, !path, or a comparison');
    return p;
  }

  /* ---------- attribute values ---------- */

  value(node: N, scope: Scope): unknown {
    switch (node.type) {
      case 'Literal':
        if (node.regex) this.fail(node, 'Regular expressions are not allowed');
        return node.value;
      case 'TemplateLiteral':
        return node.quasis
          .map((q: N, i: number) => {
            const e = node.expressions[i];
            if (!e) return q.value.cooked;
            const p = this.path(e, scope);
            if (p === null) this.fail(e, 'Template strings may only insert paths');
            return `${q.value.cooked}{{${p}}}`;
          })
          .join('');
      case 'UnaryExpression':
        if (node.operator === '-' && node.argument.type === 'Literal' && typeof node.argument.value === 'number') return -node.argument.value;
        if (node.operator === '!' ) this.fail(node, 'Use a condition inside && or ?: instead');
        break;
      case 'ArrayExpression':
        return node.elements.map((e: N) => {
          if (!e || e.type === 'SpreadElement') this.fail(node, 'Spreads and holes are not allowed in arrays');
          return this.value(e, scope);
        });
      case 'ObjectExpression': {
        const out: Record<string, unknown> = {};
        for (const p of node.properties) {
          if (p.type !== 'Property' || p.computed || p.kind !== 'init' || p.method) this.fail(p, 'Only plain key: value properties are allowed');
          const key = p.key.type === 'Identifier' ? p.key.name : String(p.key.value);
          out[key] = this.value(p.value, scope);
        }
        return out;
      }
      case 'ConditionalExpression':
        return { $when: this.condition(node.test, scope), $value: this.value(node.consequent, scope), $else: this.value(node.alternate, scope) };
      case 'LogicalExpression':
        if (node.operator === '&&') return { $when: this.condition(node.left, scope), $value: this.value(node.right, scope) };
        this.fail(node, 'Only && is supported; use a ternary for fallbacks');
      case 'JSXElement':
      case 'JSXFragment':
        return this.element(node, scope);
      case 'MemberExpression':
      case 'Identifier': {
        if (node.type === 'Identifier' && node.name === 'undefined') return undefined;
        const p = this.path(node, scope);
        if (p !== null) return `{{${p}}}`;
        break;
      }
    }
    this.fail(node, `Unsupported expression: ${node.type}`);
  }

  /* ---------- JSX ---------- */

  tagName(node: N): string {
    const n = node.openingElement.name;
    if (n.type === 'JSXIdentifier') return n.name;
    if (n.type === 'JSXMemberExpression' && n.object.type === 'JSXIdentifier') return `${n.object.name}.${n.property.name}`;
    this.fail(node, 'Unsupported tag name');
  }

  attrs(node: N, scope: Scope): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const a of node.openingElement.attributes) {
      if (a.type === 'JSXSpreadAttribute') this.fail(a, 'Spread props are not allowed');
      const name = a.name.type === 'JSXIdentifier' ? a.name.name : this.fail(a, 'Namespaced attributes are not allowed');
      if (name === 'key') continue;
      let v: unknown;
      if (a.value === null) v = true;
      else if (a.value.type === 'Literal') v = a.value.value;
      else if (a.value.type === 'JSXExpressionContainer') {
        if (a.value.expression.type === 'JSXEmptyExpression') continue;
        v = this.value(a.value.expression, scope);
      } else v = this.value(a.value, scope);
      if (v !== undefined) out[name] = v;
    }
    return out;
  }

  /** JSX text whitespace, React-style: trim each line, drop blank lines, join with spaces. */
  cleanText(raw: string): string {
    const lines = raw.split(/\r\n|\n|\r/);
    let out = '';
    lines.forEach((line, i) => {
      let l = line.replace(/\t/g, ' ');
      if (i > 0) l = l.replace(/^[ ]+/, '');
      if (i < lines.length - 1) l = l.replace(/[ ]+$/, '');
      if (!l) return;
      out += (out && i > 0 ? ' ' : '') + l;
    });
    return out;
  }

  /** Children that are list members: nodes, conditionals, and .map() loops. */
  members(children: N[], scope: Scope, ctx: string): unknown[] {
    const out: unknown[] = [];
    for (const c of children) {
      if (c.type === 'JSXText') {
        if (this.cleanText(c.value)) this.fail(c, `Text isn't allowed directly inside ${ctx}; wrap it in <Text>`);
        continue;
      }
      if (c.type === 'JSXElement' || c.type === 'JSXFragment') {
        out.push(...this.elementOrFragment(c, scope));
        continue;
      }
      if (c.type === 'JSXExpressionContainer') {
        const e = c.expression;
        if (e.type === 'JSXEmptyExpression') continue;
        out.push(this.member(e, scope));
        continue;
      }
      this.fail(c, `Unsupported child in ${ctx}`);
    }
    return out;
  }

  member(e: N, scope: Scope): unknown {
    if (e.type === 'JSXElement' || e.type === 'JSXFragment') {
      const nodes = this.elementOrFragment(e, scope);
      if (nodes.length !== 1) this.fail(e, 'A conditional branch must be a single element');
      return nodes[0];
    }
    if (e.type === 'LogicalExpression' && e.operator === '&&') return { $when: this.condition(e.left, scope), $value: this.member(e.right, scope) };
    if (e.type === 'ConditionalExpression') {
      const alt = e.alternate.type === 'Literal' && e.alternate.value === null ? undefined : this.member(e.alternate, scope);
      return { $when: this.condition(e.test, scope), $value: this.member(e.consequent, scope), ...(alt !== undefined ? { $else: alt } : {}) };
    }
    if (e.type === 'CallExpression' && e.callee.type === 'MemberExpression' && !e.callee.computed && e.callee.property.name === 'map') {
      const source = this.path(e.callee.object, scope);
      if (source === null) this.fail(e.callee.object, 'map() must be called on a path');
      const fn = e.arguments[0];
      if (!fn || (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression')) this.fail(e, 'map() takes an arrow function');
      const param = fn.params[0];
      if (!param || param.type !== 'Identifier') this.fail(fn, 'map() needs one named parameter, e.g. (item) => …');
      if (fn.params.length > 1) this.fail(fn, 'Use only the item parameter; the index is not available');
      const body = fn.body.type === 'BlockStatement' ? this.returned(fn.body) : fn.body;
      const node = this.member(body, { props: scope.props, item: param.name });
      if (!node || typeof node !== 'object' || Array.isArray(node)) this.fail(body, 'map() must return one element');
      this.itemNames[source] ??= param.name;
      const looped = { $each: source, ...(node as object) };
      const loc = this.locs.get(node as object);
      if (loc) this.locs.set(looped, loc);
      return looped;
    }
    if (e.type === 'Literal' && e.value === null) return undefined;
    this.fail(e, 'Use an element, cond && element, a ternary, or props.list.map(…)');
  }

  returned(block: N): N {
    const ret = block.body.find((s: N) => s.type === 'ReturnStatement');
    if (!ret || block.body.length !== 1 || !ret.argument) this.fail(block, 'Function bodies may only `return (<…/>)`');
    return ret.argument;
  }

  elementOrFragment(node: N, scope: Scope): Record<string, unknown>[] {
    if (node.type === 'JSXFragment') return this.members(node.children, scope, 'a fragment') as Record<string, unknown>[];
    return [this.element(node, scope)];
  }

  /** Text children: plain text and {paths} become one string; <Span>s make spans. */
  textChildren(children: N[], scope: Scope): string | Record<string, unknown>[] | undefined {
    const parts: (string | Record<string, unknown>)[] = [];
    let hasSpan = false;
    for (const c of children) {
      if (c.type === 'JSXText') {
        const t = this.cleanText(c.value);
        if (t) parts.push(t);
      } else if (c.type === 'JSXExpressionContainer') {
        const e = c.expression;
        if (e.type === 'JSXEmptyExpression') continue;
        const lit = this.literalString(e);
        if (lit !== null) parts.push(lit);
        else {
          const v = this.value(e, scope);
          if (typeof v !== 'string') this.fail(e, 'Only text or paths may appear in text');
          parts.push(v);
        }
      } else if (c.type === 'JSXElement' && this.tagName(c) === 'Span') {
        hasSpan = true;
        const attrs = this.attrs(c, scope);
        const text = this.textChildren(c.children, scope);
        if (typeof text !== 'string') this.fail(c, '<Span> holds plain text only');
        parts.push({ text, ...attrs });
      } else this.fail(c, 'Text may contain only text, {paths} and <Span>');
    }
    if (!parts.length) return undefined;
    if (!hasSpan) return parts.map(String).join('');
    return parts.map((p) => (typeof p === 'string' ? { text: p } : p));
  }

  element(node: N, scope: Scope): Record<string, unknown> {
    if (node.type === 'JSXFragment') this.fail(node, 'A fragment can only appear as a list of children');
    const tag = this.tagName(node);
    if (tag in SLOT_TAGS) this.fail(node, `<${tag}> must be a direct child of <${tag.split('.')[0]}>`);
    const type = TYPE_OF_TAG.get(tag);
    if (!type) this.fail(node, `Unknown element <${tag}>`);
    const out: Record<string, unknown> = { type, ...this.attrs(node, scope) };
    this.locs.set(out, { from: node.start, to: node.end });
    const children: N[] = node.children;
    const meaningful = children.filter((c) => !(c.type === 'JSXText' && !this.cleanText(c.value)) && !(c.type === 'JSXExpressionContainer' && c.expression.type === 'JSXEmptyExpression'));
    if (!meaningful.length) return out;

    const textField = TEXT_CHILD_FIELD[type];
    if (textField) {
      const text = this.textChildren(children, scope);
      if (text === undefined) return out;
      if (textField in out) this.fail(node, `Give <${tag}> either a ${textField} attribute or children, not both`);
      if (Array.isArray(text)) out[type === 'text' ? 'spans' : 'label'] = text;
      else out[textField] = text;
      return out;
    }

    const slotKids = meaningful.filter((c) => c.type === 'JSXElement' && this.tagName(c) in SLOT_TAGS);
    if (type === 'overlay') {
      for (const c of slotKids) {
        const t = this.tagName(c) as SlotTag;
        const inner = this.single(c, scope);
        if (t === 'Overlay.Base') out.base = inner;
        else if (t === 'Overlay.Layer') out.layers = [...((out.layers as unknown[]) ?? []), { ...this.attrs(c, scope), node: inner }];
        else this.fail(c, `<${t}> doesn't belong in <Overlay>`);
      }
      if (slotKids.length !== meaningful.length) this.fail(node, '<Overlay> takes <Overlay.Base> and <Overlay.Layer> children');
      return out;
    }
    if (type === 'disclosure') {
      for (const c of slotKids) {
        const t = this.tagName(c);
        if (t === 'Disclosure.Summary') out.summary = this.single(c, scope);
        else if (t === 'Disclosure.Detail') out.detail = this.single(c, scope);
        else this.fail(c, `<${t}> doesn't belong in <Disclosure>`);
      }
      if (slotKids.length !== meaningful.length) this.fail(node, '<Disclosure> takes <Disclosure.Summary> and <Disclosure.Detail>');
      return out;
    }
    if (type === 'table' && slotKids.length) {
      if (slotKids.length !== meaningful.length) this.fail(node, 'Mix of <Table.Row> and plain cells');
      out.rows = slotKids.map((r) => ({ ...this.attrs(r, scope), cells: this.members(r.children, scope, '<Table.Row>') }));
      return out;
    }
    if (type === 'tabs') {
      const labels: unknown[] = [];
      const panes: unknown[] = [];
      for (const c of meaningful) {
        if (c.type !== 'JSXElement' || this.tagName(c) !== 'Tabs.Pane') this.fail(c, '<Tabs> takes <Tabs.Pane label="…"> children');
        const a = this.attrs(c, scope);
        labels.push(a.label);
        panes.push(this.single(c, scope));
      }
      out.labels = labels;
      out.children = panes;
      return out;
    }
    if (!LIST_PARENTS.has(type)) this.fail(node, `<${tag}> doesn't take children`);
    if (slotKids.length) this.fail(slotKids[0]!, `<${this.tagName(slotKids[0]!)}> doesn't belong in <${tag}>`);
    out.children = this.members(children, scope, `<${tag}>`);
    return out;
  }

  single(node: N, scope: Scope): unknown {
    const nodes = this.members(node.children, scope, `<${this.tagName(node)}>`);
    if (nodes.length !== 1) this.fail(node, `<${this.tagName(node)}> needs exactly one child`);
    return nodes[0];
  }

  /* ---------- module ---------- */

  literal(node: N): unknown {
    const v = this.value(node, { props: '\0' });
    return v;
  }

  module(): CompiledTemplate {
    const comments: Comment[] = [];
    let ast: N;
    try {
      ast = JsxParser.parse(this.src, { ecmaVersion: 'latest', sourceType: 'module', locations: true, onComment: comments }) as N;
    } catch (e) {
      const err = e as { message: string; loc?: { line: number; column: number } };
      throw new JsxCompileError(err.message.replace(/ \(\d+:\d+\)$/, ''), err.loc?.line ?? 1, err.loc?.column ?? 0);
    }
    const meta: Record<string, string> = {};
    for (const c of comments) {
      const m = /^\s*@(\w+)\s+(.+?)\s*$/.exec(c.value);
      if (m) meta[m[1]!] = m[2]!;
    }
    let sample: Record<string, unknown> = {};
    let tree: Record<string, unknown> | undefined;
    for (const stmt of ast.body) {
      if (stmt.type === 'ExportNamedDeclaration' && stmt.declaration?.type === 'VariableDeclaration') {
        for (const d of stmt.declaration.declarations) {
          if (d.id.name === 'sample' && d.init) sample = this.literal(d.init) as Record<string, unknown>;
          else this.fail(d, 'Only `export const sample = {…}` is allowed besides the default export');
        }
      } else if (stmt.type === 'ExportDefaultDeclaration') {
        tree = this.template(stmt.declaration);
      } else if (stmt.type === 'ImportDeclaration') {
        continue;
      } else {
        this.fail(stmt, 'Only `export const sample` and `export default` are allowed');
      }
    }
    if (!tree) throw new JsxCompileError('Missing `export default (props) => (<…/>)`', 1, 0);
    return { tree, bound: this.bound, sample, meta, locs: this.locs, itemNames: this.itemNames };
  }

  template(decl: N): Record<string, unknown> {
    if (decl.type === 'JSXElement') return this.element(decl, { props: 'props' });
    if (decl.type === 'ArrowFunctionExpression' || decl.type === 'FunctionDeclaration' || decl.type === 'FunctionExpression') {
      const p = decl.params[0];
      if (decl.params.length > 1 || (p && p.type !== 'Identifier')) this.fail(decl, 'The template takes one parameter, e.g. (props) => …');
      const body = decl.body.type === 'BlockStatement' ? this.returned(decl.body) : decl.body;
      if (body.type !== 'JSXElement') this.fail(body, 'The template must return one root element');
      return this.element(body, { props: p?.name ?? 'props' });
    }
    this.fail(decl, 'Default export must be (props) => (<…/>) or a JSX element');
  }
}

export function compileJsx(src: string): CompiledTemplate {
  return new Compiler(src).module();
}

/** The `view` envelope a server would send for this template. */
/** The node tree for one set of props: the template bound to `props` (or the static tree). `null` when binding gives nothing. */
export function instantiate(t: CompiledTemplate, props: Record<string, unknown>): unknown {
  if (!t.bound) return t.tree;
  const bound = bindLayout(t.tree, props);
  return bound === TOO_DEEP ? null : bound;
}

export function toEnvelope(t: CompiledTemplate): Record<string, unknown> {
  return t.bound ? { type: 'view', version: 1, layout: t.tree, props: t.sample } : { type: 'view', version: 1, root: t.tree };
}
