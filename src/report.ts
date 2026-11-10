export type ViewCount =
  | { kind: 'fallback'; card: string; path: string; type: string }
  | { kind: 'softLimit'; card: string; dimension: 'nodes' | 'depth'; value: number; limit: number }
  | { kind: 'unknownToken'; scale: string; name: string }
  | { kind: 'styleLiteral'; node: string; field: string; bucket: number }
  | { kind: 'styleRejected'; node: string; field: string }
  | { kind: 'manifestFailed'; reason: string }
  | { kind: 'manifestLate'; url: string };

export interface SchemaFailure {
  card: string;
  path: string;
  reason: string;
  detail?: string;
  payload?: unknown;
}

export interface ReportSink {
  count(c: ViewCount): void;
  schemaFailure(f: SchemaFailure): void;
}

let sink: ReportSink | null = null;
const seen = new Set<string>();

export function setReportSink(next: ReportSink | null): void {
  sink = next;
}

function once(key: string): boolean {
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}

function countKey(c: ViewCount): string | null {
  switch (c.kind) {
    case 'fallback':
      return `fb|${c.card}|${c.path}`;
    case 'softLimit':
      return `soft|${c.card}|${c.dimension}`;
    case 'unknownToken':
      return `tok|${c.scale}|${c.name}`;
    case 'styleLiteral':
      return `lit|${c.node}|${c.field}`;
    case 'styleRejected':
      return `rej|${c.node}|${c.field}`;
    case 'manifestLate':
      return `late|${c.url}`;
    case 'manifestFailed':
      return null;
  }
}

export function reportCount(c: ViewCount): void {
  const key = countKey(c);
  if (key !== null && !once(key)) return;
  sink?.count(c);
}

export function reportSchemaFailure(f: SchemaFailure, keyed = true): void {
  if (keyed) {
    if (!once(`sf|${f.card}|${f.path}|${f.reason}`)) return;
    if (f.payload !== undefined && !once(`payload|${f.card}`)) f = { ...f, payload: undefined };
  }
  sink?.schemaFailure(f);
}

export function resetViewReporting(): void {
  seen.clear();
}
