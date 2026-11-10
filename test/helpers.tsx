import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { parseView, viewNodeRegistry } from '../src';
import { SNAPSHOT_MANIFEST } from '../src/manifest/snapshot';
import { createRenderRegistry } from '../src/nodes/views';
import { ViewRenderer, type ViewRendererProps } from '../src/render/ViewRenderer';

export const renderRegistry = createRenderRegistry();

export function renderView(raw: unknown, props: Partial<ViewRendererProps> = {}) {
  const parsed = parseView(viewNodeRegistry, raw);
  if (!parsed.root) throw new Error(`did not parse: ${JSON.stringify(parsed.issues)}`);
  const onAction = props.onAction ?? vi.fn();
  const onTrack = props.onTrack ?? vi.fn();
  const utils = render(
    <ViewRenderer root={parsed.root} registry={renderRegistry} manifest={SNAPSHOT_MANIFEST} place="test" {...props} onAction={onAction} onTrack={onTrack} />,
  );
  return { ...utils, onAction, onTrack, issues: parsed.issues };
}
