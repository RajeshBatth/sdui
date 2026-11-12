import { createContext, useContext, type ComponentType, type ReactElement, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { Manifest } from '../manifest/types';
import type { ViewNode, ViewNodeDefinition } from '../parse/registry';
import type { ViewAction } from '../wire/actions';
import type { TrackingEvent } from '../wire/tracking';

export interface NodeViewProps<N extends ViewNode = ViewNode> {
  node: N;
  style?: StyleProp<ViewStyle>;
}

export interface RenderEntry {
  definition: ViewNodeDefinition;
  View: ComponentType<NodeViewProps>;
}
export type RenderRegistry = ReadonlyMap<string, RenderEntry>;

export interface FormSubmission {
  id?: string;
  values: Record<string, unknown>;
}

export type ActionResult = void | Promise<boolean>;
export type ActionHandler = (action: ViewAction, form?: FormSubmission) => ActionResult;

export interface ViewContextValue {
  registry: RenderRegistry;
  onAction: ActionHandler;
  onTrack: (event: TrackingEvent) => void;
  available: (action: ViewAction) => boolean;
  manifest: Manifest;
  inert: boolean;
  interactive: boolean;
  lastTurn: boolean;
  arrivedLive: boolean;
  spent: boolean;
  spend?: () => void;
  place: string;
  draftKey?: string;
  sessionKey: string;
  onShown?: (key: string, event: TrackingEvent) => void;
  renderMarkdown?: ComponentType<MarkdownRendererProps>;
  nodeWrapper?: (node: ViewNode, el: ReactElement) => ReactNode;
}

export interface MarkdownRendererProps {
  value: string;
  style?: StyleProp<ViewStyle>;
  onLink: (url: string) => void;
}

const ViewContext = createContext<ViewContextValue | null>(null);

export function ViewContextProvider({ value, children }: { value: ViewContextValue; children: ReactNode }) {
  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}

export function useViewContext(): ViewContextValue {
  const v = useContext(ViewContext);
  if (!v) throw new Error('useViewContext outside ViewContextProvider');
  return v;
}

const INERT_HANDLER: ActionHandler = () => undefined;

export function InertScope({ children }: { children: ReactNode }) {
  const ctx = useViewContext();
  if (ctx.inert) return <>{children}</>;
  return <ViewContextProvider value={{ ...ctx, inert: true, onAction: INERT_HANDLER }}>{children}</ViewContextProvider>;
}
