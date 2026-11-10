import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Keyboard, Pressable, Text, TextInput, View, type ViewStyle } from 'react-native';
import { styledLook } from '../../manifest/resolve';
import type { StyleSpec } from '../../manifest/types';
import type { ViewNode } from '../../parse/registry';
import { InertScope, useViewContext, type NodeViewProps } from '../../render/context';
import { useDraft } from '../../render/drafts';
import { FormContext, useForm, type FormInputInfo, type FormState, type FormValue } from '../../render/form';
import { StackLayout, type StackFields } from '../../render/layout';
import { ViewIcon } from '../../render/primitives';
import { ViewNodeRenderer } from '../../render/ViewNodeRenderer';

interface Option {
  id: string;
  label: string;
  caption?: string;
  icon?: string;
  disabled?: boolean;
}

const INPUT_TYPES = new Set(['choice', 'stepper', 'textInput']);

export function collectInputs(nodes: unknown, out: ViewNode[] = [], depth = 0): ViewNode[] {
  if (depth > 64) return out;
  if (Array.isArray(nodes)) {
    for (const n of nodes) collectInputs(n, out, depth + 1);
    return out;
  }
  if (!nodes || typeof nodes !== 'object') return out;
  const node = nodes as ViewNode;
  if (typeof node.type === 'string') {
    if (INPUT_TYPES.has(node.type)) {
      out.push(node);
      return out;
    }
    if (node.type === 'form') return out;
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === 'action' || k === 'tracking' || k === 'style') continue;
    if (v && typeof v === 'object') collectInputs(v, out, depth + 1);
  }
  return out;
}

function initialValue(input: ViewNode): FormValue {
  if (input.type === 'choice') return (input.selected as string[] | undefined) ?? [];
  if (input.type === 'stepper') return input.value as number;
  return (input.value as string | undefined) ?? '';
}

export function reconcile(input: ViewNode, value: FormValue | undefined): FormValue {
  if (input.type === 'choice') {
    const options = input.options as Option[];
    const live = new Set(options.filter((o) => !o.disabled).map((o) => o.id));
    let picked = (Array.isArray(value) ? value : []).filter((id) => live.has(id));
    if (input.mode === 'multi' && typeof input.max === 'number') picked = picked.slice(0, input.max);
    if (input.mode === 'single' && picked.length !== 1) picked = picked.slice(0, 1);
    if (input.mode === 'single' && picked.length === 0) picked = ((input.selected as string[] | undefined) ?? []).filter((id) => live.has(id)).slice(0, 1);
    return picked;
  }
  if (input.type === 'stepper') {
    const n = typeof value === 'number' ? value : (input.value as number);
    return Math.min(input.max as number, Math.max(input.min as number, n));
  }
  const text = typeof value === 'string' ? value : ((input.value as string | undefined) ?? '');
  return typeof input.maxLength === 'number' ? text.slice(0, input.maxLength) : text;
}

function humanOf(input: ViewNode): FormInputInfo['human'] {
  if (input.type === 'choice') {
    const options = input.options as Option[];
    return (v) => {
      const ids = Array.isArray(v) ? v : [];
      if (ids.length === 0) return (input.emptyLabel as string | undefined) ?? '';
      return ids.map((id) => options.find((o) => o.id === id)?.label ?? id).join(', ');
    };
  }
  if (input.type === 'stepper') {
    const unit = input.unit as { one: string; other: string } | undefined;
    return (v) => (unit ? `${v} ${v === 1 ? unit.one : unit.other}` : String(v));
  }
  return (v) => String(v);
}

const sameValue = (a: FormValue | undefined, b: FormValue) => JSON.stringify(a) === JSON.stringify(b);

export function FormView({ node, style }: NodeViewProps) {
  const ctx = useViewContext();
  const inputs = useMemo(() => collectInputs(node.children), [node.children]);
  const [stored, setStored] = useDraft<Record<string, FormValue>>(node, 'values', () =>
    Object.fromEntries(inputs.map((i) => [i.name as string, initialValue(i)])),
  );
  const values = useMemo(() => Object.fromEntries(inputs.map((i) => [i.name as string, reconcile(i, stored[i.name as string])])), [inputs, stored]);
  useEffect(() => {
    if (inputs.some((i) => !sameValue(stored[i.name as string], values[i.name as string]!))) setStored(values);
  }, [inputs, stored, values, setStored]);

  const state = useMemo<FormState>(
    () => ({
      ...(node.id ? { id: node.id } : {}),
      values,
      inputs: Object.fromEntries(inputs.map((i) => [i.name as string, { name: i.name as string, human: humanOf(i) }])),
      valid: inputs.every((i) => i.type !== 'choice' || i.required !== true || (values[i.name as string] as string[]).length > 0),
      locked: !ctx.interactive,
      set: (name, value) => setStored({ ...values, [name]: value }),
    }),
    [node.id, values, inputs, ctx.interactive, setStored],
  );
  return (
    <FormContext.Provider value={state}>
      <StackLayout node={node as StackFields} style={style as never} />
    </FormContext.Provider>
  );
}

