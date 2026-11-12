/* Template packages: one props schema and set of samples, many targeted variants. */

export type Platform = 'android' | 'ios' | 'web';

export interface VariantTarget {
  platform?: Platform;
  /** semver range, e.g. ">=1.1.0 <2.0.0", "1.0.x", "^1.2.0", or ranges joined with "||". */
  appVersion?: string;
  /** Matches when the client is in this experiment arm. */
  experiment?: { name: string; arm: string };
}

export interface VariantInfo {
  id: string;
  label: string;
  file: string;
  /** Any one target matching selects this variant. Empty targets never match; use `fallback`. */
  targets: VariantTarget[];
  fallback?: boolean;
}

export interface JsonSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
  /** Prompt for the field: what it holds and how to extract it from the content. */
  description?: string;
  const?: string | number | boolean;
  oneOf?: JsonSchema[];
  additionalProperties?: boolean;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: (string | number | boolean)[];
}

export interface TemplateReference {
  name: string;
  /** Image file in the template folder, e.g. ref-default-lq3x.png */
  image: string;
  /** Figma URL the image came from. */
  figma?: string;
  /** Index of the sample whose data the design shows. */
  sample?: number;
  /** Pixel density of the image (2 for a Figma @2x export). Omitted: scale it to the preview width. */
  scale?: number;
  /** Nudge (points) that lines the image up with the preview in overlay/difference mode. */
  offset?: { x: number; y: number };
}

export interface TemplateManifest {
  id: string;
  name: string;
  /** Prompt for template selection: what this template shows and when to choose it. Shared by every variant. */
  prompt: string;
  /** Where the template started: an explorer story and its Figma frame. */
  origin?: { story?: string; figma?: string };
  /** Design references (Figma frames, screenshots) to compare the preview against. */
  references?: TemplateReference[];
  schema: JsonSchema;
  samples: { name: string; data: Record<string, unknown> }[];
  variants: VariantInfo[];
}

export interface ClientContext {
  platform: Platform;
  appVersion: string;
  experiments?: Record<string, string>;
}

/* ---------- semver ---------- */

type V = [number, number, number];

function parseVersion(v: string): V | null {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)] : null;
}

const cmp = (a: V, b: V) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

function comparator(token: string, v: V): boolean {
  const m = /^(>=|<=|>|<|=|\^|~)?\s*v?(\d+|x|\*)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?$/.exec(token.trim());
  if (!m) return false;
  const op = m[1] ?? '';
  const parts = [m[2], m[3], m[4]];
  const wild = parts.findIndex((p) => p === undefined || p === 'x' || p === '*');
  const nums = parts.map((p) => (p === undefined || p === 'x' || p === '*' ? 0 : Number(p))) as V;
  if (op === '' || op === '=') {
    if (wild === -1) return cmp(v, nums) === 0;
    for (let i = 0; i < wild; i++) if (v[i] !== nums[i]) return false;
    return true;
  }
  if (op === '^') {
    const upper: V = nums[0] > 0 ? [nums[0] + 1, 0, 0] : nums[1] > 0 ? [0, nums[1] + 1, 0] : [0, 0, nums[2] + 1];
    return cmp(v, nums) >= 0 && cmp(v, upper) < 0;
  }
  if (op === '~') return cmp(v, nums) >= 0 && cmp(v, [nums[0], nums[1] + 1, 0]) < 0;
  const c = cmp(v, nums);
  return op === '>=' ? c >= 0 : op === '<=' ? c <= 0 : op === '>' ? c > 0 : c < 0;
}

export function satisfies(version: string, range: string): boolean {
  const v = parseVersion(version);
  if (!v) return false;
  return range.split('||').some((set) => {
    const tokens = set.trim().replace(/(>=|<=|>|<|=|\^|~)\s+/g, '$1').split(/\s+/).filter(Boolean);
    return tokens.length > 0 && tokens.every((t) => comparator(t, v));
  });
}

export function validRange(range: string): boolean {
  return range
    .split('||')
    .every((set) => set.trim().replace(/(>=|<=|>|<|=|\^|~)\s+/g, '$1').split(/\s+/).filter(Boolean).every((t) => /^(>=|<=|>|<|=|\^|~)?\s*v?(\d+|x|\*)(\.(\d+|x|\*)){0,2}$/.test(t)));
}

/* ---------- resolution ---------- */

export function targetMatches(t: VariantTarget, c: ClientContext): boolean {
  if (t.platform && t.platform !== c.platform) return false;
  if (t.appVersion && !satisfies(c.appVersion, t.appVersion)) return false;
  if (t.experiment && c.experiments?.[t.experiment.name] !== t.experiment.arm) return false;
  return true;
}

