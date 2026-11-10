import { Fragment, useRef, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Text, View, type ViewStyle } from 'react-native';
import { resolveToken, styledLook } from '../../manifest/resolve';
import type { LookFields, Manifest, StyleSpec } from '../../manifest/types';
import type { ViewNode } from '../../parse/registry';
import { InertScope, useViewContext, type NodeViewProps } from '../../render/context';
import { ownNumber } from '../../render/layout';
import { GradientFill, usePress, ViewIcon } from '../../render/primitives';
import { ViewNodeRenderer } from '../../render/ViewNodeRenderer';
import { useWebDragScroll } from '../../render/dragScroll';
import type { ViewAction } from '../../wire/actions';

export const STRUCTURED_LOOKS: Record<string, Record<string, LookFields>> = {
  table: {
    plain: {
      stroke: 'divider',
      rowLine: 'divider',
      radius: 'md',
      headerFill: 'surfaceMuted',
      headerText: 'label',
      headerTone: 'secondary',
      headerPaddingX: 'md',
      headerPaddingY: 'sm',
      cellPadding: 'md',
    },
  },
  timeline: {
    branch: { line: 'divider', rail: 'iconLg', branchTop: 'md', gap: 'sm', stepGap: 'md' },
    progress: {
      track: 'divider',
      rail: 'iconMd',
      done: 'success',
      pending: 'disabled',
      doneIcon: 'circle-filled',
      pendingIcon: 'circle-outline',
      gap: 'sm',
      stepGap: 'md',
    },
  },
  calendar: {
    plain: {
      titleText: 'heading',
      titleTone: 'primary',
      weekdayText: 'caption',
      weekdayTone: 'tertiary',
      numberText: 'label',
      numberTone: 'primary',
      cellHeight: 'control',
      cellRadius: 'sm',
      cellGap: 'xxs',
      monthGap: 'lg',
    },
  },
  'calendar-day': {
    plain: {},
    selected: { fill: 'accent', numberText: 'label', numberTone: 'onAccent' },
    low: { fill: 'surfaceMuted', numberTone: 'success' },
    unavailable: { numberTone: 'disabled' },
  },
};

const web = Platform.OS === 'web';

const TABLE_STYLE: StyleSpec = {
  stroke: 'stroke',
  rowLine: 'stroke',
  radius: 'radius',
  headerFill: 'color',
  headerText: 'text',
  headerTone: 'color',
  headerPaddingX: 'space',
  headerPaddingY: 'space',
  cellPadding: 'space',
};

const COLUMN_ALIAS: Record<string, string> = { sm: 'columnSm', md: 'columnMd', lg: 'columnLg' };

function columnWidth(m: Manifest, width: unknown): number {
  const name = typeof width === 'string' ? (COLUMN_ALIAS[width] ?? width) : undefined;
  return (name !== undefined ? resolveToken(m, 'size', name) : undefined) ?? m.size.columnMd ?? 120;
}

