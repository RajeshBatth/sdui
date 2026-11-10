import { createContext, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import { hasOuterShadow, resolveToken, shadowCss, styledLook } from '../../manifest/resolve';
import type { Manifest, StyleSpec } from '../../manifest/types';
import type { ViewNode } from '../../parse/registry';
import { InertScope, useViewContext, type NodeViewProps } from '../../render/context';
import { ownNumber, StackLayout, type StackFields } from '../../render/layout';
import { GradientFill, usePress, ViewIcon } from '../../render/primitives';
import { ViewNodeRenderer } from '../../render/ViewNodeRenderer';
import { FrontContext } from '../../render/front';
import type { ViewAction } from '../../wire/actions';
import type { TrackingEvent } from '../../wire/tracking';
import { IndicatorView, PagerContext, type Pager } from './content';
import { DeckView } from './deck';
import { useWebDragScroll } from '../../render/dragScroll';

export interface CardMenus {
  register(id: string, open: () => void): () => void;
}
export const CardMenuContext = createContext<CardMenus | null>(null);


const CARD_STYLE: StyleSpec = { fill: 'color', gradient: 'gradient', stroke: 'stroke', shadow: 'shadow', radius: 'radius', padding: 'space', divider: 'stroke' };

function Gallery({ images, onIndex }: { images: { url: string; alt: string }[]; onIndex: (i: number) => void }) {
  const [width, setWidth] = useState(0);
  const ref = useRef<unknown>(null);
  useWebDragScroll(ref, { step: width, snap: true });
  return (
    <ScrollView
      ref={ref as never}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      scrollEventThrottle={16}
      onScroll={(e) => width > 0 && onIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
    >
      {images.map((img, i) => (
        <Image
          key={i}
          source={{ uri: img.url }}
          resizeMode="cover"
          style={{ width, height: '100%' }}
          alt={img.alt || undefined}
          aria-label={`Photo ${i + 1} of ${images.length}`}
        />
      ))}
    </ScrollView>
  );
}

export function CardView({ node, style }: NodeViewProps) {
  const ctx = useViewContext();
  const m = ctx.manifest;
  const hasAction = node.action !== undefined;
  const s = styledLook(m, {
    type: 'card',
    spec: CARD_STYLE,
    style: node.style,
    look: node.look,
    legacy: node.look === undefined ? node.surface : undefined,
    hue: node.hue,
    spent: ctx.spent,
    cardSpent: hasAction,
  });
  const press = usePress(node.action as ViewAction | undefined);
  const menus = useRef(new Map<string, () => void>());
  const menuCtx = useMemo<CardMenus>(
    () => ({
      register(id, open) {
        menus.current.set(id, open);
        return () => {
          if (menus.current.get(id) === open) menus.current.delete(id);
        };
      },
    }),
    [],
  );
  const [page, setPage] = useState(0);

  const bg = node.background as { images?: { url: string; alt: string }[]; gradient?: string; scrim?: { top?: string; bottom?: string } } | undefined;
  const radius = s.radius('radius', node.radius) ?? 0;
  const shadow = s.shadow('shadow');
  const stroke = s.stroke('stroke');
  const selected = node.selected === true ? m.stroke.selected : undefined;
  const gradient = s.gradient('gradient');
  const aspect = ownNumber(m, 'aspect', node.aspect);
  const lookPadding = s.space('padding');
  const clip = radius > 0 && !hasOuterShadow(shadow);
  const pager: Pager | null = bg?.images && bg.images.length > 1 ? { index: page, count: bg.images.length, noun: 'Photo' } : null;

  const box: ViewStyle = {
    borderRadius: radius,
    backgroundColor: s.color('fill'),
    ...(shadow ? { boxShadow: shadowCss(shadow) } : {}),
    ...(stroke ? { borderWidth: stroke.width, borderColor: stroke.color } : {}),
    ...(selected ? { borderWidth: selected.width, borderColor: selected.color } : {}),
    ...(clip ? { overflow: 'hidden' } : {}),
    ...(aspect !== undefined ? { aspectRatio: aspect, alignSelf: 'stretch' } : {}),
  };
  const layers: ReactNode = (
    <>
      {bg?.images?.length === 1 ? (
        <Image source={{ uri: bg.images[0]!.url }} resizeMode="cover" style={StyleSheet.absoluteFill} alt={bg.images[0]!.alt || undefined} />
      ) : null}
      {bg?.images && bg.images.length > 1 ? <Gallery images={bg.images} onIndex={(i) => setPage(Math.max(0, Math.min(i, bg.images!.length - 1)))} /> : null}
      {gradient ? <GradientFill gradient={gradient} /> : null}
      {bg?.gradient && resolveToken(m, 'gradient', bg.gradient) ? <GradientFill gradient={resolveToken(m, 'gradient', bg.gradient)!} /> : null}
      {bg?.scrim?.top && resolveToken(m, 'gradient', bg.scrim.top) ? (
        <GradientFill gradient={resolveToken(m, 'gradient', bg.scrim.top)!} style={{ bottom: '50%' }} />
      ) : null}
      {bg?.scrim?.bottom && resolveToken(m, 'gradient', bg.scrim.bottom) ? (
        <GradientFill gradient={resolveToken(m, 'gradient', bg.scrim.bottom)!} style={{ top: '50%' }} />
      ) : null}
    </>
  );
  const body = (
    <StackLayout
      node={node as StackFields}
      style={[{ flexGrow: aspect !== undefined ? 1 : undefined }, node.padding === undefined && lookPadding !== undefined ? { padding: lookPadding } : {}] as never}
      before={null}
      dividerStroke={s.stroke('divider')}
    />
  );
  const longPress = typeof node.longPress === 'string' ? node.longPress : undefined;
  const pressable = press.onPress !== undefined || longPress !== undefined;
  const content = (
    <CardMenuContext.Provider value={menuCtx}>
      <PagerContext.Provider value={pager}>
        {layers}
        {body}
      </PagerContext.Provider>
    </CardMenuContext.Provider>
  );
  if (!pressable) {
    if (Platform.OS === 'android' && hasOuterShadow(shadow)) {
      return (
        <View style={[{ borderRadius: radius, boxShadow: shadowCss(shadow!) }, style]}>
          <View style={[box, { boxShadow: undefined }]}>{content}</View>
        </View>
      );
    }
    return <View style={[box, style]}>{content}</View>;
  }
  return (
    <Pressable
      role={press.onPress ? 'button' : undefined}
      onPress={press.onPress}
      onLongPress={longPress && !ctx.inert ? () => menus.current.get(longPress)?.() : undefined}
      disabled={!press.onPress && !longPress}
      style={[box, style]}
    >
      {content}
    </Pressable>
  );
}

type ItemWidth = string | number | { max: string | number; peek?: string | number } | undefined;

function useItemWidth(m: Manifest, itemWidth: ItemWidth, rowWidth: number): number {
  const fallback = m.size.itemMd ?? 220;
  if (itemWidth === 'fill') return rowWidth;
  if (typeof itemWidth === 'object') {
    const max = ownNumber(m, 'size', itemWidth.max) ?? fallback;
    const peek = itemWidth.peek !== undefined ? (ownNumber(m, 'space', itemWidth.peek) ?? 0) : (m.space.carouselPeek ?? 0);
    return Math.max(0, Math.min(max, rowWidth - 2 * peek));
  }
  if (itemWidth === 'sm' || itemWidth === 'md' || itemWidth === 'lg') {
    return m.size[`item${itemWidth.toUpperCase()[0]}${itemWidth.slice(1)}`] ?? fallback;
  }
  return ownNumber(m, 'size', itemWidth) ?? fallback;
}

function useRow(node: ViewNode) {
  const ctx = useViewContext();
  const m = ctx.manifest;
  const window = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  const gutter = node.bleed === false ? 0 : (m.space.gutter ?? 0);
  const rowWidth = (measured || window.width) - 2 * gutter;
  const width = useItemWidth(m, node.itemWidth as ItemWidth, measured ? measured : window.width - 2 * gutter);
  const gap = ownNumber(m, 'space', node.gap) ?? 0;
  const onLayout = (e: LayoutChangeEvent) => setMeasured(e.nativeEvent.layout.width);
  return { ctx, width, gap, gutter, rowWidth, onLayout, stretch: node.align !== 'start' };
}

function selectEvent(event: TrackingEvent | undefined, child: ViewNode | undefined, index: number): TrackingEvent | undefined {
  if (!event) return undefined;
  return { ...event, props: { ...event.props, ...(child?.id ? { id: child.id } : {}), index } };
}

function RowScroller({
  node,
  style,
  snap,
  renderItem,
  onPage,
}: {
  node: ViewNode;
  style: NodeViewProps['style'];
  snap: boolean;
  renderItem?: (child: ViewNode, i: number, el: ReactNode) => ReactNode;
  onPage?: (i: number) => void;
}) {
  const { ctx, width, gap, gutter, onLayout, stretch } = useRow(node);
  const children = (node.children as ViewNode[]) ?? [];
  const lastSelect = useRef(0);
  const dragging = useRef(false);
  const onSelect = (node.tracking as { onSelect?: TrackingEvent } | undefined)?.onSelect;
  const scroller = useRef<unknown>(null);
  useWebDragScroll(scroller, { step: width + gap, snap });
  const web = Platform.OS === 'web';
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const step = width + gap;
      const page = Math.max(0, Math.min(children.length - 1, Math.round(x / step)));
      const firstHalf = Math.max(0, Math.min(children.length - 1, Math.ceil((x - width / 2) / step)));
      const selected = snap ? page : firstHalf;
      onPage?.(page);
      if (selected !== lastSelect.current) {
        lastSelect.current = selected;
        if (dragging.current || web) {
          const ev = selectEvent(onSelect, children[selected], selected);
          if (ev) ctx.onTrack(ev);
        }
      }
    },
    [width, gap, children, snap, onPage, onSelect, ctx, web],
  );
  return (
    <ScrollView
      ref={scroller as never}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={onLayout}
      scrollEventThrottle={16}
      onScrollBeginDrag={() => (dragging.current = true)}
      onMomentumScrollEnd={() => (dragging.current = false)}
      onScroll={onScroll}
      snapToInterval={snap ? width + gap : undefined}
      decelerationRate={snap ? 'fast' : 'normal'}
      disableIntervalMomentum={snap}
      role={Platform.OS === 'web' ? (snap ? 'region' : 'list') : undefined}
      style={[gutter ? { marginHorizontal: -gutter } : null, snap && web ? ({ scrollSnapType: 'x mandatory', scrollPaddingLeft: gutter } as object) : null, style]}
      contentContainerStyle={{ gap, paddingHorizontal: gutter, alignItems: stretch ? 'stretch' : 'flex-start' }}
    >
      {children.map((child, i) => {
        const el = <ViewNodeRenderer node={child} style={stretch ? { flexGrow: 1 } : undefined} />;
        return (
          <View
            key={child.id ?? i}
            style={{ width, ...(snap && Platform.OS === 'web' ? ({ scrollSnapAlign: 'start' } as object) : {}) }}
            role={Platform.OS === 'web' ? (snap ? 'group' : 'listitem') : undefined}
            aria-label={snap ? `${i + 1} of ${children.length}` : undefined}
          >
            {renderItem ? renderItem(child, i, el) : el}
          </View>
        );
      })}
    </ScrollView>
  );
}