const CHOICE_STYLE: StyleSpec = {
  text: 'text',
  tone: 'color',
  captionText: 'text',
  captionTone: 'color',
  divider: 'stroke',
  gap: 'space',
  rowGap: 'space',
  control: 'stroke',
  controlOn: 'stroke',
  controlSize: 'size',
  chipFill: 'color',
  chipStroke: 'stroke',
  chipRadius: 'radius',
  chipPaddingX: 'space',
  chipPaddingY: 'space',
  chipText: 'text',
  chipTone: 'color',
  onFill: 'color',
  onStroke: 'stroke',
  onTone: 'color',
  cardRing: 'stroke',
  cardRadius: 'radius',
  minRow: 'size',
};

function Control({ kind, on, size, ring, ringOn }: { kind: string; on: boolean; size: number; ring?: { width: number; color: string }; ringOn?: { width: number; color: string } }) {
  const stroke = on ? (ringOn ?? ring) : ring;
  const inner = size * (2 / 3);
  const shape: ViewStyle = {
    width: inner,
    height: inner,
    borderWidth: stroke?.width ?? 2,
    borderColor: stroke?.color,
    borderRadius: kind === 'radio' ? inner : 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: on && kind !== 'radio' ? stroke?.color : undefined,
  };
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={shape}>
        {on && kind === 'radio' ? <View style={{ width: inner / 2, height: inner / 2, borderRadius: inner, backgroundColor: stroke?.color }} /> : null}
        {on && kind !== 'radio' ? <ViewIcon name="check" size={inner - 4} tone="#FFFFFF" /> : null}
      </View>
    </View>
  );
}

