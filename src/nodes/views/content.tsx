import { createContext, useContext } from 'react';
import { Image, Pressable, Text, View, type ViewStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { resolveToken, shadowCss, styledLook } from '../../manifest/resolve';
import type { StyleSpec } from '../../manifest/types';
import { useViewContext, type NodeViewProps } from '../../render/context';
import { ALIGN } from '../../render/layout';
import { GradientFill, usePress, ViewIcon } from '../../render/primitives';
import { useFormButton } from '../../render/form';
import type { ViewAction } from '../../wire/actions';
import type { TextSpan } from '../schemas';

const SPENT_OPACITY = 0.4;
const SPAN_WEIGHT = { regular: '400', medium: '500', semibold: '600', bold: '700', extrabold: '800', black: '900' } as const;
const spentOpacity = (m: { opacity: Record<string, number> }) => m.opacity.spent ?? SPENT_OPACITY;

const ICON_STYLE: StyleSpec = { size: 'size', tone: 'color' };
export function IconView({ node, style }: NodeViewProps) {
  const { manifest: m, spent } = useViewContext();
  const s = styledLook(m, { type: 'icon', spec: ICON_STYLE, style: node.style });
  const size = resolveToken(m, 'size', node.size) ?? s.size('size');
  const tone = s.color('tone', node.tone);
  return <ViewIcon name={node.name as string} size={size} tone={tone} style={[spent ? { opacity: spentOpacity(m) } : null, style]} />;
}

const IMAGE_STYLE: StyleSpec = {
  width: 'size',
  height: 'size',
  aspect: 'aspect',
  radius: 'radius',
  fit: { keyword: ['cover', 'contain'] },
  placeholder: 'color',
  stroke: 'stroke',
  inset: 'space',
};
export function ImageView({ node, style }: NodeViewProps) {
  const { manifest: m, spent } = useViewContext();
  const s = styledLook(m, { type: 'image', spec: IMAGE_STYLE, style: node.style, look: node.look, legacy: node.role });
  const img = (node.images as { url: string; alt: string }[])[0]!;
  const width = s.raw('width') === 'fill' ? '100%' : (s.size('width') ?? '100%');
  const height = s.size('height');
  const aspect = height === undefined ? (s.aspect('aspect', node.aspect) ?? 1) : undefined;
  const radius = s.radius('radius', node.radius);
  const stroke = s.stroke('stroke');
  const box: ViewStyle = {
    width,
    ...(height !== undefined ? { height } : { aspectRatio: aspect }),
    borderRadius: radius,
    overflow: 'hidden',
    backgroundColor: s.color('placeholder') ?? m.color.placeholder,
    ...(stroke ? { borderWidth: stroke.width, borderColor: stroke.color } : {}),
    padding: s.space('inset'),
  };
  const decorative = img.alt === '';
  return (
    <View style={[box, style]}>
      <Image
        source={{ uri: img.url }}
        resizeMode={s.keyword('fit') === 'contain' ? 'contain' : 'cover'}
        style={{ width: '100%', height: '100%', opacity: spent ? spentOpacity(m) : 1 }}
        alt={decorative ? undefined : img.alt}
        aria-label={decorative ? undefined : img.alt}
        aria-hidden={decorative}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const BOX_STYLE: StyleSpec = {
  fill: 'color',
  gradient: 'gradient',
  stroke: 'stroke',
  radius: 'radius',
  corners: { keyword: ['all', 'diagonal'] },
  paddingX: 'space',
  paddingY: 'space',
  width: 'size',
  height: 'size',
  text: 'text',
  tone: 'color',
  gap: 'space',
  iconSize: 'size',
  align: { keyword: ['start', 'center', 'end', 'stretch'] },
};
export function PillView({ node, style }: NodeViewProps) {
  const { manifest: m, spent } = useViewContext();
  const look = node.look ?? node.variant ?? (node.shape === 'circle' ? 'circle' : undefined);
  const s = styledLook(m, { type: 'pill', spec: BOX_STYLE, style: node.style, look, hue: node.hue, spent });
  const radius = s.radius('radius') ?? (node.shape === 'square' ? 0 : undefined);
  const diagonal = s.keyword('corners') === 'diagonal';
  const stroke = s.stroke('stroke');
  const gradient = s.gradient('gradient');
  const tone = s.color('tone', m.color[node.tone as string] !== undefined ? node.tone : undefined);
  const align = s.keyword<string>('align', node.align);
  const box: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: align ? ALIGN[align] : 'flex-start',
    gap: s.space('gap'),
    paddingHorizontal: s.space('paddingX'),
    paddingVertical: s.space('paddingY'),
    width: s.size('width'),
    height: s.size('height'),
    backgroundColor: s.color('fill'),
    ...(diagonal && radius !== undefined
      ? { borderTopLeftRadius: radius, borderBottomRightRadius: radius }
      : { borderRadius: radius }),
    ...(stroke ? { borderWidth: stroke.width, borderColor: stroke.color } : {}),
    overflow: 'hidden',
  };
  return (
    <View style={[box, style]}>
      {gradient ? <GradientFill gradient={gradient} /> : null}
      {node.icon ? <ViewIcon name={node.icon as string} size={s.size('iconSize')} tone={tone} /> : null}
      <Text style={[s.text('text') ?? null, { color: tone }]}>{node.label as string}</Text>
    </View>
  );
}

const BUTTON_STYLE: StyleSpec = {
  fill: 'color',
  gradient: 'gradient',
  stroke: 'stroke',
  radius: 'radius',
  paddingX: 'space',
  paddingTop: 'space',
  paddingBottom: 'space',
  text: 'text',
  tone: 'color',
  gap: 'space',
  iconSize: 'size',
  width: { keyword: ['fill', 'hug'] },
};
export function ButtonView({ node, style }: NodeViewProps) {
  const ctx = useViewContext();
  const m = ctx.manifest;
  const form = useFormButton(node);
  const baseLook = (node.look ?? node.variant) as string | undefined;
  const look = baseLook !== undefined && node.size === 'sm' ? `${baseLook}-sm` : baseLook;
  const s = styledLook(m, { type: 'button', spec: BUTTON_STYLE, style: node.style, look, spent: ctx.spent });
  const disabled = node.disabled === true || form.blocked;
  const press = usePress(node.action as ViewAction, { form: form.submission, blocked: disabled });
  if (!press.available) return null;

  const fill = s.color('fill');
  const gradient = disabled ? undefined : s.gradient('gradient');
  const stroke = s.stroke('stroke');
  const boxed = fill !== undefined || gradient !== undefined || stroke !== undefined;
  const greyed = disabled || press.pending;
  const tone = greyed && !boxed ? m.color.disabled : s.color('tone');
  const iconSize = s.size('iconSize');
  const fullWidth = node.fullWidth === true || s.keyword('width') === 'fill';
  const hug = node.fullWidth === false || s.keyword('width') === 'hug';
  const radius = s.radius('radius');
  const label = form.fill(node.label as string | TextSpan[] | undefined);
  const textStyle = [s.text('text') ?? null, { color: tone }, fullWidth && node.trailingIcon ? { flex: 1 } : null];

  return (
    <Pressable
      role="button"
      aria-label={node.accessibilityLabel as string | undefined}
      aria-disabled={greyed || ctx.spent}
      aria-busy={press.pending}
      onPress={press.onPress}
      disabled={!press.onPress || greyed}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: boxed ? 'center' : 'flex-start',
          gap: s.space('gap'),
          paddingHorizontal: s.space('paddingX'),
          paddingTop: s.space('paddingTop'),
          paddingBottom: s.space('paddingBottom'),
          borderRadius: radius,
          backgroundColor: greyed && boxed ? m.color.disabled : fill,
          ...(stroke ? { borderWidth: stroke.width, borderColor: greyed ? m.color.disabled : stroke.color } : {}),
          ...(fullWidth ? { alignSelf: 'stretch' } : hug ? { alignSelf: 'flex-start' } : {}),
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {gradient ? <GradientFill gradient={gradient} radius={radius} /> : null}
      {node.leadingIcon ? <ViewIcon name={node.leadingIcon as string} size={iconSize} tone={tone} /> : null}
      {label === undefined ? null : typeof label === 'string' ? (
        <Text style={textStyle}>{label}</Text>
      ) : (
        <Text style={textStyle}>
          {label.map((sp, i) => (
            <Text key={i} style={sp.weight ? { fontWeight: SPAN_WEIGHT[sp.weight] } : undefined}>
              {sp.text}
            </Text>
          ))}
        </Text>
      )}
      {node.trailingIcon ? <ViewIcon name={node.trailingIcon as string} size={iconSize} tone={tone} /> : null}
    </Pressable>
  );
}

export function DividerView({ node, style }: NodeViewProps) {
  const { manifest: m } = useViewContext();
  const stroke = resolveToken(m, 'stroke', node.stroke) ?? m.stroke.divider;
  if (!stroke) return null;
  const vertical = node.orientation === 'vertical';
  if (stroke.dash) {
    return (
      <View style={[vertical ? { width: stroke.width, alignSelf: 'stretch' } : { height: stroke.width, width: '100%' }, style]}>
        <Svg width="100%" height="100%">
          <Line
            x1={0}
            y1={0}
            x2={vertical ? 0 : '100%'}
            y2={vertical ? '100%' : 0}
            stroke={stroke.color}
            strokeWidth={stroke.width * 2}
            strokeDasharray={stroke.dash.join(' ')}
          />
        </Svg>
      </View>
    );
  }
  return (
    <View
      style={[
        vertical ? { width: stroke.width, alignSelf: 'stretch' } : { height: stroke.width, alignSelf: 'stretch' },
        { backgroundColor: stroke.color },
        style,
      ]}
    />
  );
}

export interface Pager {
  index: number;
  count: number;
  noun: string | null;
}
export const PagerContext = createContext<Pager | null>(null);

const INDICATOR_STYLE: StyleSpec = {
  dot: 'size',
  activeWidth: 'size',
  activeHeight: 'size',
  shrink: 'size',
  gap: 'space',
  paddingX: 'space',
  paddingY: 'space',
  radius: 'radius',
  active: 'color',
  inactive: 'color',
  fill: 'color',
  countTone: 'color',
  activeGradient: 'gradient',
  activeShadow: 'shadow',
  countText: 'text',
};
export function IndicatorView({ node, style }: NodeViewProps) {
  const { manifest: m } = useViewContext();
  const pager = useContext(PagerContext);
  const legacy = typeof node.style === 'string' ? node.style : undefined;
  const s = styledLook(m, {
    type: 'indicator',
    spec: INDICATOR_STYLE,
    style: typeof node.style === 'object' ? node.style : undefined,
    look: node.look,
    legacy,
    defaultLook: 'dots',
  });
  if (!pager || pager.count < 2) return null;
  const countText = s.text('countText');
  const label = pager.noun ? `${pager.noun} ${pager.index + 1} of ${pager.count}` : undefined;
  const a11y = pager.noun === null ? { 'aria-hidden': true as const } : { 'aria-label': label };
  const fill = s.color('fill');
  const box: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: s.space('gap'),
    paddingHorizontal: s.space('paddingX'),
    paddingVertical: s.space('paddingY'),
    backgroundColor: fill,
    borderRadius: s.radius('radius'),
  };
  if (countText) {
    return (
      <View style={[box, style]} {...a11y}>
        <Text style={[countText, { color: s.color('countTone') }]}>{`${pager.index + 1}/${pager.count}`}</Text>
      </View>
    );
  }
  const dot = s.size('dot') ?? 6;
  const activeW = s.size('activeWidth') ?? dot;
  const activeH = s.size('activeHeight') ?? dot;
  const shrink = s.size('shrink');
  const activeGradient = s.gradient('activeGradient');
  const shadow = s.shadow('activeShadow');
  const radius = s.radius('radius') ?? dot / 2;
  const dots = Array.from({ length: pager.count }, (_, i) => i).filter((i) => shrink === undefined || Math.abs(i - pager.index) <= 2);
  return (
    <View style={[box, { backgroundColor: fill }, style]} {...a11y}>
      {dots.map((i) => {
        const active = i === pager.index;
        const step = shrink !== undefined ? Math.abs(i - pager.index) : 0;
        const side = active ? undefined : Math.max(1, dot - step * (shrink ?? 0));
        return (
          <View
            key={i}
            style={{
              width: active ? activeW : side,
              height: active ? activeH : side,
              borderRadius: radius,
              backgroundColor: active ? (activeGradient ? undefined : s.color('active')) : s.color('inactive'),
              overflow: 'hidden',
              ...(active && shadow ? { boxShadow: shadowCss(shadow) } : {}),
            }}
          >
            {active && activeGradient ? <GradientFill gradient={activeGradient} /> : null}
          </View>
        );
      })}
    </View>
  );
}

export const contentViews = {
  icon: IconView,
  image: ImageView,
  pill: PillView,
  button: ButtonView,
  divider: DividerView,
  indicator: IndicatorView,
};
