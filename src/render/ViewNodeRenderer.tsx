import { memo, useContext, useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import type { ViewNode } from '../parse/registry';
import { useViewContext } from './context';
import { FrontContext } from './front';
import { SpendScope } from './spend';

const GROW: ViewStyle = { flexGrow: 1, flexShrink: 1, flexBasis: 0 };
const FADE_MS = 150;

function FrontFade({ isFront, children }: { isFront: boolean; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(isFront ? 1 : 0)).current;
  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) opacity.setValue(isFront ? 1 : 0);
      else Animated.timing(opacity, { toValue: isFront ? 1 : 0, duration: FADE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    });
    return () => {
      cancelled = true;
    };
  }, [isFront, opacity]);
  return (
    <Animated.View style={{ opacity }} pointerEvents={isFront ? 'auto' : 'none'} aria-hidden={!isFront}>
      {children}
    </Animated.View>
  );
}

export const ViewNodeRenderer = memo(function ViewNodeRenderer({ node, style }: { node: ViewNode; style?: StyleProp<ViewStyle> }) {
  const { registry } = useViewContext();
  const front = useContext(FrontContext);
  const entry = registry.get(node.type);
  if (!entry) return null;
  const View = entry.View;
  let el = <View node={node} style={node.grow ? [GROW, style] : style} />;
  if (node.spend === 'onAction' && entry.definition.spendScope) el = <SpendScope node={node}>{el}</SpendScope>;
  if (front && node.id === front.frontId) el = <FrontFade isFront={front.isFront}>{el}</FrontFade>;
  return el;
});
