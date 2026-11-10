import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import type { ViewNode } from '../parse/registry';
import { useViewContext } from './context';

type Store = Map<string, unknown>;
const DraftStore = createContext<Store | null>(null);

export function ViewDraftsProvider({ children }: { children: ReactNode }) {
  const store = useRef<Store>(new Map()).current;
  return <DraftStore.Provider value={store}>{children}</DraftStore.Provider>;
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function draftNodeKey(node: ViewNode): string {
  return node.id ?? `${node.type}:${hash(JSON.stringify(node))}`;
}

export function useDraft<T>(node: ViewNode, slot: string, initial: T | (() => T)): [T, (next: T) => void] {
  const store = useContext(DraftStore);
  const { draftKey } = useViewContext();
  const key = draftKey !== undefined && store ? `${draftKey}|${draftNodeKey(node)}|${slot}` : null;
  const [local, setLocal] = useState<T>(() => {
    if (key !== null && store!.has(key)) return store!.get(key) as T;
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });
  const set = useCallback(
    (next: T) => {
      if (key !== null) store!.set(key, next);
      setLocal(next);
    },
    [key, store],
  );
  return [local, set];
}
