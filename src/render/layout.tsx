import { Fragment, type ReactNode } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { resolveToken, textStyleOf } from '../manifest/resolve';
import type { Manifest, StrokeToken } from '../manifest/types';
import type { ViewNode } from '../parse/registry';
import { useViewContext } from './context';
import { useDraft } from './drafts';
import type { ViewNode as Node } from '../parse/registry';
import { ViewNodeRenderer } from './ViewNodeRenderer';

export function ownNumber(m: Manifest, scale: 'space' | 'size' | 'radius' | 'aspect', v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  return resolveToken(m, scale, v);
}

export function paddingStyle(m: Manifest, p: unknown): ViewStyle {
  if (p === undefined) return {};
  if (typeof p === 'number' || typeof p === 'string') {
    const v = ownNumber(m, 'space', p);
    return v === undefined ? {} : { padding: v };
  }
  const o = p as Record<string, unknown>;
  if ('x' in o || 'y' in o) {
    return { paddingHorizontal: ownNumber(m, 'space', o.x), paddingVertical: ownNumber(m, 'space', o.y) };
  }
  return {
    paddingTop: ownNumber(m, 'space', o.top),
    paddingRight: ownNumber(m, 'space', o.right),
    paddingBottom: ownNumber(m, 'space', o.bottom),
    paddingLeft: ownNumber(m, 'space', o.left),
  };
}

const JUSTIFY: Record<string, ViewStyle['justifyContent']> = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between' };
export const ALIGN: Record<string, ViewStyle['alignItems']> = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' };

export interface StackFields {
  direction?: 'vertical' | 'horizontal';
  justify?: string;
  align?: string;
  gap?: unknown;
  overlap?: unknown;
  overlapOrder?: 'earlier' | 'later';
  dividers?: boolean;
  dividerInset?: unknown;
  padding?: unknown;
  width?: unknown;
  minHeight?: unknown;
  wrap?: boolean;
  collapseAfter?: number;
  collapseLabel?: { more?: string; less?: string };
  children?: ViewNode[];
}

export function stackBoxStyle(m: Manifest, n: StackFields): ViewStyle {
  const horizontal = n.direction === 'horizontal';
  const dividersOrOverlap = n.dividers || (n.overlap !== undefined && !n.wrap);
  const width = n.width === 'fill' ? '100%' : ownNumber(m, 'size', n.width);
  return {
    flexDirection: horizontal ? 'row' : 'column',
    ...(n.justify ? { justifyContent: JUSTIFY[n.justify] } : {}),
    ...(n.align ? { alignItems: ALIGN[n.align] } : {}),
    ...(n.wrap ? { flexWrap: 'wrap' } : {}),
    ...(dividersOrOverlap ? {} : { gap: ownNumber(m, 'space', n.gap) }),
    ...paddingStyle(m, n.padding),
    ...(width !== undefined ? { width } : {}),
    ...(n.minHeight !== undefined ? { minHeight: ownNumber(m, 'size', n.minHeight) } : {}),
  };
}


function CollapseToggle({ open, hidden, labels, onToggle }: { open: boolean; hidden: number; labels?: StackFields['collapseLabel']; onToggle: () => void }) {
  const { manifest } = useViewContext();
  const text = resolveToken(manifest, 'text', 'bodyStrong');
  const label = open ? (labels?.less ?? 'Show less') : (labels?.more ?? `Show ${hidden} more`).replace('{n}', String(hidden));
  return (
    <Pressable role="button" aria-expanded={open} onPress={onToggle} hitSlop={8}>
      <Text style={[text ? textStyleOf(text, manifest.font) : null, { color: manifest.color.accent }]}>{label}</Text>
    </Pressable>
  );
}

export function StackLayout({
  node,
  style,
  before,
  wrapChild,
  dividerStroke,
}: {
  node: StackFields;
  style?: ViewStyle | ViewStyle[];
  before?: ReactNode;
  wrapChild?: (child: Node, index: number, el: ReactNode) => ReactNode;
  dividerStroke?: StrokeToken;
}) {
  const ctx = useViewContext();
  const m = ctx.manifest;
  const [open, setOpen] = useDraft(node as unknown as Node, 'collapse', false);
  const children = node.children ?? [];
  const horizontal = node.direction === 'horizontal';
  const limit = !ctx.inert && node.collapseAfter !== undefined ? node.collapseAfter : undefined;
  const hidden = limit !== undefined ? Math.max(0, children.length - limit) : 0;
  const shown = hidden > 0 && !open ? children.slice(0, limit) : children;

  const divider = node.dividers ? (dividerStroke ?? m.stroke.divider) : undefined;
  const gap = ownNumber(m, 'space', node.gap) ?? 0;
  const overlap = node.overlap !== undefined && !node.wrap && !node.dividers ? (ownNumber(m, 'space', node.overlap) ?? 0) : undefined;
  const inset = ownNumber(m, 'space', node.dividerInset) ?? 0;

  return (
    <View style={[stackBoxStyle(m, node), style]}>
      {before}
      {shown.map((child, i) => {
        let childStyle: ViewStyle | undefined;
        if (overlap !== undefined && i > 0) {
          childStyle = { [horizontal ? 'marginLeft' : 'marginTop']: -overlap, zIndex: node.overlapOrder === 'earlier' ? shown.length - i : i };
        } else if (overlap !== undefined) {
          childStyle = { zIndex: node.overlapOrder === 'earlier' ? shown.length : 0 };
        }
        return (
          <Fragment key={child.id ?? i}>
            {divider && i > 0 ? (
              <View
                style={
                  horizontal
                    ? { width: divider.width, backgroundColor: divider.color, marginHorizontal: gap, marginVertical: inset, alignSelf: 'stretch' }
                    : { height: divider.width, backgroundColor: divider.color, marginVertical: gap, marginHorizontal: inset }
                }
              />
            ) : null}
            {wrapChild ? wrapChild(child, i, <ViewNodeRenderer node={child} style={childStyle} />) : <ViewNodeRenderer node={child} style={childStyle} />}
          </Fragment>
        );
      })}
      {hidden > 0 ? <CollapseToggle open={open} hidden={hidden} labels={node.collapseLabel} onToggle={() => setOpen(!open)} /> : null}
    </View>
  );
}
