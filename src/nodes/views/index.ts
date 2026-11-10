import type { ComponentType } from 'react';
import type { NodeViewProps, RenderEntry, RenderRegistry } from '../../render/context';
import { NODE_DEFINITIONS } from '../schemas';
import { contentViews } from './content';
import { foundationViews } from './foundation';
import { interactiveViews } from './interactive';
import { layoutViews } from './layout';
import { structuredViews } from './structured';
import { chartViews } from './charts';
import { formViews } from './forms';

export const NODE_VIEWS: Record<string, ComponentType<NodeViewProps>> = {
  ...foundationViews,
  ...contentViews,
  ...layoutViews,
  ...interactiveViews,
  ...structuredViews,
  ...formViews,
  ...chartViews,
};

export function createRenderRegistry(views: Record<string, ComponentType<NodeViewProps>> = NODE_VIEWS): RenderRegistry {
  const map = new Map<string, RenderEntry>();
  for (const definition of NODE_DEFINITIONS) {
    const View = views[definition.type];
    if (View) map.set(definition.type, { definition, View });
  }
  return map;
}
