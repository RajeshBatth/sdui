import { useMemo } from 'react';
import type { Manifest } from '../manifest/types';
import type { ViewNode } from '../parse/registry';
import type { TrackingEvent } from '../wire/tracking';
import type { ViewAction } from '../wire/actions';
import { ViewContextProvider, type ActionHandler, type RenderRegistry, type ViewContextValue } from './context';
import { ViewNodeRenderer } from './ViewNodeRenderer';

export interface ViewRendererProps {
  root: ViewNode;
  registry: RenderRegistry;
  manifest: Manifest;
  onAction: ActionHandler;
  onTrack: (event: TrackingEvent) => void;
  available?: (action: ViewAction) => boolean;
  interactive?: boolean;
  lastTurn?: boolean;
  arrivedLive?: boolean;
  place: string;
  draftKey?: string;
  sessionKey?: string;
  onShown?: ViewContextValue['onShown'];
  renderMarkdown?: ViewContextValue['renderMarkdown'];
}

const ALL_AVAILABLE = () => true;

export function ViewRenderer(p: ViewRendererProps) {
  const value = useMemo<ViewContextValue>(
    () => ({
      registry: p.registry,
      onAction: p.onAction,
      onTrack: p.onTrack,
      available: p.available ?? ALL_AVAILABLE,
      manifest: p.manifest,
      inert: false,
      interactive: p.interactive ?? true,
      lastTurn: p.lastTurn ?? true,
      arrivedLive: p.arrivedLive ?? false,
      spent: false,
      place: p.place,
      draftKey: p.draftKey,
      sessionKey: p.sessionKey ?? p.place,
      onShown: p.onShown,
      renderMarkdown: p.renderMarkdown,
    }),
    [p.registry, p.onAction, p.onTrack, p.available, p.manifest, p.interactive, p.lastTurn, p.arrivedLive, p.place, p.draftKey, p.sessionKey, p.onShown, p.renderMarkdown],
  );
  return (
    <ViewContextProvider value={value}>
      <ViewNodeRenderer node={p.root} />
    </ViewContextProvider>
  );
}