export function TableView({ node, style }: NodeViewProps) {
  const { manifest: m } = useViewContext();
  const s = styledLook(m, { type: 'table', spec: TABLE_STYLE, style: node.style, look: node.look, defaultLook: 'plain' });
  const columns = node.columns as { label: string; width?: string }[];
  const scroller = useRef<unknown>(null);
  useWebDragScroll(scroller);
  const widths = columns.map((c) => columnWidth(m, c.width));
  const rows: ViewNode[][] = node.rows
    ? (node.rows as { cells: ViewNode[] }[]).map((r) => r.cells)
    : chunk((node.children as ViewNode[]) ?? [], columns.length);
  const stroke = s.stroke('stroke');
  const rule = s.stroke('rowLine');
  const radius = s.radius('radius');
  const pad = s.space('cellPadding');
  const headerText = s.text('headerText');
  const gutter = node.bleed === false ? 0 : (m.space.gutter ?? 0);

  return (
    <ScrollView
      ref={scroller as never}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[gutter ? { marginHorizontal: -gutter } : null, style]}
      contentContainerStyle={{ paddingHorizontal: gutter }}
    >
      <View
        role={web ? 'table' : undefined}
        style={{
          borderRadius: radius,
          overflow: 'hidden',
          ...(stroke ? { borderWidth: stroke.width, borderColor: stroke.color } : {}),
        }}
      >
        <View role={web ? 'row' : undefined} style={{ flexDirection: 'row', backgroundColor: s.color('headerFill') }}>
          {columns.map((c, i) => (
            <View
              key={i}
              role={web ? 'columnheader' : undefined}
              style={{ width: widths[i], paddingHorizontal: s.space('headerPaddingX'), paddingVertical: s.space('headerPaddingY') }}
            >
              <Text style={[headerText ?? null, { color: s.color('headerTone') }]}>{c.label}</Text>
            </View>
          ))}
        </View>
        {rows.map((cells, r) => (
          <View
            key={r}
            role={web ? 'row' : undefined}
            style={{
              flexDirection: 'row',
              ...(r < rows.length - 1 && rule ? { borderBottomWidth: rule.width, borderBottomColor: rule.color } : {}),
            }}
          >
            {cells.map((cell, c) => (
              <View key={c} role={web ? 'cell' : undefined} style={{ width: widths[c], padding: pad }}>
                <ViewNodeRenderer node={cell} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

const TIMELINE_STYLE: StyleSpec = {
  line: 'stroke',
  rail: 'size',
  branchTop: 'space',
  track: 'stroke',
  done: 'color',
  pending: 'color',
  doneIcon: 'icon',
  pendingIcon: 'icon',
  gap: 'space',
  stepGap: 'space',
};

export function TimelineView({ node, style }: NodeViewProps) {
  const { manifest: m } = useViewContext();
  const markers = node.markers as ('done' | 'pending')[] | undefined;
  const progress = markers !== undefined;
  const s = styledLook(m, {
    type: 'timeline',
    spec: TIMELINE_STYLE,
    style: node.style,
    look: node.look,
    defaultLook: progress ? 'progress' : 'branch',
  });
  const children = (node.children as ViewNode[]) ?? [];
  const rail = s.size('rail') ?? 20;
  const gap = s.space('gap') ?? 0;
  const stepGap = s.space('stepGap') ?? 0;
  const center = rail / 2;

  return (
    <View style={style}>
      {children.map((child, i) => {
        const last = i === children.length - 1;
        let railContent: ReactNode;
        if (progress) {
          const state = markers![i] ?? 'pending';
          const tone = s.color(state);
          const track = s.stroke('track');
          const icon = s.icon(state === 'done' ? 'doneIcon' : 'pendingIcon');
          railContent = (
            <>
              {!last && track ? (
                <View
                  style={{
                    position: 'absolute',
                    top: rail,
                    bottom: 0,
                    left: center - track.width / 2,
                    width: track.width,
                    backgroundColor: tone ?? track.color,
                  }}
                />
              ) : null}
              <View accessible role="img" aria-label={state === 'done' ? 'Done' : 'Pending'} style={{ width: rail, height: rail }}>
                <ViewIcon name={icon} size={rail} tone={tone} />
              </View>
            </>
          );
        } else {
          const line = s.stroke('line');
          const branchTop = s.space('branchTop') ?? 0;
          railContent = line ? (
            <>
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: center - line.width / 2,
                  width: line.width,
                  backgroundColor: line.color,
                  ...(last ? { height: branchTop + line.width } : { bottom: 0 }),
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  top: branchTop,
                  left: center,
                  right: 0,
                  height: line.width,
                  backgroundColor: line.color,
                }}
              />
            </>
          ) : null;
        }
        return (
          <View key={child.id ?? i} style={{ flexDirection: 'row', gap }}>
            <View style={{ width: rail, alignSelf: 'stretch' }}>{railContent}</View>
            <View style={{ flex: 1, paddingBottom: last ? 0 : stepGap }}>
              <ViewNodeRenderer node={child} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const CALENDAR_STYLE: StyleSpec = {
  titleText: 'text',
  titleTone: 'color',
  weekdayText: 'text',
  weekdayTone: 'color',
  numberText: 'text',
  numberTone: 'color',
  cellFill: 'color',
  cellGradient: 'gradient',
  cellStroke: 'stroke',
  cellRadius: 'radius',
  cellHeight: 'size',
  cellGap: 'space',
  monthGap: 'space',
};

const DAY_STYLE: StyleSpec = { fill: 'color', gradient: 'gradient', stroke: 'stroke', numberText: 'text', numberTone: 'color' };

interface CalendarMark {
  icon: string;
  tone?: string;
  size?: string | number;
  anchor: string;
  inset?: string | { x?: string; y?: string };
}
interface CalendarDay {
  body?: ViewNode | null;
  look?: string;
  marks?: string[];
  action?: ViewAction;
}
interface CalendarMonth {
  month: string;
  title: string;
  days: CalendarDay[];
}

const FILL = /\{(day|date|month)\}/g;

export function fillDayAction(action: ViewAction, values: { day: string; date: string; month: string }): ViewAction {
  const f = (t: string) => t.replace(FILL, (_, k: 'day' | 'date' | 'month') => values[k]);
  switch (action.kind) {
    case 'message':
    case 'prefill-composer':
      return { ...action, text: f(action.text) };
    case 'open-deeplink':
    case 'open-page':
      return { ...action, url: f(action.url) };
    case 'open-conversation':
      return action.message !== undefined ? { ...action, message: f(action.message) } : action;
    default:
      return action;
  }
}

function markStyle(m: Manifest, anchor: string, inset: CalendarMark['inset']): ViewStyle {
  const x = typeof inset === 'string' ? resolveToken(m, 'space', inset) : ownNumber(m, 'space', inset?.x);
  const y = typeof inset === 'string' ? resolveToken(m, 'space', inset) : ownNumber(m, 'space', inset?.y);
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
    default:
      return { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: anchor === 'fill' ? iy : undefined };
  }
}

function DayCell({
  day,
  date,
  month,
  monthTitle,
  dayAction,
  marks,
  labels,
  cell,
  calendar,
}: {
  day: CalendarDay;
  date: string;
  month: string;
  monthTitle: string;
  dayAction?: ViewAction;
  marks: Record<string, CalendarMark>;
  labels: Record<string, string>;
  cell: ViewStyle;
  calendar: ReturnType<typeof styledLook>;
}) {
  const { manifest: m } = useViewContext();
  const s = styledLook(m, { type: 'calendar-day', spec: DAY_STYLE, look: day.look, defaultLook: 'plain' });
  const dayNum = String(Number(date.slice(8)));
  const hasBody = day.body !== undefined;
  const action = day.action ?? (dayAction && hasBody ? fillDayAction(dayAction, { day: dayNum, date, month }) : undefined);
  const press = usePress(action);
  const stroke = s.stroke('stroke') ?? calendar.stroke('cellStroke');
  const gradient = s.gradient('gradient') ?? calendar.gradient('cellGradient');
  const lookLabel = day.look !== undefined ? labels[day.look] : undefined;
  const a11y = [`${dayNum} ${monthTitle}`, lookLabel].filter(Boolean).join(', ');
  const box: ViewStyle = {
    ...cell,
    backgroundColor: s.color('fill') ?? calendar.color('cellFill'),
    ...(stroke ? { borderWidth: stroke.width, borderColor: stroke.color } : {}),
  };
  const content = (
    <>
      {gradient ? <GradientFill gradient={gradient} radius={cell.borderRadius as number | undefined} /> : null}
      <Text style={[s.text('numberText') ?? calendar.text('numberText') ?? null, { color: s.color('numberTone') ?? calendar.color('numberTone') }, day.body === undefined ? { opacity: 0.5 } : null]}>
        {dayNum}
      </Text>
      <InertScope>
        {day.body ? <ViewNodeRenderer node={day.body} /> : null}
        {(day.marks ?? []).map((name) => {
          const mark = marks[name];
          if (!mark) return null;
          const size = ownNumber(m, 'size', mark.size);
          return (
            <View key={name} pointerEvents="none" style={markStyle(m, mark.anchor, mark.inset)}>
              <ViewIcon name={mark.icon} size={size} tone={resolveToken(m, 'color', mark.tone)} />
            </View>
          );
        })}
      </InertScope>
    </>
  );
  if (!action || !press.available) {
    return (
      <View style={box} accessible aria-label={a11y}>
        {content}
      </View>
    );
  }
  return (
    <Pressable role="button" aria-label={a11y} onPress={press.onPress} disabled={!press.onPress} style={box}>
      {content}
    </Pressable>
  );
}

function firstWeekday(month: string): number {
  const [y, mo] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, mo - 1, 1)).getUTCDay();
}

export function CalendarView({ node, style }: NodeViewProps) {
  const { manifest: m } = useViewContext();
  const s = styledLook(m, { type: 'calendar', spec: CALENDAR_STYLE, style: node.style, look: node.look, defaultLook: 'plain' });
  const months = node.months as CalendarMonth[];
  const weekdays = node.weekdays as string[];
  const weekStart = node.weekStart as number;
  const marks = (node.marks as Record<string, CalendarMark> | undefined) ?? {};
  const labels = (node.labels as Record<string, string> | undefined) ?? {};
  const dayAction = node.dayAction as ViewAction | undefined;
  const cellGap = s.space('cellGap') ?? 0;
  const cell: ViewStyle = {
    flex: 1,
    flexBasis: 0,
    height: s.size('cellHeight'),
    borderRadius: s.radius('cellRadius'),
    alignItems: 'center',
    overflow: 'hidden',
  };
  const blank: ViewStyle = { ...cell, backgroundColor: s.color('cellFill') };

  return (
    <View style={[{ gap: s.space('monthGap') }, style]}>
      {months.map((mo) => {
        const lead = (firstWeekday(mo.month) - weekStart + 7) % 7;
        const slots: (number | null)[] = [...Array<null>(lead).fill(null), ...mo.days.map((_, i) => i)];
        while (slots.length % 7) slots.push(null);
        const weeks: (number | null)[][] = [];
        for (let i = 0; i < slots.length; i += 7) weeks.push(slots.slice(i, i + 7));
        return (
          <View key={mo.month} style={{ gap: cellGap }}>
            {months.length > 1 ? (
              <Text role="heading" style={[s.text('titleText') ?? null, { color: s.color('titleTone') }]}>
                {mo.title}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: cellGap }}>
              {weekdays.map((w, i) => (
                <Text key={i} style={[{ flex: 1, flexBasis: 0, textAlign: 'center' }, s.text('weekdayText') ?? null, { color: s.color('weekdayTone') }]}>
                  {w}
                </Text>
              ))}
            </View>
            {weeks.map((week, wi) => (
              <View key={wi} style={{ flexDirection: 'row', gap: cellGap }}>
                {week.map((d, ci) =>
                  d === null ? (
                    <View key={ci} style={blank} />
                  ) : (
                    <Fragment key={ci}>
                      <DayCell
                        day={mo.days[d]!}
                        date={`${mo.month}-${String(d + 1).padStart(2, '0')}`}
                        month={mo.month}
                        monthTitle={mo.title}
                        dayAction={dayAction}
                        marks={marks}
                        labels={labels}
                        cell={cell}
                        calendar={s}
                      />
                    </Fragment>
                  ),
                )}
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

export const structuredViews = {
  table: TableView,
  timeline: TimelineView,
  calendar: CalendarView,
};