export function ChoiceView({ node, style }: NodeViewProps) {
  const ctx = useViewContext();
  const form = useForm()!;
  const m = ctx.manifest;
  const s = styledLook(m, { type: 'choice', spec: CHOICE_STYLE, style: node.style, look: node.look, defaultLook: 'plain' });
  const name = node.name as string;
  const options = node.options as Option[];
  const picked = (form.values[name] as string[] | undefined) ?? [];
  const multi = node.mode === 'multi';
  const max = node.max as number | undefined;
  const locked = form.locked || ctx.spent || ctx.inert;
  const control = (node.control as string | undefined) ?? (multi ? 'checkbox' : 'radio');

  const available = (o: Option) => !o.disabled && (picked.includes(o.id) || !multi || max === undefined || picked.length < max);
  const tap = (o: Option) => {
    if (locked || !available(o)) return;
    let next = picked;
    if (multi) next = picked.includes(o.id) ? picked.filter((x) => x !== o.id) : [...picked, o.id];
    else if (!picked.includes(o.id)) next = [o.id];
    if (next !== picked) form.set(name, next);
    if (node.spend === 'onAction') ctx.spend?.();
  };

  const role = multi ? 'group' : 'radiogroup';
  const divider = s.stroke('divider');

  if (node.display === 'chips') {
    const chipStroke = s.stroke('chipStroke');
    const onStroke = s.stroke('onStroke');
    return (
      <View role={role} aria-label={node.label as string} style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: s.space('gap') }, style]}>
        {options.map((o) => {
          const on = picked.includes(o.id);
          const stroke = on ? (onStroke ?? chipStroke) : chipStroke;
          const tone = on ? s.color('onTone') : s.color('chipTone');
          return (
            <Pressable
              key={o.id}
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={on}
              aria-label={o.label}
              disabled={locked || !available(o)}
              onPress={() => tap(o)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                opacity: available(o) ? 1 : 0.4,
                backgroundColor: on ? s.color('onFill') : s.color('chipFill'),
                borderRadius: s.radius('chipRadius'),
                paddingHorizontal: s.space('chipPaddingX'),
                paddingVertical: s.space('chipPaddingY'),
                ...(stroke ? { borderWidth: stroke.width, borderColor: stroke.color } : {}),
              }}
            >
              {o.icon ? <ViewIcon name={o.icon} size={16} tone={tone} /> : null}
              <Text style={[s.text('chipText') ?? null, { color: tone }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (node.display === 'cards') {
    const trees = (node.children as ViewNode[]) ?? [];
    const ring = s.stroke('cardRing') ?? m.stroke.selected;
    return (
      <View role={role} aria-label={node.label as string} style={[{ gap: s.space('gap') }, style]}>
        {options.map((o, i) => {
          const on = picked.includes(o.id);
          const tree = trees[i];
          return (
            <Pressable
              key={o.id}
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={on}
              disabled={locked || !available(o)}
              onPress={() => tap(o)}
              style={{
                opacity: available(o) ? 1 : 0.4,
                borderRadius: s.radius('cardRadius'),
                borderWidth: ring?.width ?? 2,
                borderColor: on && tree?.type !== 'card' ? ring?.color : 'transparent',
              }}
            >
              {tree ? <InertScope>{<ViewNodeRenderer node={tree.type === 'card' ? { ...tree, selected: on } : tree} />}</InertScope> : null}
            </Pressable>
          );
        })}
      </View>
    );
  }

  const size = s.size('controlSize') ?? 24;
  const leading = control === 'radio' || control === 'checkbox';
  return (
    <View role={role} aria-label={node.label as string} style={[{ gap: s.space('rowGap') }, style]}>
      {options.map((o, i) => {
        const on = picked.includes(o.id);
        const ctl =
          control === 'switch' ? (
            <View style={{ width: 36, height: 20, borderRadius: 10, backgroundColor: on ? s.stroke('controlOn')?.color : m.color.disabled, padding: 2, alignItems: on ? 'flex-end' : 'flex-start' }}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF' }} />
            </View>
          ) : control === 'tick' ? (
            <View style={{ width: size, height: size }}>{on ? <ViewIcon name="check" size={size} tone={s.stroke('controlOn')?.color} /> : null}</View>
          ) : (
            <Control kind={control} on={on} size={size} ring={s.stroke('control')} ringOn={s.stroke('controlOn')} />
          );
        return (
          <View key={o.id} style={{ gap: s.space('rowGap') }}>
            {i > 0 && divider ? <View style={{ height: divider.width, backgroundColor: divider.color }} /> : null}
            <Pressable
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={on}
              aria-label={o.label}
              disabled={locked || !available(o)}
              onPress={() => tap(o)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: s.space('gap'), minHeight: s.size('minRow'), opacity: available(o) ? 1 : 0.4 }}
            >
              {leading ? ctl : null}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.text('text') ?? null, { color: s.color('tone') }]}>{o.label}</Text>
                {o.caption ? <Text style={[s.text('captionText') ?? null, { color: s.color('captionTone') }]}>{o.caption}</Text> : null}
              </View>
              {leading ? null : ctl}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const INPUT_STYLE: StyleSpec = {
  minHeight: 'size',
  paddingX: 'space',
  paddingY: 'space',
  stroke: 'stroke',
  focusStroke: 'stroke',
  radius: 'radius',
  fill: 'color',
  text: 'text',
  tone: 'color',
  placeholderTone: 'color',
  labelText: 'text',
  labelTone: 'color',
  gap: 'space',
};

export function TextInputView({ node, style }: NodeViewProps) {
  const ctx = useViewContext();
  const form = useForm()!;
  const m = ctx.manifest;
  const s = styledLook(m, { type: 'textInput', spec: INPUT_STYLE, style: node.style, look: node.look, defaultLook: 'box' });
  const name = node.name as string;
  const value = (form.values[name] as string | undefined) ?? '';
  const locked = form.locked || ctx.spent || ctx.inert;
  const stroke = s.stroke('stroke');
  const label = node.label as string | undefined;
  const labelText = s.text('labelText');
  const multiline = node.multiline === true;
  const maxLength = node.maxLength as number | undefined;
  return (
    <View
      style={[
        {
          alignSelf: 'stretch',
          minHeight: s.size('minHeight'),
          paddingHorizontal: s.space('paddingX'),
          paddingVertical: s.space('paddingY'),
          backgroundColor: s.color('fill'),
          borderRadius: s.radius('radius'),
          justifyContent: multiline ? 'flex-start' : 'center',
          gap: s.space('gap'),
          ...(stroke ? { borderWidth: stroke.width, borderColor: stroke.color } : {}),
        },
        style,
      ]}
    >
      {label && labelText ? (
        <Text aria-hidden style={[labelText, { color: s.color('labelTone') }]}>
          {label}
        </Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={(t) => form.set(name, maxLength !== undefined ? t.slice(0, maxLength) : t)}
        editable={!locked}
        multiline={multiline}
        maxLength={maxLength}
        placeholder={node.placeholder as string | undefined}
        placeholderTextColor={s.color('placeholderTone')}
        aria-label={label ?? (node.placeholder as string | undefined)}
        selectionColor={m.color.accent}
        cursorColor={m.color.accent}
        style={[s.text('text') ?? null, { color: s.color('tone'), padding: 0, ...({ outlineStyle: 'none' } as object) }]}
      />
    </View>
  );
}

const STEPPER_STYLE: StyleSpec = {
  width: 'size',
  height: 'size',
  paddingX: 'space',
  gap: 'space',
  iconSize: 'size',
  stroke: 'stroke',
  radius: 'radius',
  fill: 'color',
  tone: 'color',
  iconTone: 'color',
  disabledTone: 'color',
  text: 'text',
  labelText: 'text',
  labelTone: 'color',
  captionText: 'text',
  captionTone: 'color',
};
const ROLL_MS = 150;

function Odometer({ value, min, max, lineHeight, gap, textStyle }: { value: number; min: number; max: number; lineHeight: number; gap: number; textStyle: object }) {
  const step = lineHeight + gap;
  const offset = useRef(new Animated.Value(-(value - min) * step)).current;
  const first = useRef(true);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
  }, []);
  useEffect(() => {
    const to = -(value - min) * step;
    if (first.current || reduced) {
      first.current = false;
      offset.setValue(to);
      return;
    }
    Animated.timing(offset, { toValue: to, duration: ROLL_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [value, min, step, reduced, offset]);
  const digits = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <View style={{ height: lineHeight, overflow: 'hidden', alignItems: 'center' }} aria-hidden>
      <Animated.View style={{ transform: [{ translateY: offset }], gap }}>
        {digits.map((d) => (
          <Text key={d} style={[textStyle, { height: lineHeight, textAlign: 'center' }]}>
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

export function StepperView({ node, style }: NodeViewProps) {
  const ctx = useViewContext();
  const form = useForm()!;
  const m = ctx.manifest;
  const s = styledLook(m, { type: 'stepper', spec: STEPPER_STYLE, style: node.style, look: node.look, defaultLook: 'box' });
  const name = node.name as string;
  const min = node.min as number;
  const max = node.max as number;
  const value = (form.values[name] as number | undefined) ?? (node.value as number);
  const locked = form.locked || ctx.spent || ctx.inert;
  const unit = node.unit as { one: string; other: string } | undefined;
  const textToken = s.textToken('text');
  const lineHeight = textToken?.lineHeight ?? 0;
  const stroke = s.stroke('stroke');
  const iconSize = s.size('iconSize');
  const canDown = !locked && value > min;
  const canUp = !locked && value < max;
  const set = (next: number) => {
    Keyboard.dismiss();
    form.set(name, Math.min(max, Math.max(min, next)));
  };
  const spoken = unit ? `${value} ${value === 1 ? unit.one : unit.other}` : String(value);
  const label = node.label as string;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 }, style]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.text('labelText') ?? null, { color: s.color('labelTone') }]}>{label}</Text>
        {node.caption ? (
          <Text aria-hidden style={[s.text('captionText') ?? null, { color: s.color('captionTone') }]}>
            {node.caption as string}
          </Text>
        ) : null}
      </View>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text: spoken }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment' && canUp) set(value + 1);
          if (e.nativeEvent.actionName === 'decrement' && canDown) set(value - 1);
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: s.size('width'),
          height: s.size('height'),
          paddingHorizontal: s.space('paddingX'),
          backgroundColor: s.color('fill'),
          borderRadius: s.radius('radius'),
          ...(stroke ? { borderWidth: stroke.width, borderColor: stroke.color } : {}),
        }}
      >
        <Pressable role="button" aria-label={`Decrease ${label}`} disabled={!canDown} onPress={() => set(value - 1)} hitSlop={8}>
          <ViewIcon name="remove" size={iconSize} tone={canDown ? s.color('iconTone') : s.color('disabledTone')} />
        </Pressable>
        <Odometer value={value} min={min} max={max} lineHeight={lineHeight} gap={s.space('gap') ?? 12} textStyle={[s.text('text') ?? null, { color: s.color('tone') }]} />
        <Pressable role="button" aria-label={`Increase ${label}`} disabled={!canUp} onPress={() => set(value + 1)} hitSlop={8}>
          <ViewIcon name="add" size={iconSize} tone={canUp ? s.color('iconTone') : s.color('disabledTone')} />
        </Pressable>
      </View>
    </View>
  );
}

export const formViews = {
  form: FormView,
  choice: ChoiceView,
  stepper: StepperView,
  textInput: TextInputView,
};