export function ScrollRowView({ node, style }: NodeViewProps) {
  return <RowScroller node={node} style={style} snap={false} />;
}

const CAROUSEL_STYLE: StyleSpec = { stackOffset: 'space', stackScale: 'opacity', stackDepth: { keyword: ['1', '2', '3'] } };

export function CarouselView({ node, style }: NodeViewProps) {
  const { manifest } = useViewContext();
  const s = styledLook(manifest, { type: 'carousel', spec: CAROUSEL_STYLE, style: node.style, look: node.look });
  if (s.raw('stackOffset') !== undefined) return <DeckView node={node} style={style} s={s} />;
  return <FlatCarousel node={node} style={style} />;
}

function FlatCarousel({ node, style }: NodeViewProps) {
  const [page, setPage] = useState(0);
  const count = ((node.children as ViewNode[]) ?? []).length;
  const index = Math.min(page, Math.max(0, count - 1));
  const front = node.front as string | undefined;
  const pager: Pager = { index, count, noun: null };
  return (
    <View style={style}>
      <RowScroller
        node={node}
        style={undefined}
        snap
        onPage={setPage}
        renderItem={(_, i, el) =>
          front ? <FrontContext.Provider value={{ frontId: front, isFront: i === index }}>{el}</FrontContext.Provider> : el
        }
      />
      {node.dots !== undefined ? (
        <PagerContext.Provider value={pager}>
          <IndicatorView node={{ type: 'indicator', look: node.dots }} />
        </PagerContext.Provider>
      ) : null}
    </View>
  );
}

