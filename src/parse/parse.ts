import type { z } from 'zod';
import { bindLayout, TOO_DEEP } from '../binder';
import { resolveViewLimits, VIEW_LIMITS, type Budget, type ResolvedLimits } from '../limits';
import { trackingEvent, type TrackingKey } from '../wire/tracking';
import { viewEnvelopeSchema, type ViewEnvelope } from '../wire/envelope';
import { RESERVED_INPUT_NAMES } from '../wire/primitives';
import type { IssueReason, ParseIssue } from './issues';
import type { ViewNode, ViewNodeDefinition, ViewNodeRegistry } from './registry';

interface FormFrame {
  names: ReadonlySet<string>;
}

interface WalkScope {
  form?: FormFrame;
  untouchable?: string;
}

interface Walker {
  registry: ViewNodeRegistry;
  hard: Budget;
  count: number;
  maxDepth: number;
  issues: ParseIssue[];
  aborted: 'too-deep' | 'too-many-nodes' | null;
}

class NodeFailure {
  constructor(
    readonly reason: IssueReason,
    readonly detail?: string,
  ) {}
}

const FORM_READ = /(?<!\{)\{([a-z][a-zA-Z0-9]*)\}(?!\})/g;
const INPUT_TYPES = new Set(['choice', 'stepper', 'textInput']);

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

function zodDetail(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) return 'schema';
  const at = first.path.length ? first.path.join('.') : '(node)';
  return `${at}: ${first.message}`;
}

function collectInputNames(raw: unknown, out: Set<string>, seen = 0): void {
  if (seen > 64) return;
  if (Array.isArray(raw)) {
    for (const v of raw) collectInputNames(v, out, seen + 1);
    return;
  }
  if (!isRecord(raw)) return;
  if (typeof raw.type === 'string' && INPUT_TYPES.has(raw.type) && typeof raw.name === 'string') out.add(raw.name);
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'action' || k === 'tracking') continue;
    if (raw.type === 'form' && k === 'children' && seen > 0) continue;
    collectInputNames(v, out, seen + 1);
  }
}

export function formReads(node: Record<string, unknown>): string[] {
  const out = new Set<string>();
  const scan = (v: unknown, depth: number) => {
    if (depth > 8) return;
    if (typeof v === 'string') for (const m of v.matchAll(FORM_READ)) out.add(m[1]!);
    else if (Array.isArray(v)) v.forEach((x) => scan(x, depth + 1));
    else if (isRecord(v)) for (const [k, x] of Object.entries(v)) if (k !== 'tracking') scan(x, depth + 1);
  };
  scan(node.label, 0);
  scan(node.action, 0);
  return [...out];
}

function processTracking(def: ViewNodeDefinition, raw: unknown, path: string, issues: ParseIssue[]): unknown {
  if (raw === undefined) return undefined;
  if (def.tracking === 'single') {
    const r = trackingEvent.safeParse(raw);
    if (r.success) return r.data;
    issues.push({ path: `${path}.tracking`, reason: 'invalid-fields', detail: `tracking: ${zodDetail(r.error)}` });
    return undefined;
  }
  if (!isRecord(raw)) {
    issues.push({ path: `${path}.tracking`, reason: 'invalid-fields', detail: 'tracking: not a record' });
    return undefined;
  }
  const allowed = new Set<TrackingKey>(['onShow', ...def.tracking]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!allowed.has(k as TrackingKey)) {
      issues.push({ path: `${path}.tracking.${k}`, reason: 'tracking-unsupported' });
      continue;
    }
    const r = trackingEvent.safeParse(v);
    if (r.success) out[k] = r.data;
    else issues.push({ path: `${path}.tracking.${k}`, reason: 'invalid-fields', detail: `tracking: ${zodDetail(r.error)}` });
  }
  return Object.keys(out).length ? out : undefined;
}

