import type { z } from 'zod';
import type { TrackingKey } from '../wire/tracking';

export interface EntrySlot {
  field: string;
  key: string;
}

export interface LenientEntries {
  field: string;
  entry: z.ZodType;
  shape: 'list' | 'record';
}

export interface InnerNodes {
  scope: string;
  visit(node: Record<string, unknown>, walk: (raw: unknown, path: string) => ViewNode | null): void;
}

export interface SlotSpec {
  list?: readonly string[];
  required?: readonly string[];
  whole?: readonly string[];
  paired?: Readonly<Record<string, string>>;
  node?: readonly string[];
  entry?: readonly EntrySlot[];
  grid?: readonly EntrySlot[];
  inert?: Readonly<Record<string, string>>;
}

export interface ViewNodeDefinition {
  type: string;
  schema: z.ZodType<Record<string, unknown>>;
  slots?: SlotSpec;
  tracking: readonly TrackingKey[] | 'single';
  lenientEntries?: readonly LenientEntries[];
  inner?: InnerNodes;
  drafts?: boolean;
  formScope?: boolean;
  formInput?: boolean;
  readsForm?: boolean;
  untouchableChildren?: string;
  spendScope?: boolean;
}

export interface ViewNode {
  type: string;
  id?: string;
  grow?: boolean;
  tracking?: unknown;
  [key: string]: unknown;
}

export type ViewNodeRegistry = ReadonlyMap<string, ViewNodeDefinition>;

export function createViewNodeRegistry(definitions: readonly ViewNodeDefinition[]): ViewNodeRegistry {
  const map = new Map<string, ViewNodeDefinition>();
  for (const d of definitions) {
    if (map.has(d.type)) throw new Error(`duplicate node type ${d.type}`);
    map.set(d.type, d);
  }
  return map;
}