export function describeTarget(t: VariantTarget): string {
  const parts = [t.platform ? ({ android: 'Android', ios: 'iOS', web: 'Web' } as const)[t.platform] : 'Any platform'];
  if (t.appVersion) parts.push(t.appVersion);
  if (t.experiment) parts.push(`${t.experiment.name}:${t.experiment.arm}`);
  return parts.join(' ');
}

export interface Resolution {
  variant: VariantInfo | null;
  reason: string;
}

/** First variant whose targets match wins; otherwise the fallback. */
export function resolveVariant(m: TemplateManifest, c: ClientContext): Resolution {
  for (const v of m.variants) {
    const hit = v.targets.find((t) => targetMatches(t, c));
    if (hit) return { variant: v, reason: `matches ${describeTarget(hit)}` };
  }
  const fb = m.variants.find((v) => v.fallback);
  if (fb) return { variant: fb, reason: 'no target matched; fallback variant' };
  return { variant: null, reason: 'no target matched and there is no fallback' };
}

/** Pairs of variants whose targets can both match the same client; the earlier one wins. */
export function shadowedTargets(m: TemplateManifest): string[] {
  const notes: string[] = [];
  m.variants.forEach((v, i) =>
    v.targets.forEach((t) => {
      for (const earlier of m.variants.slice(0, i))
        for (const e of earlier.targets)
          if ((!e.platform || e.platform === t.platform) && !e.appVersion && !e.experiment)
            notes.push(`${v.label}: "${describeTarget(t)}" is shadowed by ${earlier.label} ("${describeTarget(e)}")`);
    }),
  );
  return notes;
}

/* ---------- schema ---------- */

export interface SchemaIssue {
  path: string;
  message: string;
}

export function validateSample(schema: JsonSchema, data: unknown, path = ''): SchemaIssue[] {
  const at = path || '(root)';
  const out: SchemaIssue[] = [];
  const kind = Array.isArray(data) ? 'array' : data === null ? 'null' : typeof data;
  if (schema.type) {
    const ok =
      schema.type === kind ||
      (schema.type === 'integer' && typeof data === 'number' && Number.isInteger(data)) ||
      (schema.type === 'number' && typeof data === 'number');
    if (!ok) return [{ path: at, message: `expected ${schema.type}, got ${kind}` }];
  }
  if (schema.enum && !schema.enum.includes(data as never)) out.push({ path: at, message: `must be one of ${schema.enum.join(', ')}` });
  if (schema.type === 'object' && data && typeof data === 'object') {
    for (const r of schema.required ?? []) if (!(r in (data as object))) out.push({ path: path ? `${path}.${r}` : r, message: 'is required' });
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      const sub = schema.properties?.[k];
      if (sub) out.push(...validateSample(sub, v, path ? `${path}.${k}` : k));
      else out.push({ path: path ? `${path}.${k}` : k, message: 'is not in the schema' });
    }
  }
  if (schema.type === 'array' && Array.isArray(data) && schema.items) data.forEach((x, i) => out.push(...validateSample(schema.items!, x, `${path}[${i}]`)));
  return out;
}

/** Dotted paths the schema declares; array items use `[]`, e.g. "rooms[].name". */
export function schemaPaths(schema: JsonSchema, prefix = ''): string[] {
  const out: string[] = [];
  if (schema.type === 'object')
    for (const [k, v] of Object.entries(schema.properties ?? {})) {
      const p = prefix ? `${prefix}.${k}` : k;
      out.push(p, ...schemaPaths(v, p));
    }
  if (schema.type === 'array' && schema.items) out.push(...schemaPaths(schema.items, `${prefix}[]`));
  return out;
}

/** Props paths a compiled (bound) tree reads, in the same notation as `schemaPaths`. */
export function usedPaths(tree: unknown): string[] {
  const used = new Set<string>();
  const holes = /\{\{\s*([^{}]+?)\s*\}\}/g;
  const record = (p: string, each: string[]) => {
    if (p === '.') return;
    used.add(p.startsWith('.') ? `${each[each.length - 1] ?? ''}[]${p}` : p);
  };
  const visit = (v: unknown, each: string[], depth: number) => {
    if (depth > 64) return;
    if (typeof v === 'string') {
      for (const m of v.matchAll(holes)) record(m[1]!, each);
      return;
    }
    if (Array.isArray(v)) return v.forEach((x) => visit(x, each, depth + 1));
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    let scope = each;
    if (typeof o.$each === 'string') {
      const src = o.$each.startsWith('.') ? `${each[each.length - 1] ?? ''}[]${o.$each}` : o.$each;
      used.add(src);
      scope = [...each, src];
    }
    if (typeof o.$when === 'string') {
      const [left, right] = o.$when.replace(/^!/, '').split(/!=|=/);
      if (left) record(left.trim(), each);
      if (right && right.trim().startsWith('$')) record(right.trim().slice(1), each);
    }
    for (const [k, x] of Object.entries(o)) if (k !== '$each' && k !== '$when') visit(x, scope, depth + 1);
  };
  visit(tree, [], 0);
  return [...used].sort();
}