function filterLenientEntries(def: ViewNodeDefinition, node: Record<string, unknown>, path: string, issues: ParseIssue[]) {
  for (const le of def.lenientEntries ?? []) {
    const v = node[le.field];
    if (le.shape === 'list' && Array.isArray(v)) {
      node[le.field] = v.filter((entry, i) => {
        const r = le.entry.safeParse(entry);
        if (!r.success) issues.push({ path: `${path}.${le.field}[${i}]`, reason: 'invalid-fields', detail: zodDetail(r.error) });
        return r.success;
      });
    } else if (le.shape === 'record' && isRecord(v)) {
      node[le.field] = Object.fromEntries(
        Object.entries(v).filter(([k, entry]) => {
          const r = le.entry.safeParse(entry);
          if (!r.success) issues.push({ path: `${path}.${le.field}.${k}`, reason: 'invalid-fields', detail: zodDetail(r.error) });
          return r.success;
        }),
      );
    }
  }
}

function menuIds(node: unknown, out: Set<string>, depth = 0): void {
  if (depth > 64) return;
  if (Array.isArray(node)) node.forEach((n) => menuIds(n, out, depth + 1));
  else if (isRecord(node)) {
    if (node.type === 'menu' && typeof node.id === 'string') out.add(node.id);
    for (const [k, v] of Object.entries(node)) if (k !== 'action' && k !== 'tracking') menuIds(v, out, depth + 1);
  }
}

function walk(w: Walker, raw: unknown, path: string, depth: number, scope: WalkScope): ViewNode | null {
  if (w.aborted) return null;
  if (depth > w.hard.depth) {
    w.aborted = 'too-deep';
    w.issues.push({ path, reason: 'too-deep' });
    return null;
  }
  w.count += 1;
  if (w.count > w.hard.nodes) {
    w.aborted = 'too-many-nodes';
    w.issues.push({ path, reason: 'too-many-nodes' });
    return null;
  }
  if (depth > w.maxDepth) w.maxDepth = depth;
  const mark = w.issues.length;
  let failure: NodeFailure;
  try {
    return attempt(w, raw, path, depth, scope);
  } catch (e) {
    if (!(e instanceof NodeFailure)) throw e;
    failure = e;
  }
  if (w.aborted) return null;
  const issueAt = w.issues.length;
  w.issues.push({ path, reason: failure.reason, ...(failure.detail ? { detail: failure.detail } : {}) });
  if (isRecord(raw) && 'fallback' in raw) {
    const fb = walk(w, raw.fallback, `${path}.fallback`, depth + 1, scope);
    if (fb) {
      const issue = w.issues[issueAt]!;
      issue.fellBack = true;
      if (typeof raw.type === 'string') issue.type = raw.type;
      return fb;
    }
  }
  for (let i = mark; i < w.issues.length; i++) {
    const issue = w.issues[i]!;
    delete issue.fellBack;
    delete issue.type;
  }
  return null;
}

function attempt(w: Walker, raw: unknown, path: string, depth: number, scope: WalkScope): ViewNode {
  if (!isRecord(raw) || typeof raw.type !== 'string') throw new NodeFailure('not-a-node');
  const def = w.registry.get(raw.type);
  if (!def) throw new NodeFailure('unknown-type', raw.type);

  const { fallback: _fallback, tracking: rawTracking, ...rest } = raw;
  const tracking = processTracking(def, rawTracking, path, w.issues);
  filterLenientEntries(def, rest, path, w.issues);

  const parsed = def.schema.safeParse(rest);
  if (!parsed.success) throw new NodeFailure('invalid-fields', zodDetail(parsed.error));
  const node: ViewNode = { ...(parsed.data as Record<string, unknown>), type: def.type };
  if (tracking !== undefined) node.tracking = tracking;

  if (def.formInput) {
    if (scope.untouchable) throw new NodeFailure('form-scope', `input inside ${scope.untouchable}`);
    if (!scope.form) throw new NodeFailure('form-scope', 'input outside a form');
  }
  if (def.formScope && (scope.form || scope.untouchable)) {
    throw new NodeFailure('form-scope', scope.untouchable ? `form inside ${scope.untouchable}` : 'nested form');
  }
  if (def.readsForm && scope.untouchable) throw new NodeFailure('form-scope', `button inside ${scope.untouchable}`);

  let childScope = scope;
  if (def.formScope) {
    const names = new Set<string>();
    collectInputNames(rest.children, names);
    childScope = { form: { names } };
  }
  if (def.untouchableChildren) childScope = { ...childScope, untouchable: def.untouchableChildren };

  walkSlots(w, def, node, path, depth, childScope);

  if (def.readsForm && scope.form) {
    for (const name of formReads(node)) {
      if ((RESERVED_INPUT_NAMES as readonly string[]).includes(name) || !scope.form.names.has(name)) {
        throw new NodeFailure('form-scope', `reads {${name}} which no input holds`);
      }
    }
  }

  if (def.type === 'card' && typeof node.longPress === 'string') {
    const ids = new Set<string>();
    menuIds(node.children, ids);
    if (!ids.has(node.longPress)) {
      w.issues.push({ path: `${path}.longPress`, reason: 'unknown-menu', detail: node.longPress });
      delete node.longPress;
    }
  }
  return node;
}

