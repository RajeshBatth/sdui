import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { shadowCss, styledLook } from '../../manifest/resolve';
import type { GradientToken, StyleSpec } from '../../manifest/types';
import type { ViewNode } from '../../parse/registry';
import { useViewContext, type NodeViewProps } from '../../render/context';
import { GradientFill, usePress, ViewIcon } from '../../render/primitives';
import type { ViewAction } from '../../wire/actions';
import type { TrackingEvent } from '../../wire/tracking';

const played = new Set<string>();

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((r) => live && setReduced(r));
    return () => {
      live = false;
    };
  }, []);
  return reduced;
}

function useEntrance(node: ViewNode, durationMs: number): Animated.Value {
  const ctx = useViewContext();
  const reduced = useReducedMotion();
  const key = `${ctx.draftKey ?? ctx.place}|${node.type}|${node.id ?? ''}`;
  const run = ctx.arrivedLive && !reduced && !played.has(key);
  const progress = useRef(new Animated.Value(run ? 0 : 1)).current;
  useEffect(() => {
    if (!run) return;
    played.add(key);
    Animated.timing(progress, { toValue: 1, duration: durationMs, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [run, key, progress, durationMs]);
  return progress;
}

function useInspect(node: ViewNode) {
  const ctx = useViewContext();
  const seen = useRef(new Set<number>());
  const event = (node.tracking as { onInspect?: TrackingEvent } | undefined)?.onInspect;
  return (index: number, label: string) => {
    if (!event || seen.current.has(index)) return;
    seen.current.add(index);
    ctx.onTrack({ ...event, props: { ...event.props, index, label } });
  };
}

const BARS_STYLE: StyleSpec = {
  fill: 'color',
  activeGradient: 'gradient',
  barWidth: 'size',
  height: 'size',
  gap: 'space',
  radius: 'radius',
  valueText: 'text',
  valueTone: 'color',
  activeValueText: 'text',
  activeValueTone: 'color',
  labelText: 'text',
  labelTone: 'color',
  activeLabelText: 'text',
  activeLabelTone: 'color',
  baseline: 'stroke',
  badgeFill: 'color',
  badgeStroke: 'stroke',
  badgeText: 'text',
  badgeTone: 'color',
  badgeRadius: 'radius',
};

interface Bar {
  value: number;
  valueLabel: string;
  label: string;
  action?: ViewAction;
}

function paletteColors(m: ReturnType<typeof useViewContext>['manifest'], palette: unknown): string[] | null {
  if (palette === undefined) return null;
  const names = typeof palette === 'string' ? (m.palette[palette] ?? m.palette.default ?? []) : (palette as string[]);
  const colors = names.map((n) => m.color[n]).filter((c): c is string => c !== undefined);
  return colors.length >= 2 ? colors : (m.palette.default ?? []).map((n) => m.color[n]!).filter(Boolean);
}

function BarColumn({
  bar,
  index,
  height,
  max,
  width,
  highlighted,
  selected,
  badge,
  color,
  gradient,
  s,
  progress,
  onHighlight,
  inert,
  valueRow,
  labelWidth,
}: {
  valueRow: number;
  labelWidth: number;
  bar: Bar;
  index: number;
  height: number;
  max: number;
  width: number;
  highlighted: boolean;
  selected: boolean;
  badge?: string;
  color?: string;
  gradient?: GradientToken;
  s: ReturnType<typeof styledLook>;
  progress: Animated.Value;
  onHighlight: (i: number) => void;
  inert: boolean;
}) {
  const press = usePress(bar.action);
  const h = Math.round((height * bar.value) / max);
  const radius = s.radius('radius') ?? 4;
  const badgeStroke = s.stroke('badgeStroke');
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.01, 1] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [h * 0.495, 0] });
  const onPress = () => {
    if (inert) return;
    if (!highlighted) onHighlight(index);
    else press.onPress?.();
  };
  const hover = Platform.OS === 'web' ? { onHoverIn: () => !inert && onHighlight(index) } : {};
  return (
    <Pressable
      role="button"
      aria-label={[bar.label, bar.valueLabel, selected ? badge : undefined].filter(Boolean).join(', ')}
      disabled={inert}
      onPress={onPress}
      {...hover}
      style={{ width, alignItems: 'center' }}
    >
      <View style={{ height: valueRow + 4 + height, width, alignItems: 'center', justifyContent: 'flex-end' }}>
        <Text numberOfLines={1} style={[(highlighted ? s.text('activeValueText') : s.text('valueText')) ?? null, { color: highlighted ? s.color('activeValueTone') : s.color('valueTone'), width: labelWidth, minWidth: labelWidth, flexShrink: 0, textAlign: 'center', marginBottom: 4 }]}>
          {bar.valueLabel}
        </Text>
        <Animated.View
          style={{
            height: h,
            width,
            borderTopLeftRadius: radius,
            borderTopRightRadius: radius,
            overflow: 'hidden',
            backgroundColor: highlighted && gradient ? undefined : color,
            transform: [{ translateY }, { scaleY: scale }],
          }}
        >
          {highlighted && gradient ? <GradientFill gradient={gradient} /> : null}
        </Animated.View>
      </View>
      <Text numberOfLines={1} style={[(highlighted ? s.text('activeLabelText') : s.text('labelText')) ?? null, { color: highlighted ? s.color('activeLabelTone') : s.color('labelTone'), marginTop: 6, width: labelWidth, minWidth: labelWidth, flexShrink: 0, textAlign: 'center' }]}>
        {bar.label}
      </Text>
      {selected && badge ? (
        <View
          style={{
            marginTop: 4,
            paddingHorizontal: 2,
            paddingVertical: 2,
            borderRadius: s.radius('badgeRadius'),
            backgroundColor: s.color('badgeFill'),
            ...(badgeStroke ? { borderWidth: badgeStroke.width, borderColor: badgeStroke.color } : {}),
          }}
        >
          <Text style={[s.text('badgeText') ?? null, { color: s.color('badgeTone') }]}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function BarsView({ node, style }: NodeViewProps) {
  const ctx = useViewContext();
  const m = ctx.manifest;
  const s = styledLook(m, { type: 'bars', spec: BARS_STYLE, style: node.style, look: node.look, defaultLook: 'plain' });
  const bars = node.bars as Bar[];
  const selected = node.selected as number;
  const [highlight, setHighlight] = useState(selected);
  useEffect(() => setHighlight(selected), [selected]);
  const inspect = useInspect(node);
  const progress = useEntrance(node, 600);
  const [width, setWidth] = useState(0);

  const barWidth = s.size('barWidth') ?? 40;
  const gap = s.space('gap') ?? 16;
  const height = s.size('height') ?? 112;
  const max = Math.max(...bars.map((b) => b.value));
  const colors = paletteColors(m, node.palette);
  const gradient = colors ? undefined : s.gradient('activeGradient');
  const baseline = s.stroke('baseline');
  const step = barWidth + gap;
  const valueRow = Math.max((s.text('valueText')?.lineHeight as number | undefined) ?? 13, (s.text('activeValueText')?.lineHeight as number | undefined) ?? 13);
  const offset = width > 0 ? width / 2 - (selected * step + barWidth / 2) : 0;
  const onHighlight = (i: number) => {
    setHighlight(i);
    inspect(i, bars[i]!.label);
  };

  return (
    <View style={[{ overflow: 'hidden' }, style]} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ flexDirection: 'row', gap, marginLeft: offset, alignItems: 'flex-start' }}>
        {bars.map((bar, i) => (
          <View key={i}>
            <BarColumn
              bar={bar}
              index={i}
              height={height}
              max={max}
              width={barWidth}
              highlighted={i === highlight}
              selected={i === selected}
              badge={node.badge as string | undefined}
              color={colors ? colors[i % colors.length] : s.color('fill')}
              gradient={gradient}
              s={s}
              progress={progress}
              onHighlight={onHighlight}
              inert={ctx.inert}
              valueRow={valueRow}
              labelWidth={barWidth + gap}
            />
          </View>
        ))}
      </View>
      {baseline ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, top: valueRow + 4 + height, height: baseline.width, backgroundColor: baseline.color }}
        />
      ) : null}
    </View>
  );
}

