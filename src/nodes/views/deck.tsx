import { useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, PanResponder, View, type LayoutChangeEvent } from 'react-native';
import type { Styled } from '../../manifest/resolve';
import type { ViewNode } from '../../parse/registry';
import { useViewContext, type NodeViewProps } from '../../render/context';
import { ViewNodeRenderer } from '../../render/ViewNodeRenderer';
import type { TrackingEvent } from '../../wire/tracking';
import { IndicatorView, PagerContext } from './content';

const SWIPE_FRACTION = 0.25;
const OUT_MS = 180;

export function DeckView({ node, style, s }: NodeViewProps & { s: Styled }) {
  const ctx = useViewContext();
  const children = (node.children as ViewNode[]) ?? [];
  const count = children.length;
  const [front, setFront] = useState(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const offset = s.space('stackOffset') ?? 10;
  const scale = s.opacity('stackScale') ?? 0.925;
  const depth = Math.min(count - 1, Number(s.raw('stackDepth') ?? 3));
  const drag = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);
  const onSelect = (node.tracking as { onSelect?: TrackingEvent } | undefined)?.onSelect;

  const advance = (dir: 1 | -1) => {
    if (count < 2 || busy.current) return;
    busy.current = true;
    const next = (front + dir + count) % count;
    const finish = () => {
      drag.setValue(0);
      setFront(next);
      busy.current = false;
      const child = children[next];
      if (onSelect) ctx.onTrack({ ...onSelect, props: { ...onSelect.props, ...(child?.id ? { id: child.id } : {}), index: next } });
    };
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced || size.width === 0) return finish();
      Animated.timing(drag, { toValue: -dir * size.width, duration: OUT_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(finish);
    });
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => !ctx.inert && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => drag.setValue(g.dx),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > sizeRef.current.width * SWIPE_FRACTION) advanceRef.current(g.dx < 0 ? 1 : -1);
        else Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  const order = Array.from({ length: depth + 1 }, (_, k) => (front + k) % count).reverse();
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  };
  const dots = node.dots;

  return (
    <View style={[{ gap: 8 }, style]}>
      <View
        style={{ paddingTop: depth * offset }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${front + 1} of ${count}`}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => advance(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      >
        {order.map((index) => {
          const k = (index - front + count) % count;
          const sk = scale ** k;
          const lift = -k * offset - (size.height * (1 - sk)) / 2;
          const isFront = k === 0;
          return (
            <Animated.View
              key={index}
              {...(isFront ? pan.panHandlers : {})}
              onLayout={isFront ? onLayout : undefined}
              pointerEvents={isFront ? 'auto' : 'none'}
              aria-hidden={!isFront}
              style={[
                isFront ? { position: 'relative' } : { position: 'absolute', left: 0, right: 0, top: depth * offset },
                { zIndex: depth + 1 - k, transform: [{ translateY: lift }, { scale: sk }, ...(isFront ? [{ translateX: drag }] : [])] },
              ]}
            >
              <ViewNodeRenderer node={children[index]!} />
            </Animated.View>
          );
        })}
      </View>
      {dots !== undefined ? (
        <PagerContext.Provider value={{ index: front, count, noun: null }}>
          <IndicatorView node={{ type: 'indicator', look: dots }} />
        </PagerContext.Provider>
      ) : null}
    </View>
  );
}
