import { useCallback, useId, useRef, useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { reportCount } from '../report';
import type { GradientToken, IconDef, Manifest } from '../manifest/types';
import type { ViewAction } from '../wire/actions';
import { useViewContext, type FormSubmission } from './context';

const DEFAULT_ICON_SIZE = 20;

export function resolveIcon(manifest: Manifest, name: string | undefined): IconDef | undefined {
  if (name === undefined) return undefined;
  const def = Object.prototype.hasOwnProperty.call(manifest.icon, name) ? manifest.icon[name] : undefined;
  if (!def) reportCount({ kind: 'unknownToken', scale: 'icon', name });
  return def;
}

export function iconSize(def: IconDef | undefined, size: number | undefined): number {
  return size ?? def?.size ?? DEFAULT_ICON_SIZE;
}

export function ViewIcon({ name, size, tone, style }: { name: string | undefined; size?: number; tone?: string; style?: StyleProp<ViewStyle> }) {
  const { manifest } = useViewContext();
  const def = resolveIcon(manifest, name);
  const side = iconSize(def, size);
  const box = [{ width: side, height: side }, style];
  const ns = useId().replace(/:/g, '');
  if (!def) return <View style={box} aria-hidden importantForAccessibility="no-hide-descendants" />;
  if ('url' in def) {
    return <Image source={{ uri: def.url }} resizeMode="contain" style={box as never} aria-hidden accessible={false} />;
  }
  const paint = (p: string | undefined): string | undefined => {
    if (p === undefined || p === 'tone') return tone ?? manifest.color.heading;
    if (p.startsWith('url(#')) return `url(#${ns}-${p.slice(5)}`;
    return p;
  };
  return (
    <View style={box} aria-hidden importantForAccessibility="no-hide-descendants" accessible={false}>
      <Svg key={name} width={side} height={side} viewBox={def.viewBox ?? '0 0 24 24'}>
        {def.gradients?.length ? (
          <Defs>
            {def.gradients.map((g) => (
              <LinearGradient key={g.id} id={`${ns}-${g.id}`} x1={g.x1 ?? 0} y1={g.y1 ?? 0} x2={g.x2 ?? 1} y2={g.y2 ?? 0}>
                {g.stops.map(([offset, color], i) => (
                  <Stop key={i} offset={offset} stopColor={color} />
                ))}
              </LinearGradient>
            ))}
          </Defs>
        ) : null}
        {def.paths.map((p, i) => (
          <Path
            key={i}
            d={p.d}
            fill={p.stroke && p.fill === undefined ? 'none' : paint(p.fill)}
            fillOpacity={p.fillOpacity}
            stroke={p.stroke ? paint(p.stroke) : undefined}
            strokeWidth={p.strokeWidth}
          />
        ))}
      </Svg>
    </View>
  );
}

function gradientVector(angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  const x = Math.cos(rad) / 2;
  const y = Math.sin(rad) / 2;
  return { x1: 0.5 - x, y1: 0.5 - y, x2: 0.5 + x, y2: 0.5 + y };
}

export function GradientFill({ gradient, radius, style }: { gradient: GradientToken; radius?: number; style?: StyleProp<ViewStyle> }) {
  const id = `g${useId().replace(/:/g, '')}`;
  const v = gradientVector(gradient.angle);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, radius ? { borderRadius: radius, overflow: 'hidden' } : null, style]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1={v.x1} y1={v.y1} x2={v.x2} y2={v.y2}>
            {gradient.stops.map(([color, offset], i) => (
              <Stop key={i} offset={offset} stopColor={color} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

export interface Press {
  onPress: (() => void) | undefined;
  pending: boolean;
  available: boolean;
}

export function usePress(action: ViewAction | undefined, opts: { form?: () => FormSubmission | undefined; blocked?: boolean } = {}): Press {
  const ctx = useViewContext();
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const available = action !== undefined && ctx.available(action);
  const { onAction, spend } = ctx;
  const { form, blocked } = opts;
  const run = useCallback(() => {
    if (!action || pendingRef.current) return;
    const result = onAction(action, form?.());
    if (result && typeof (result as Promise<boolean>).then === 'function') {
      pendingRef.current = true;
      setPending(true);
      void (result as Promise<boolean>).finally(() => {
        pendingRef.current = false;
        setPending(false);
        spend?.();
      });
    } else spend?.();
  }, [action, onAction, form, spend]);
  return { onPress: available && !blocked && !ctx.spent && !pending ? run : undefined, pending, available };
}