const CONTAINERS = new Set(['stack', 'card', 'grid', 'overlay']);

export function GridView({ node, style }: NodeViewProps) {
  const { manifest: m } = useViewContext();
  const columns = node.columns as number;
  const children = (node.children as ViewNode[]) ?? [];
  const gap = ownNumber(m, 'space', node.gap) ?? 0;
  const rowGap = node.rowGap !== undefined ? (ownNumber(m, 'space', node.rowGap) ?? gap) : gap;
  const align = (node.align as string | undefined) ?? 'stretch';
  const rows: (ViewNode | null)[][] = [];
  for (let i = 0; i < children.length; i += columns) {
    const row: (ViewNode | null)[] = children.slice(i, i + columns);
    while (row.length < columns) row.push(null);
    rows.push(row);
  }
  const cellJustify = align === 'center' ? 'center' : align === 'end' ? 'flex-end' : 'flex-start';
  return (
    <View style={[{ gap: rowGap }, style]}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap, alignItems: 'stretch' }}>
          {row.map((child, c) => (
            <View key={c} style={{ flex: 1, flexBasis: 0, justifyContent: cellJustify }}>
              {child ? (
                <ViewNodeRenderer node={child} style={align === 'stretch' && CONTAINERS.has(child.type) ? { flexGrow: 1 } : undefined} />
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const FILL: ViewStyle = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 };

function layerStyle(m: Manifest, anchor: string, inset: unknown): ViewStyle {
  const x = typeof inset === 'string' ? resolveToken(m, 'space', inset) : ownNumber(m, 'space', (inset as { x?: string } | undefined)?.x);
  const y = typeof inset === 'string' ? resolveToken(m, 'space', inset) : ownNumber(m, 'space', (inset as { y?: string } | undefined)?.y);
  const ix = x ?? 0;
  const iy = y ?? 0;
  switch (anchor) {
    case 'top-start':
      return { position: 'absolute', top: iy, left: ix };
    case 'top-end':
      return { position: 'absolute', top: iy, right: ix };
    case 'bottom-start':
      return { position: 'absolute', bottom: iy, left: ix };
    case 'bottom-end':
      return { position: 'absolute', bottom: iy, right: ix };
    case 'top':
      return { position: 'absolute', top: iy, left: 0, right: 0, alignItems: 'center' };
    case 'bottom':
      return { position: 'absolute', bottom: iy, left: 0, right: 0, alignItems: 'center' };
    case 'center':
      return { ...FILL, alignItems: 'center', justifyContent: 'center' };
    default:
      return { ...FILL, padding: undefined, paddingHorizontal: ix, paddingVertical: iy };
  }
}

export function OverlayView({ node, style }: NodeViewProps) {
  const { manifest: m } = useViewContext();
  const base = node.base as ViewNode;
  const layers = node.layers as { anchor: string; inset?: unknown; node: ViewNode }[];
  const androidCard = Platform.OS === 'android' && base.type === 'card';
  return (
    <View style={style}>
      <ViewNodeRenderer node={base} />
      <InertScope>
        {layers.map((l, i) => (
          <View
            key={i}
            pointerEvents="none"
            style={[layerStyle(m, l.anchor, l.inset), androidCard ? { elevation: 24 } : { zIndex: i + 1 }]}
          >
            <ViewNodeRenderer node={l.node} style={l.anchor === 'fill' ? { flex: 1 } : undefined} />
          </View>
        ))}
      </InertScope>
    </View>
  );
}

const RATING_STYLE: StyleSpec = {
  stars: { keyword: ['none', 'one', 'five'] },
  star: 'icon',
  starSize: 'size',
  starTone: 'color',
  emptyTone: 'color',
  text: 'text',
  wordText: 'text',
  countText: 'text',
  tone: 'color',
  wordTone: 'color',
  countTone: 'color',
  scoreFill: 'color',
  scoreRadius: 'radius',
  scorePadding: 'space',
  fill: 'color',
  radius: 'radius',
  paddingX: 'space',
  paddingY: 'space',
  gap: 'space',
  width: 'size',
  height: 'size',
};

function Star({ name, size, fill, tone, empty }: { name: string; size: number | undefined; fill: number; tone?: string; empty?: string }) {
  const side = size ?? 16;
  if (fill >= 1) return <ViewIcon name={name} size={side} tone={tone} />;
  return (
    <View style={{ width: side, height: side }}>
      {empty ? <ViewIcon name={name} size={side} tone={empty} style={StyleSheet.absoluteFill} /> : null}
      {fill > 0 ? (
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: side * fill, overflow: 'hidden' }}>
          <ViewIcon name={name} size={side} tone={tone} />
        </View>
      ) : null}
    </View>
  );
}

export function RatingView({ node, style }: NodeViewProps) {
  const { manifest: m } = useViewContext();
  const s = styledLook(m, { type: 'rating', spec: RATING_STYLE, style: node.style, look: node.look, legacy: node.variant, hue: node.hue, defaultLook: 'inline' });
  const value = node.value as number;
  const score = value.toFixed(1);
  const stars = s.keyword<'none' | 'one' | 'five'>('stars') ?? 'none';
  const star = s.icon('star') ?? 'star';
  const starSize = s.size('starSize');
  const starTone = s.color('starTone');
  const emptyTone = s.color('emptyTone');
  const scoreFill = s.color('scoreFill');
  const word = node.word as string | undefined;
  const count = node.countLabel as string | undefined;
  const label = ['Rated ' + score + ' of 5', word, count].filter(Boolean).join(', ');
  return (
    <View
      accessible
      aria-label={label}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: s.space('gap'),
          backgroundColor: s.color('fill'),
          borderRadius: s.radius('radius'),
          paddingHorizontal: s.space('paddingX'),
          paddingVertical: s.space('paddingY'),
          width: s.size('width'),
          height: s.size('height'),
        },
        style,
      ]}
    >
      {stars === 'one' ? <Star name={star} size={starSize} fill={1} tone={starTone} /> : null}
      <View style={scoreFill ? { backgroundColor: scoreFill, borderRadius: s.radius('scoreRadius'), paddingHorizontal: s.space('scorePadding') } : null}>
        <Text style={[s.text('text') ?? null, { color: s.color('tone') }]}>{score}</Text>
      </View>
      {stars === 'five' ? (
        <View style={{ flexDirection: 'row', gap: 2 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} name={star} size={starSize} fill={Math.max(0, Math.min(1, value - i))} tone={starTone} empty={emptyTone} />
          ))}
        </View>
      ) : null}
      {word ? <Text style={[s.text('wordText') ?? null, { color: s.color('wordTone') }]}>{word}</Text> : null}
      {count ? <Text style={[s.text('countText') ?? null, { color: s.color('countTone') }]}>{count}</Text> : null}
    </View>
  );
}

export const layoutViews = {
  card: CardView,
  'scroll-row': ScrollRowView,
  carousel: CarouselView,
  grid: GridView,
  overlay: OverlayView,
  rating: RatingView,
};
