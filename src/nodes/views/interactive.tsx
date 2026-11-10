import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { shadowCss, styledLook } from '../../manifest/resolve';
import type { StyleSpec } from '../../manifest/types';
import type { ViewNode } from '../../parse/registry';
import { useViewContext, type NodeViewProps } from '../../render/context';
import { useDraft } from '../../render/drafts';
import { StackLayout, type StackFields } from '../../render/layout';
import { usePress, ViewIcon } from '../../render/primitives';
import { ViewNodeRenderer } from '../../render/ViewNodeRenderer';
import type { ViewAction } from '../../wire/actions';
import type { TrackingEvent } from '../../wire/tracking';
import { CardMenuContext } from './layout';
import { useWebDragScroll } from '../../render/dragScroll';

const FADE_MS = 150;

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

function withTarget(event: TrackingEvent | undefined, props: Record<string, string | number>): TrackingEvent | undefined {
  return event ? { ...event, props: { ...event.props, ...props } } : undefined;
}

const MENU_STYLE: StyleSpec = {
  size: 'size',
  tone: 'color',
  iconSize: 'size',
  fill: 'color',
  shadow: 'shadow',
  radius: 'radius',
  padding: 'space',
  itemText: 'text',
  itemTone: 'color',
  minWidth: 'size',
  labelText: 'text',
  labelTone: 'color',
  labelDecoration: { keyword: ['underline', 'none'] },
  chevron: 'icon',
  chevronSize: 'size',
  chevronGap: 'space',
};

interface MenuItem {
  label: string;
  icon?: string;
  action: ViewAction;
}

function MenuRow({ item, textStyle, iconSize, tone, onDone }: { item: MenuItem; textStyle: object | null; iconSize?: number; tone?: string; onDone: () => void }) {
  const press = usePress(item.action);
  return (
    <Pressable
      role="menuitem"
      onPress={() => {
        onDone();
        press.onPress?.();
      }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}
    >
      {item.icon ? <ViewIcon name={item.icon} size={iconSize} tone={tone} /> : null}
      <Text numberOfLines={1} style={[textStyle, { color: tone }]}>
        {item.label}
      </Text>
    </Pressable>
  );
}

