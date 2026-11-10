import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { ViewNode } from '../parse/registry';
import { ViewContextProvider, useViewContext } from './context';

const spentScopes = new Set<string>();

export function resetSpend(): void {
  spentScopes.clear();
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function scopeKey(place: string, node: ViewNode): string {
  return `${place}|${node.id ?? hash(JSON.stringify(node))}`;
}

export function SpendScope({ node, children }: { node: ViewNode; children: ReactNode }) {
  const ctx = useViewContext();
  const key = scopeKey(ctx.place, node);
  const [spent, setSpent] = useState(() => spentScopes.has(key));
  const spend = useCallback(() => {
    spentScopes.add(key);
    setSpent(true);
  }, [key]);
  const effective = ctx.spent || spent || !ctx.lastTurn;
  const value = useMemo(() => ({ ...ctx, spent: effective, spend }), [ctx, effective, spend]);
  return <ViewContextProvider value={value}>{children}</ViewContextProvider>;
}