const TREND_STYLE: StyleSpec = {
  line: 'stroke',
  area: 'gradient',
  grid: 'stroke',
  height: 'size',
  axisText: 'text',
  axisTone: 'color',
  markerFill: 'color',
  markerRing: 'stroke',
  markerStroke: 'stroke',
  markerText: 'text',
  markerTone: 'color',
  markerRadius: 'radius',
  readoutFill: 'color',
  readoutStroke: 'stroke',
  readoutRadius: 'radius',
  readoutShadow: 'shadow',
  readoutText: 'text',
  readoutTone: 'color',
  guide: 'stroke',
};

interface Marker {
  index: number;
  lines: string[];
  place?: 'below';
}

function niceStep(span: number, ticks: number): number {
  const raw = span / Math.max(1, ticks - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  for (const f of [1, 2, 2.5, 5, 10]) if (f * mag >= raw) return f * mag;
  return 10 * mag;
}

export function TrendView({ node, style }: NodeViewProps) {
  const ctx = useViewContext();
  const m = ctx.manifest;
  const s = styledLook(m, { type: 'trend', spec: TREND_STYLE, style: node.style, look: node.look, defaultLook: 'plain' });
  const points = node.points as number[];
  const xLabels = node.xLabels as string[];
  const yLabels = node.yLabels as string[] | undefined;
  const markers = (node.markers as Marker[] | undefined) ?? [];
  const readouts = node.readouts as string[][] | undefined;
  const [width, setWidth] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const inspect = useInspect(node);
  const progress = useEntrance(node, 600);

  const height = s.size('height') ?? 130;
  const axisText = s.text('axisText');
  const axisTone = s.color('axisTone');
  const line = s.stroke('line');
  const grid = s.stroke('grid');
  const area = s.gradient('area');

  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const range = node.range as { min: number; max: number } | undefined;
  const covers = range && range.min <= lo && range.max >= hi;
  const ticks = yLabels?.length ?? 4;
  let min: number;
  let max: number;
  if (covers) {
    min = range.min;
    max = range.max;
  } else {
    const step = hi === lo ? (Math.abs(hi) / 10 || 1) : niceStep(hi - lo, ticks);
    min = Math.floor(lo / step) * step;
    max = Math.max(min + step * (ticks - 1), Math.ceil(hi / step) * step);
  }
  const labelColumn = covers && yLabels ? 32 : 0;
  const plotW = Math.max(0, width - labelColumn - 8);
  const x = (i: number) => labelColumn + 8 + (points.length === 1 ? 0 : (i * plotW) / (points.length - 1));
  const y = (v: number) => 4 + (1 - (v - min) / (max - min || 1)) * (height - 8);
  const path = useMemo(() => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p).toFixed(1)}`).join(' '), [points, width, min, max]);
  const areaPath = `${path} L${x(points.length - 1).toFixed(1)} ${height} L${x(0).toFixed(1)} ${height} Z`;
  const gid = useMemo(() => `trend${Math.random().toString(36).slice(2, 8)}`, []);

  const scrubIndex = (i: number) => {
    if (ctx.inert || !readouts) return;
    const clamped = Math.max(0, Math.min(points.length - 1, i));
    setScrub(clamped);
    inspect(clamped, readouts[clamped]![0]!);
  };
  const scrubTo = (px: number) => scrubIndex(Math.round(((px - labelColumn - 8) / (plotW || 1)) * (points.length - 1)));
  const chartRef = useRef<unknown>(null);
  const windowLeft = useRef(0);
  const measure = () => {
    const el = chartRef.current as { measureInWindow?: (cb: (x: number) => void) => void } | null;
    el?.measureInWindow?.((left) => (windowLeft.current = left));
  };
  const canScrub = !!readouts && !ctx.inert;
  const webPointer = (e: { clientX: number; currentTarget: { getBoundingClientRect(): { left: number } } }) => scrubTo(e.clientX - e.currentTarget.getBoundingClientRect().left);
  const gesture =
    Platform.OS === 'web'
      ? canScrub
        ? {
            onPointerDown: webPointer,
            onPointerMove: webPointer,
            onPointerLeave: (e: { pointerType: string }) => e.pointerType === 'mouse' && setScrub(null),
          }
        : {}
      : {
          onStartShouldSetResponder: () => canScrub,
          onMoveShouldSetResponder: () => canScrub,
          onResponderTerminationRequest: () => false,
          onResponderGrant: (e: { nativeEvent: { pageX: number } }) => {
            measure();
            scrubTo(e.nativeEvent.pageX - windowLeft.current);
          },
          onResponderMove: (e: { nativeEvent: { pageX: number } }) => scrubTo(e.nativeEvent.pageX - windowLeft.current),
        };
  const readoutHeight = 2 * (((s.text('readoutText')?.lineHeight as number | undefined) ?? 12.5)) + 10;
  const markerStroke = s.stroke('markerStroke');
  const ring = s.stroke('markerRing');

  return (
    <View style={style}>
      <View
        ref={chartRef as never}
        style={[{ height }, canScrub && Platform.OS === 'web' ? ({ cursor: 'crosshair', touchAction: 'pan-y' } as object) : null]}
        onLayout={(e) => {
          setWidth(e.nativeEvent.layout.width);
          measure();
        }}
        {...(gesture as object)}
        accessible={!!readouts}
        accessibilityRole={readouts ? 'adjustable' : undefined}
        accessibilityLabel={node.accessibilityLabel as string | undefined}
        accessibilityValue={readouts && scrub !== null ? { text: readouts[scrub]!.join(', ') } : undefined}
        accessibilityActions={readouts ? [{ name: 'increment' }, { name: 'decrement' }] : undefined}
        onAccessibilityAction={(e) => {
          const from = scrub ?? points.length - 1;
          if (e.nativeEvent.actionName === 'increment') scrubIndex(from + 1);
          if (e.nativeEvent.actionName === 'decrement') scrubIndex(from - 1);
        }}
      >
        {width > 0 ? (
          <Animated.View style={{ opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }}>
            <Svg width={width} height={height}>
              {area ? (
                <Defs>
                  <LinearGradient id={gid} x1={0} y1={0} x2={0} y2={1}>
                    {area.stops.map(([c, o], i) => (
                      <Stop key={i} offset={o} stopColor={c.slice(0, 7)} stopOpacity={c.length === 9 ? parseInt(c.slice(7), 16) / 255 : 1} />
                    ))}
                  </LinearGradient>
                </Defs>
              ) : null}
              {grid
                ? Array.from({ length: ticks }, (_, i) => {
                    const gy = 4 + (i * (height - 8)) / (ticks - 1);
                    return <Line key={i} x1={labelColumn + 8} x2={width} y1={gy} y2={gy} stroke={grid.color} strokeWidth={grid.width} />;
                  })
                : null}
              {area ? <Path d={areaPath} fill={`url(#${gid})`} /> : null}
              {line ? <Path d={path} stroke={line.color} strokeWidth={line.width} strokeLinejoin="round" fill="none" /> : null}
              {scrub === null
                ? markers.map((mk, i) => (
                    <Circle key={i} cx={x(mk.index)} cy={y(points[mk.index]!)} r={3.6} fill={s.color('markerFill')} stroke={ring?.color} strokeWidth={ring?.width} />
                  ))
                : null}
              {scrub !== null ? (
                <>
                  <Line x1={x(scrub)} x2={x(scrub)} y1={0} y2={height} stroke={s.stroke('guide')?.color ?? grid?.color} strokeWidth={s.stroke('guide')?.width ?? 1} strokeDasharray={s.stroke('guide')?.dash?.join(' ')} />
                  <Circle cx={x(scrub)} cy={y(points[scrub]!)} r={4} fill={line?.color} stroke={ring?.color} strokeWidth={ring?.width} />
                </>
              ) : null}
            </Svg>
          </Animated.View>
        ) : null}
        {covers && yLabels
          ? yLabels.map((l, i) => (
              <Text key={i} style={[axisText ?? null, { color: axisTone, position: 'absolute', left: 0, width: labelColumn, textAlign: 'right', top: Math.max(0, Math.min(height - 14, 4 + (i * (height - 8)) / (ticks - 1) - 7)) }]}>
                {l}
              </Text>
            ))
          : null}
        {width > 0 && scrub === null
          ? markers.map((mk, i) => {
              const below = mk.place === 'below';
              const px = x(mk.index);
              const py = y(points[mk.index]!);
              const boxW = 56;
              return (
                <View
                  key={i}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: Math.max(0, Math.min(width - boxW, px - boxW / 2)),
                    width: boxW,
                    alignItems: 'center',
                    ...(below ? { top: py + 8 } : { bottom: height - py + 8 }),
                  }}
                >
                  <View
                    style={{
                      paddingHorizontal: 2,
                      paddingVertical: 2,
                      borderRadius: s.radius('markerRadius'),
                      backgroundColor: s.color('readoutFill'),
                      ...(markerStroke ? { borderWidth: markerStroke.width, borderColor: markerStroke.color } : {}),
                    }}
                  >
                    {mk.lines.map((l, j) => (
                      <Text key={j} style={[s.text('markerText') ?? null, { color: s.color('markerTone'), textAlign: 'center' }]}>
                        {l}
                      </Text>
                    ))}
                  </View>
                </View>
              );
            })
          : null}
        {width > 0 && scrub !== null && readouts ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: y(points[scrub]!) - readoutHeight - 10 >= 0 ? y(points[scrub]!) - readoutHeight - 10 : y(points[scrub]!) + 10,
              left: Math.max(0, Math.min(width - 84, x(scrub) - 42)),
              width: 84,
              alignItems: 'center',
              paddingVertical: 4,
              paddingHorizontal: 6,
              borderRadius: s.radius('readoutRadius'),
              backgroundColor: s.color('readoutFill'),
              ...(s.stroke('readoutStroke') ? { borderWidth: s.stroke('readoutStroke')!.width, borderColor: s.stroke('readoutStroke')!.color } : {}),
              ...(s.shadow('readoutShadow') ? { boxShadow: shadowCss(s.shadow('readoutShadow')!) } : {}),
            }}
          >
            {readouts[scrub]!.map((l, j) => (
              <Text key={j} style={[s.text('readoutText') ?? null, { color: s.color('readoutTone'), textAlign: 'center' }]}>
                {l}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: labelColumn + 8, paddingTop: 8 }}>
        {xLabels.map((l, i) => (
          <Text key={i} style={[axisText ?? null, { color: axisTone }]}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

const PIE_STYLE: StyleSpec = {
  sizeSm: 'size',
  sizeMd: 'size',
  sizeLg: 'size',
  track: 'color',
  separator: 'stroke',
  offset: 'space',
  dim: 'opacity',
  gap: 'space',
  rowGap: 'space',
  swatch: 'size',
  swatchRadius: 'radius',
  labelText: 'text',
  labelTone: 'color',
  valueText: 'text',
  valueTone: 'color',
  rule: 'stroke',
  totalText: 'text',
  totalValueText: 'text',
  totalTone: 'color',
  legendOpacity: 'opacity',
  iconSize: 'size',
};

interface Slice {
  id?: string;
  label: string;
  value: number;
  valueText?: string;
  tone?: string;
  icon?: string;
  image?: { url: string; alt: string };
  action?: ViewAction;
}

export function sharePercent(value: number, total: number): string {
  const pct = (value / total) * 100;
  return pct > 0 && pct < 1 ? '<1%' : `${Math.round(pct)}%`;
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  if (a1 - a0 >= Math.PI * 2 - 1e-6) return `M${cx} ${cy - r} A${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`;
  const p = (a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)] as const;
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${cx} ${cy} L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

function LegendRow({
  slice,
  color,
  value,
  s,
  highlighted,
  dimmed,
  dimOpacity,
  inert,
  onPick,
  onHover,
}: {
  slice: Slice;
  color?: string;
  value: string;
  s: ReturnType<typeof styledLook>;
  highlighted: boolean;
  dimmed: boolean;
  dimOpacity: number;
  inert: boolean;
  onPick: () => void;
  onHover: () => void;
}) {
  const swatch = s.size('swatch') ?? 12;
  const hover = Platform.OS === 'web' ? { onHoverIn: onHover } : {};
  return (
    <Pressable
      role="button"
      aria-label={`${slice.label}, ${value}`}
      aria-pressed={highlighted}
      disabled={inert}
      onPress={onPick}
      {...hover}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, opacity: dimmed ? dimOpacity : 1 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}>
        <View style={{ width: swatch, height: swatch, borderRadius: s.radius('swatchRadius'), backgroundColor: color }} />
        <Text style={[s.text('labelText') ?? null, { color: s.color('labelTone'), flexShrink: 1 }]}>{slice.label}</Text>
      </View>
      <Text style={[s.text('valueText') ?? null, { color: s.color('valueTone') }]}>{value}</Text>
    </Pressable>
  );
}

export function PieView({ node, style }: NodeViewProps) {
  const ctx = useViewContext();
  const m = ctx.manifest;
  const s = styledLook(m, { type: 'pie', spec: PIE_STYLE, style: node.style, look: node.look, defaultLook: 'plain' });
  const slices = node.slices as Slice[];
  const [highlight, setHighlight] = useState<number | null>(null);
  useEffect(() => setHighlight(null), [node.slices]);
  const inspect = useInspect(node);
  const progress = useEntrance(node, 700);
  const [sweep, setSweep] = useState(1);
  useEffect(() => {
    const id = progress.addListener(({ value }) => setSweep(value));
    return () => progress.removeListener(id);
  }, [progress]);

  const sizeKey = (node.size as string | undefined) ?? 'md';
  const side = s.size(sizeKey === 'sm' ? 'sizeSm' : sizeKey === 'lg' ? 'sizeLg' : 'sizeMd') ?? 140;
  const offset = s.space('offset') ?? 4;
  const r = side / 2 - offset;
  const c = side / 2;
  const total = slices.reduce((a, x) => a + x.value, 0);
  const palette = paletteColors(m, node.palette ?? 'default') ?? [];
  const colorOf = (sl: Slice, i: number) => (sl.tone !== undefined && m.color[sl.tone] !== undefined ? m.color[sl.tone] : palette[i % (palette.length || 1)]);
  const dimOpacity = s.opacity('dim') ?? 0.5;
  const separator = s.stroke('separator');
  const legend = node.legend !== false;
  const totalRow = node.total as { label: string; valueText: string } | undefined;
  const rule = s.stroke('rule');

  const angles: [number, number][] = [];
  let acc = 0;
  for (const sl of slices) {
    const a0 = (acc / total) * Math.PI * 2;
    acc += sl.value;
    angles.push([a0, (acc / total) * Math.PI * 2]);
  }
  const limit = sweep * Math.PI * 2;

  const pick = (i: number, press?: () => void) => {
    if (ctx.inert) return;
    if (highlight === i) {
      press?.();
      return;
    }
    setHighlight(i);
    inspect(i, slices[i]!.label);
  };
  const hoverPick = (i: number) => {
    if (ctx.inert || highlight === i) return;
    setHighlight(i);
    inspect(i, slices[i]!.label);
  };
  const indexAt = (x: number, y: number): number | null => {
    const dx = x - c;
    const dy = y - c;
    if (dx * dx + dy * dy > (r + offset) * (r + offset)) return null;
    let a = Math.atan2(dx, -dy);
    if (a < 0) a += Math.PI * 2;
    const i = angles.findIndex(([a0, a1]) => a >= a0 && a < a1);
    return i < 0 ? null : i;
  };
  const values = slices.map((sl) => sl.valueText ?? sharePercent(sl.value, total));
  const presses = slices.map((sl) => sl.action);
  const discLabel =
    (node.accessibilityLabel as string | undefined) ?? slices.map((sl) => `${sl.label}, ${sharePercent(sl.value, total)}`).join('; ');

  const discGesture =
    Platform.OS === 'web'
      ? {
          onPointerDown: (e: { clientX: number; clientY: number; currentTarget: { getBoundingClientRect(): { left: number; top: number } } }) => {
            const b = e.currentTarget.getBoundingClientRect();
            const i = indexAt(e.clientX - b.left, e.clientY - b.top);
            if (i !== null) pick(i, () => presses[i] && pressRefs.current[i]?.());
          },
          onPointerMove: (e: { pointerType: string; clientX: number; clientY: number; currentTarget: { getBoundingClientRect(): { left: number; top: number } } }) => {
            if (e.pointerType !== 'mouse') return;
            const b = e.currentTarget.getBoundingClientRect();
            const i = indexAt(e.clientX - b.left, e.clientY - b.top);
            if (i !== null) hoverPick(i);
          },
        }
      : {
          onStartShouldSetResponder: () => !ctx.inert,
          onResponderRelease: (e: { nativeEvent: { locationX: number; locationY: number } }) => {
            const i = indexAt(e.nativeEvent.locationX, e.nativeEvent.locationY);
            if (i !== null) pick(i, () => pressRefs.current[i]?.());
          },
        };
  const pressRefs = useRef<((() => void) | undefined)[]>([]);

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: s.space('gap') }, style]}>
      {slices.map((sl, i) => (
        <PressBinder key={i} action={sl.action} bind={(fn) => (pressRefs.current[i] = fn)} />
      ))}
      <View
        style={{ width: side, height: side }}
        {...(discGesture as object)}
        {...(legend ? { 'aria-hidden': true, importantForAccessibility: 'no-hide-descendants' as const } : { accessible: true, role: 'img' as const, 'aria-label': discLabel })}
      >
        <Svg width={side} height={side}>
          {s.color('track') ? <Circle cx={c} cy={c} r={r} fill={s.color('track')} /> : null}
          {slices.map((sl, i) => {
            const [a0, a1raw] = angles[i]!;
            if (a0 >= limit) return null;
            const a1 = Math.min(a1raw, limit);
            const mid = (a0 + a1raw) / 2;
            const out = highlight === i ? offset : 0;
            const dx = out * Math.sin(mid);
            const dy = -out * Math.cos(mid);
            return (
              <G key={i} opacity={highlight !== null && highlight !== i ? dimOpacity : 1}>
                <Path
                  d={arcPath(c + dx, c + dy, r, a0, a1)}
                  fill={colorOf(sl, i)}
                  stroke={separator?.color}
                  strokeWidth={separator?.width}
                />
              </G>
            );
          })}
        </Svg>
        {slices.map((sl, i) => {
          if (!sl.icon && !sl.image) return null;
          const [a0, a1] = angles[i]!;
          const iconSide = s.size('iconSize') ?? 20;
          const rc = r * 0.62;
          const chord = 2 * rc * Math.sin(Math.min(Math.PI / 2, (a1 - a0) / 2));
          if (chord < iconSide + 6 || r - rc < iconSide / 2 + 3) return null;
          const mid = (a0 + a1) / 2;
          const cx = c + rc * Math.sin(mid) - iconSide / 2;
          const cy = c - rc * Math.cos(mid) - iconSide / 2;
          return (
            <View key={i} pointerEvents="none" style={{ position: 'absolute', left: cx, top: cy, opacity: sweep }}>
              {sl.icon ? <ViewIcon name={sl.icon} size={iconSide} tone="#FFFFFF" /> : null}
            </View>
          );
        })}
      </View>
      {legend ? (
        <View style={{ flex: 1, gap: s.space('rowGap'), opacity: s.opacity('legendOpacity') ?? 1 }}>
          {slices.map((sl, i) => (
            <LegendRow
              key={i}
              slice={sl}
              color={colorOf(sl, i)}
              value={values[i]!}
              s={s}
              highlighted={highlight === i}
              dimmed={highlight !== null && highlight !== i}
              dimOpacity={dimOpacity}
              inert={ctx.inert}
              onPick={() => pick(i, () => pressRefs.current[i]?.())}
              onHover={() => hoverPick(i)}
            />
          ))}
          {totalRow ? (
            <>
              {rule ? <View style={{ height: rule.width, backgroundColor: rule.color }} /> : null}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[s.text('totalText') ?? null, { color: s.color('totalTone') }]}>{totalRow.label}</Text>
                <Text style={[s.text('totalValueText') ?? null, { color: s.color('totalTone') }]}>{totalRow.valueText}</Text>
              </View>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function PressBinder({ action, bind }: { action?: ViewAction; bind: (fn: (() => void) | undefined) => void }) {
  const press = usePress(action);
  bind(press.onPress);
  return null;
}

export const chartViews = {
  bars: BarsView,
  pie: PieView,
  trend: TrendView,
};