const IDENT = /^[A-Za-z_$][\w$]*$/;

/** The schema as a TypeScript interface, for reading. */
export function schemaToTs(schema: JsonSchema, name = 'Props'): string {
  const type = (s: JsonSchema, indent: string): string => {
    if (s.enum) return s.enum.map((e) => JSON.stringify(e)).join(' | ');
    switch (s.type) {
      case 'string':
        return 'string';
      case 'number':
      case 'integer':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'null':
        return 'null';
      case 'array':
        return `${s.items ? wrap(type(s.items, indent)) : 'unknown'}[]`;
      case 'object': {
        const req = new Set(s.required ?? []);
        const lines = Object.entries(s.properties ?? {}).map(([k, v]) => {
          const doc = v.description ? `${indent}  /** ${v.description} */\n` : '';
          return `${doc}${indent}  ${IDENT.test(k) ? k : JSON.stringify(k)}${req.has(k) ? '' : '?'}: ${type(v, indent + '  ')};`;
        });
        return lines.length ? `{\n${lines.join('\n')}\n${indent}}` : '{}';
      }
      default:
        return 'unknown';
    }
  };
  const wrap = (t: string) => (t.includes('|') ? `(${t})` : t);
  return `interface ${name} ${type(schema, '')}`;
}

/** A starting schema inferred from a sample. */
export function inferSchema(data: unknown): JsonSchema {
  if (Array.isArray(data)) return { type: 'array', items: data.length ? inferSchema(data[0]) : {} };
  if (data === null) return { type: 'null' };
  if (typeof data === 'object') {
    const props = Object.fromEntries(Object.entries(data as object).map(([k, v]) => [k, inferSchema(v)]));
    return { type: 'object', properties: props, required: Object.keys(props) };
  }
  if (typeof data === 'number') return { type: Number.isInteger(data) ? 'integer' : 'number' };
  if (typeof data === 'boolean') return { type: 'boolean' };
  return { type: 'string' };
}

/* ---------- LLM selection ---------- */

function fieldLines(schema: JsonSchema, prefix: string, indent: string): string[] {
  const req = new Set(schema.required ?? []);
  return Object.entries(schema.properties ?? {}).flatMap(([k, v]) => {
    const name = prefix ? `${prefix}.${k}` : k;
    const kind = v.enum ? `one of ${v.enum.map((e) => JSON.stringify(e)).join(', ')}` : v.type === 'array' ? `list of ${v.items?.type ?? 'items'}` : (v.type ?? 'any');
    const line = `${indent}- ${name} (${kind}${req.has(k) ? ', required' : ''})${v.description ? `: ${v.description}` : ''}`;
    const nested = v.type === 'object' ? fieldLines(v, name, indent + '  ') : v.type === 'array' && v.items?.type === 'object' ? fieldLines(v.items, `${name}[]`, indent + '  ') : [];
    return [line, ...nested];
  });
}

/** System prompt listing every template with its selection prompt and field prompts. */
export function selectionPrompt(templates: readonly TemplateManifest[]): string {
  const blocks = templates.map((t) => [`## ${t.id}: ${t.name}`, t.prompt.trim(), 'Props:', ...fieldLines(t.schema, '', '')].join('\n'));
  return [
    'Choose the one template that best presents the content, then extract its props from the content.',
    'Reply with {"templateId": ..., "props": ...}. Use only facts present in the content; omit optional props you cannot fill.',
    '',
    ...blocks.flatMap((b) => [b, '']),
  ]
    .join('\n')
    .trim();
}

/** Response schema: one branch per template, so the reply's props always match the chosen template. */
export function selectionSchema(templates: readonly TemplateManifest[]): JsonSchema {
  return {
    oneOf: templates.map((t) => ({
      type: 'object',
      description: t.prompt,
      properties: { templateId: { type: 'string', const: t.id }, props: t.schema },
      required: ['templateId', 'props'],
      additionalProperties: false,
    })),
  };
}