function walkSlots(w: Walker, def: ViewNodeDefinition, node: ViewNode, path: string, depth: number, scope: WalkScope) {
  const s = def.slots;
  const d = depth + 1;
  if (s?.list) {
    for (const field of s.list) {
      const list = node[field];
      if (!Array.isArray(list)) continue;
      const inertScope = s.inert?.[field] ? { ...scope, untouchable: s.inert[field] } : scope;
      const kept: ViewNode[] = [];
      const dropped: number[] = [];
      list.forEach((child, i) => {
        const parsed = walk(w, child, `${path}.${field}[${i}]`, d, inertScope);
        if (parsed) kept.push(parsed);
        else dropped.push(i);
      });
      if (w.aborted) throw new NodeFailure('invalid-fields', 'aborted');
      if (s.whole?.includes(field) && dropped.length > 0) throw new NodeFailure('invalid-fields', `${field}: a child dropped`);
      if (s.required?.includes(field) && list.length > 0 && kept.length === 0) {
        throw new NodeFailure('invalid-fields', `${field}: every child dropped`);
      }
      node[field] = kept;
      const pairedField = s.paired?.[field];
      if (pairedField && Array.isArray(node[pairedField]) && dropped.length) {
        const drop = new Set(dropped);
        node[pairedField] = (node[pairedField] as unknown[]).filter((_, i) => !drop.has(i));
      }
    }
  }
  for (const field of s?.node ?? []) {
    const parsed = walk(w, node[field], `${path}.${field}`, d, scope);
    if (w.aborted) throw new NodeFailure('invalid-fields', 'aborted');
    if (!parsed) throw new NodeFailure('invalid-fields', `${field}: node failed`);
    node[field] = parsed;
  }
  for (const { field, key } of s?.entry ?? []) {
    const entries = node[field];
    if (!Array.isArray(entries)) continue;
    const inertScope = s?.inert?.[field] ? { ...scope, untouchable: s.inert[field] } : scope;
    const kept: unknown[] = [];
    entries.forEach((entry: Record<string, unknown>, i) => {
      const parsed = walk(w, entry[key], `${path}.${field}[${i}].${key}`, d, inertScope);
      if (parsed) kept.push({ ...entry, [key]: parsed });
    });
    if (w.aborted) throw new NodeFailure('invalid-fields', 'aborted');
    node[field] = kept;
  }
  for (const { field, key } of s?.grid ?? []) {
    const rows = node[field];
    if (!Array.isArray(rows)) continue;
    node[field] = rows.map((row: Record<string, unknown>, r) => {
      const cells = (row[key] as unknown[]).map((cell, c) => {
        const parsed = walk(w, cell, `${path}.${field}[${r}].${key}[${c}]`, d, scope);
        if (!parsed) throw new NodeFailure('invalid-fields', `${field}[${r}].${key}[${c}]: cell failed`);
        return parsed;
      });
      return { ...row, [key]: cells };
    });
  }
  if (def.inner) {
    const innerScope = { ...scope, untouchable: def.inner.scope };
    def.inner.visit(node, (raw, sub) => walk(w, raw, `${path}.${sub}`, d, innerScope));
    if (w.aborted) throw new NodeFailure('invalid-fields', 'aborted');
  }
}

