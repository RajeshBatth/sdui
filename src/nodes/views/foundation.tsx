import { useState } from 'react';
import { Pressable, Text, View, type TextStyle } from 'react-native';
import { resolveToken, textStyleOf } from '../../manifest/resolve';
import type { Manifest } from '../../manifest/types';
import { useViewContext, type NodeViewProps } from '../../render/context';
import { StackLayout, type StackFields } from '../../render/layout';
import { usePress } from '../../render/primitives';
import type { ViewAction } from '../../wire/actions';
import type { TextSpan } from '../schemas';

export function StackView({ node, style }: NodeViewProps) {
  return <StackLayout node={node as StackFields} style={style as never} />;
}

const TEXT_ALIGN: Record<string, TextStyle['textAlign']> = { start: 'left', center: 'center', end: 'right' };
const FACE: Record<string, TextStyle['fontWeight']> = { regular: '400', medium: '500', semibold: '600', bold: '700', extrabold: '800', black: '900' };

export function textBase(m: Manifest, styleName: unknown, tone: unknown, spent: boolean): TextStyle {
  const t = resolveToken(m, 'text', styleName) ?? m.text.body!;
  const color = spent ? m.color.spentText : (resolveToken(m, 'color', tone) ?? m.color.primary);
  return { ...textStyleOf(t, m.font), color };
}

function SpanView({ span, base }: { span: TextSpan; base: TextStyle }) {
  const ctx = useViewContext();
  const m = ctx.manifest;
  const press = usePress(span.action as ViewAction | undefined);
  const t = span.style ? resolveToken(m, 'text', span.style) : undefined;
  const lineHeight = (t?.lineHeight ?? base.lineHeight ?? 20) as number;
  const fontSize = (t?.size ?? base.fontSize ?? 14) as number;
  const s: TextStyle = {
    ...(t ? textStyleOf(t, m.font) : {}),
    ...(span.weight ? { fontWeight: FACE[span.weight] } : {}),
    ...(span.tone ? { color: resolveToken(m, 'color', span.tone) } : {}),
    ...(span.italic ? { fontStyle: 'italic' } : {}),
    ...(span.strike || span.underline
      ? { textDecorationLine: span.strike && span.underline ? 'underline line-through' : span.strike ? 'line-through' : 'underline' }
      : {}),
    ...(span.shift
      ? {
          fontSize: fontSize * 0.7,
          lineHeight,
          ...({ position: 'relative', top: span.shift === 'up' ? -0.3 * lineHeight : 0.1 * lineHeight } as unknown as TextStyle),
        }
      : {}),
    ...(press.available ? { color: m.color.accent, textDecorationLine: 'underline' } : {}),
  };
  return (
    <Text style={s} onPress={press.onPress} role={press.available ? 'link' : undefined}>
      {span.text}
    </Text>
  );
}

export function TextView({ node, style }: NodeViewProps) {
  const ctx = useViewContext();
  const m = ctx.manifest;
  const base = textBase(m, node.style, node.tone, ctx.spent);
  const align = node.align ? { textAlign: TEXT_ALIGN[node.align as string] } : null;
  const maxLines = node.maxLines as number | undefined;
  const readMore = node.readMore as { more?: string; less?: string } | undefined;
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(false);
  const [fullHeight, setFullHeight] = useState(0);
  const spans = node.spans as TextSpan[] | undefined;
  const content = spans ? spans.map((s, i) => <SpanView key={i} span={s} base={base} />) : (node.value as string);
  const heading = node.role === 'heading' || resolveToken(m, 'text', node.style)?.role === 'heading';
  const canToggle = readMore !== undefined && maxLines !== undefined && !ctx.inert;
  const lineHeight = (base.lineHeight ?? 20) as number;

  const firstWords = (node.value ?? spans?.map((s) => s.text).join('') ?? '').toString().split(/\s+/).slice(0, 4).join(' ');
  return (
    <View style={style}>
      <Text
        style={[base, align]}
        numberOfLines={open ? undefined : maxLines}
        role={heading ? 'heading' : undefined}
        accessibilityRole={heading ? 'header' : undefined}
        onLayout={canToggle && !open ? (e) => setCut(fullHeight > e.nativeEvent.layout.height + 1) : undefined}
      >
        {content}
      </Text>
      {canToggle ? (
        <Text
          aria-hidden
          style={[base, align, { position: 'absolute', opacity: 0, left: 0, right: 0 }]}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            setFullHeight(h);
            setCut(h > lineHeight * maxLines! + 1);
          }}
        >
          {content}
        </Text>
      ) : null}
      {canToggle && (cut || open) ? (
        <Pressable role="button" aria-label={firstWords} aria-expanded={open} onPress={() => setOpen(!open)} hitSlop={8}>
          <Text style={[base, { color: m.color.accent }]}>{open ? (readMore.less ?? 'Read less') : (readMore.more ?? 'Read more')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function MarkdownView({ node, style }: NodeViewProps) {
  const ctx = useViewContext();
  const value = (node.value as string).replace(/\\n/g, '\n');
  const Renderer = ctx.renderMarkdown;
  if (!Renderer) return <Text style={[textBase(ctx.manifest, 'body', undefined, ctx.spent), style as never]}>{value}</Text>;
  return <Renderer value={value} style={style} onLink={(url) => ctx.onAction({ kind: 'open-deeplink', url })} />;
}

export const foundationViews: Record<string, (p: NodeViewProps) => React.ReactNode> = {
  stack: StackView,
  text: TextView,
  markdown: MarkdownView,
};