export function MenuView({ node, style }: NodeViewProps) {
  const ctx = useViewContext();
  const m = ctx.manifest;
  const card = useContext(CardMenuContext);
  const label = node.label as string | undefined;
  const s = styledLook(m, { type: 'menu', spec: MENU_STYLE, style: node.style, look: node.look, defaultLook: label ? 'dropdown' : 'default', spent: ctx.spent });
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const trigger = useRef<unknown>(null);
  const items = (node.items as MenuItem[]).filter((i) => ctx.available(i.action));
  const tracking = node.tracking as TrackingEvent | undefined;
  const id = node.id as string | undefined;

  const openMenu = () => {
    if (ctx.inert || ctx.spent) return;
    if (tracking) ctx.onTrack(tracking);
    const el = trigger.current as { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null;
    if (el?.measureInWindow) el.measureInWindow((x, y, w, h) => setAnchor({ x, y, w, h }));
    setOpen(true);
  };
  const openRef = useRef(openMenu);
  openRef.current = openMenu;

  useEffect(() => {
    if (!card || !id || items.length === 0 || ctx.spent) return;
    return card.register(id, () => openRef.current());
  }, [card, id, items.length, ctx.spent]);

  if (items.length === 0) return null;
  const size = s.size('size');
  const tone = s.color('tone') ?? m.color.tertiary;
  const shadow = s.shadow('shadow');
  const itemText = s.text('itemText') ?? null;
  const itemTone = s.color('itemTone');
  return (
    <>
      <Pressable
        ref={trigger as never}
        role="button"
        aria-label={(node.accessibilityLabel as string | undefined) ?? (label ? `${label}, change` : 'More options')}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={ctx.spent || ctx.inert}
        onPress={openMenu}
        hitSlop={8}
        style={[
          label
            ? { flexDirection: 'row', alignItems: 'center', gap: s.space('chevronGap'), alignSelf: 'flex-start' }
            : { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
          { opacity: ctx.spent ? (m.opacity.spent ?? 0.4) : 1 },
          style,
        ]}
      >
        {label ? (
          <>
            <Text style={[s.text('labelText') ?? null, { color: s.color('labelTone'), textDecorationLine: s.keyword('labelDecoration') === 'underline' ? 'underline' : 'none' }]}>{label}</Text>
            <ViewIcon name={s.icon('chevron') ?? 'chevron-down'} size={s.size('chevronSize')} tone={s.color('labelTone')} />
          </>
        ) : (
          <ViewIcon name={(node.icon as string | undefined) ?? 'more-vertical'} size={s.size('iconSize')} tone={tone} />
        )}
      </Pressable>
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable aria-label="Close menu" style={{ flex: 1 }} onPress={() => setOpen(false)}>
          <View
            role="menu"
            onStartShouldSetResponder={() => true}
            style={{
              position: 'absolute',
              top: anchor ? anchor.y + anchor.h : 0,
              right: 8,
              minWidth: s.size('minWidth'),
              backgroundColor: s.color('fill') ?? m.color.surface,
              borderRadius: s.radius('radius'),
              padding: s.space('padding'),
              ...(shadow ? { boxShadow: shadowCss(shadow) } : {}),
            }}
          >
            {items.map((item, i) => (
              <MenuRow key={i} item={item} textStyle={itemText} iconSize={s.size('iconSize')} tone={itemTone} onDone={() => setOpen(false)} />
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

interface Section {
  open: boolean;
  toggle: () => void;
}
const AccordionSectionContext = createContext<Section | null>(null);

const DISCLOSURE_STYLE: StyleSpec = { tone: 'color', iconSize: 'size', gap: 'space', iconGap: 'space' };

export function DisclosureView({ node, style }: NodeViewProps) {
  const ctx = useViewContext();
  const m = ctx.manifest;
  const section = useContext(AccordionSectionContext);
  const s = styledLook(m, { type: 'disclosure', spec: DISCLOSURE_STYLE, style: node.style, look: node.look, defaultLook: 'plain' });
  const [ownOpen, setOwnOpen] = useDraft(node, 'open', node.open === true);
  const open = section ? section.open : ownOpen;
  const initiallyOpen = useRef(open);
  const reduced = useReducedMotion();
  const rotate = useRef(new Animated.Value(open ? 1 : 0)).current;
  const fade = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      rotate.setValue(open ? 1 : 0);
      fade.setValue(open ? 1 : 0);
      return;
    }
    const cfg = { toValue: open ? 1 : 0, duration: FADE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true };
    Animated.parallel([Animated.timing(rotate, cfg), Animated.timing(fade, cfg)]).start();
  }, [open, reduced, rotate, fade]);

  const onExpand = (node.tracking as { onExpand?: TrackingEvent } | undefined)?.onExpand;
  const toggle = () => {
    const next = !open;
    if (section) section.toggle();
    else setOwnOpen(next);
    if (next) {
      const ev = withTarget(onExpand, node.id ? { id: node.id } : { index: 0 });
      if (ev) ctx.onTrack(ev);
    }
  };
  const tone = s.color('tone', node.tone);
  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const detailOpacity = initiallyOpen.current && open ? 1 : fade;
  return (
    <AccordionSectionContext.Provider value={null}>
      <View style={[{ gap: s.space('gap', node.gap) }, style]}>
        <Pressable
          role="button"
          aria-expanded={open}
          disabled={ctx.inert}
          onPress={toggle}
          style={{ flexDirection: 'row', alignItems: 'center', gap: s.space('iconGap') }}
        >
          <View style={{ flex: 1 }}>
            <ViewNodeRenderer node={node.summary as ViewNode} />
          </View>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <ViewIcon name="chevron-down" size={s.size('iconSize')} tone={tone} />
          </Animated.View>
        </Pressable>
        {open ? (
          <Animated.View style={{ opacity: detailOpacity }}>
            <ViewNodeRenderer node={node.detail as ViewNode} />
          </Animated.View>
        ) : null}
      </View>
    </AccordionSectionContext.Provider>
  );
}

function startsOpen(node: ViewNode, depth = 0): boolean {
  if (depth > 32) return false;
  if (node.type === 'disclosure') return node.open === true;
  if (node.type === 'accordion') return false;
  for (const v of Object.values(node)) {
    const list = Array.isArray(v) ? v : [v];
    for (const c of list) {
      if (c && typeof c === 'object' && typeof (c as ViewNode).type === 'string' && startsOpen(c as ViewNode, depth + 1)) return true;
    }
  }
  return false;
}

export function AccordionView({ node, style }: NodeViewProps) {
  const ctx = useViewContext();
  const children = (node.children as ViewNode[]) ?? [];
  const initial = children.findIndex((c) => startsOpen(c));
  const [openIndex, setOpenIndex] = useDraft<number>(node, `open:${initial}`, initial);
  const onExpand = (node.tracking as { onExpand?: TrackingEvent } | undefined)?.onExpand;
  const wrap = (child: ViewNode, i: number, el: ReactNode) => (
    <AccordionSectionContext.Provider
      value={{
        open: openIndex === i,
        toggle: () => {
          const next = openIndex === i ? -1 : i;
          setOpenIndex(next);
          if (next === i) {
            const ev = withTarget(onExpand, { index: i, ...(child.id ? { id: child.id } : {}) });
            if (ev) ctx.onTrack(ev);
          }
        },
      }}
    >
      {el}
    </AccordionSectionContext.Provider>
  );
  return <StackLayout node={node as StackFields} style={style as never} wrapChild={wrap} />;
}

const TABS_STYLE: StyleSpec = {
  text: 'text',
  activeText: 'text',
  tone: 'color',
  activeTone: 'color',
  bar: 'color',
  line: 'stroke',
  height: 'size',
  barHeight: 'size',
  gap: 'space',
  paneGap: 'space',
  paddingTop: 'space',
  barRadius: 'radius',
  trackFill: 'color',
  trackRadius: 'radius',
  activeFill: 'color',
  activeRadius: 'radius',
  inset: 'space',
};

export function TabsView({ node, style }: NodeViewProps) {
  const ctx = useViewContext();
  const m = ctx.manifest;
  const s = styledLook(m, { type: 'tabs', spec: TABS_STYLE, style: node.style, look: node.look, defaultLook: 'underline' });
  const labels = node.labels as string[];
  const panes = (node.children as ViewNode[]) ?? [];
  const [stored, setStored] = useDraft<number>(node, 'tab', 0);
  const index = stored < panes.length ? stored : 0;
  const onSelect = (node.tracking as { onSelect?: TrackingEvent } | undefined)?.onSelect;
  const line = s.stroke('line');
  const barRadius = s.radius('barRadius');
  const pane = panes[index];
  const web = Platform.OS === 'web';
  const strip = useRef<unknown>(null);
  useWebDragScroll(strip);
  const activeFill = s.color('activeFill');
  const select = (i: number) => {
    if (i === index) return;
    setStored(i);
    const p = panes[i];
    const ev = withTarget(onSelect, p?.id ? { id: p.id, index: i } : { label: labels[i]!, index: i });
    if (ev) ctx.onTrack(ev);
  };
  if (activeFill) {
    const inset = s.space('inset') ?? 4;
    return (
      <View style={[{ gap: s.space('paneGap') }, style]}>
        <View
          role={web ? 'tablist' : undefined}
          style={{ flexDirection: 'row', height: s.size('height'), padding: inset, backgroundColor: s.color('trackFill'), borderRadius: s.radius('trackRadius') }}
        >
          {labels.map((label, i) => {
            const active = i === index;
            return (
              <Pressable
                key={i}
                role="tab"
                aria-selected={active}
                accessibilityHint={`${i + 1} of ${labels.length}`}
                disabled={ctx.inert}
                onPress={() => select(i)}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: s.radius('activeRadius'), backgroundColor: active ? activeFill : undefined }}
              >
                <Text style={[(active ? s.text('activeText') : s.text('text')) ?? null, { color: active ? s.color('activeTone') : s.color('tone') }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        {pane ? (
          <View role={web ? 'tabpanel' : undefined} key={index}>
            <ViewNodeRenderer node={pane} />
          </View>
        ) : null}
      </View>
    );
  }
  return (
    <View style={[{ gap: s.space('paneGap') }, style]}>
      <ScrollView
        ref={strip as never}
        horizontal
        showsHorizontalScrollIndicator={false}
        role={web ? 'tablist' : undefined}
        style={line ? { borderBottomWidth: line.width, borderBottomColor: line.color } : undefined}
        contentContainerStyle={{ gap: s.space('gap'), paddingTop: s.space('paddingTop') }}
      >
        {labels.map((label, i) => {
          const active = i === index;
          return (
            <Pressable
              key={i}
              role="tab"
              aria-selected={active}
              accessibilityHint={`${i + 1} of ${labels.length}`}
              disabled={ctx.inert}
              onPress={() => {
                if (active) return;
                setStored(i);
                const p = panes[i];
                const ev = withTarget(onSelect, p?.id ? { id: p.id, index: i } : { label, index: i });
                if (ev) ctx.onTrack(ev);
              }}
              style={{ height: s.size('height'), justifyContent: 'center' }}
            >
              <Text style={[(active ? s.text('activeText') : s.text('text')) ?? null, { color: active ? s.color('activeTone') : s.color('tone') }]}>{label}</Text>
              {active ? (
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: s.size('barHeight'),
                    backgroundColor: s.color('bar'),
                    borderTopLeftRadius: barRadius,
                    borderTopRightRadius: barRadius,
                  }}
                />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      {pane ? (
        <View role={web ? 'tabpanel' : undefined} key={index}>
          <ViewNodeRenderer node={pane} />
        </View>
      ) : null}
    </View>
  );
}

export const interactiveViews = {
  menu: MenuView,
  disclosure: DisclosureView,
  accordion: AccordionView,
  tabs: TabsView,
};