function checkDuplicateIds(registry: ViewNodeRegistry, root: ViewNode, issues: ParseIssue[]) {
  const seen = new Map<string, number>();
  const visit = (v: unknown, depth: number) => {
    if (depth > 128) return;
    if (Array.isArray(v)) v.forEach((x) => visit(x, depth + 1));
    else if (isRecord(v)) {
      if (typeof v.type === 'string' && typeof v.id === 'string' && registry.get(v.type)?.drafts) {
        seen.set(v.id, (seen.get(v.id) ?? 0) + 1);
      }
      for (const [k, x] of Object.entries(v)) if (k !== 'action' && k !== 'tracking') visit(x, depth + 1);
    }
  };
  visit(root, 0);
  for (const [id, n] of seen) if (n > 1) issues.push({ path: 'root', reason: 'duplicate-id', detail: id });
}

export interface ParsedTree {
  root: ViewNode | null;
  issues: ParseIssue[];
  limits: ResolvedLimits | null;
  nodes: number;
  depth: number;
}

export interface ParseViewOptions {
  base?: Budget;
  limits?: ViewEnvelope['limits'];
  rootPath?: string;
}

export function parseView(registry: ViewNodeRegistry, raw: unknown, opts: ParseViewOptions = {}): ParsedTree {
  const issues: ParseIssue[] = [];
  const limits = resolveViewLimits(opts.limits, opts.base ?? VIEW_LIMITS);
  if (!limits) {
    issues.push({ path: 'limits', reason: 'soft-above-hard' });
    return { root: null, issues, limits, nodes: 0, depth: 0 };
  }
  const w: Walker = { registry, hard: limits.hard, count: 0, maxDepth: 0, issues, aborted: null };
  let root = walk(w, raw, opts.rootPath ?? 'root', 1, {});
  if (w.aborted) root = null;
  if (root) checkDuplicateIds(registry, root, issues);
  return { root, issues, limits, nodes: w.count, depth: w.maxDepth };
}

export type ViewPatchResult =
  | { kind: 'rejected'; detail: string }
  | { kind: 'empty'; envelope: ViewEnvelope }
  | { kind: 'tree'; envelope: ViewEnvelope; tree: ParsedTree; tracking: unknown; trackingIssues: ParseIssue[] };

export function parseViewPatch(
  registry: ViewNodeRegistry,
  patch: unknown,
  opts: { base?: Budget } = {},
): ViewPatchResult {
  const env = viewEnvelopeSchema.safeParse(patch);
  if (!env.success) return { kind: 'rejected', detail: zodDetail(env.error) };
  const envelope = env.data;

  const trackingIssues: ParseIssue[] = [];
  let tracking: unknown;
  if (envelope.tracking !== undefined) {
    const blockDef: ViewNodeDefinition = { type: 'view', schema: null as never, tracking: ['onDismiss'] };
    tracking = processTracking(blockDef, envelope.tracking, 'tracking', trackingIssues);
  }

  let source: unknown = envelope.root;
  if (envelope.layout !== undefined) {
    const bound = bindLayout(envelope.layout, envelope.props ?? {});
    if (bound === TOO_DEEP) {
      return {
        kind: 'tree',
        envelope,
        tracking,
        trackingIssues,
        tree: { root: null, issues: [{ path: 'layout', reason: 'too-deep', detail: 'binder' }], limits: null, nodes: 0, depth: 0 },
      };
    }
    source = bound;
  }
  if (source === null || source === undefined) return { kind: 'empty', envelope };

  const tree = parseView(registry, source, { base: opts.base, limits: envelope.limits });
  const blockShow = isRecord(tracking) && 'onShow' in tracking;
  if (blockShow && tree.root && isRecord(tree.root.tracking) && 'onShow' in tree.root.tracking) {
    const { onShow: _drop, ...others } = tree.root.tracking;
    tree.root.tracking = Object.keys(others).length ? others : undefined;
    if (tree.root.tracking === undefined) delete tree.root.tracking;
    trackingIssues.push({ path: 'root.tracking.onShow', reason: 'tracking-duplicate' });
  }
  return { kind: 'tree', envelope, tree, tracking, trackingIssues };
}
