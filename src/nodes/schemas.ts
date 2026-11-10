import { z } from 'zod';
import { menuAction, spanAction, viewAction } from '../wire/actions';
import {
  align3,
  align4,
  aspectValue,
  iconName,
  INPUT_NAME,
  lenient,
  nonEmpty,
  padding,
  RESERVED_INPUT_NAMES,
  sizeValue,
  spaceValue,
  styleRecord,
  toggleLabels,
  tokenName,
  viewImage,
} from '../wire/primitives';
import type { ViewNodeDefinition } from '../parse/registry';

type Shape = z.ZodRawShape;
const node = <T extends Shape>(shape: T) => z.object(shape);
const nodeList = z.array(z.unknown());
const requiredNode = z.unknown().refine((v) => v !== undefined, 'required');

const base = {
  id: lenient(nonEmpty),
  grow: lenient(z.boolean()),
};
const styled = { ...base, style: styleRecord };
const spend = { spend: lenient(z.literal('onAction')) };
const lookFields = { look: lenient(tokenName) };
const short = z.string().min(1).max(60);

export const stackLayout = {
  direction: z.enum(['vertical', 'horizontal']).optional(),
  justify: z.enum(['start', 'center', 'end', 'between']).optional(),
  align: lenient(align4),
  gap: lenient(spaceValue),
  overlap: lenient(spaceValue),
  dividerInset: spaceValue.optional(),
  padding: lenient(padding),
  width: lenient(sizeValue),
  minHeight: lenient(sizeValue),
  wrap: lenient(z.boolean()),
  dividers: lenient(z.boolean()),
  overlapOrder: lenient(z.enum(['earlier', 'later'])),
  collapseAfter: z.number().int().min(1).max(20).optional(),
  collapseLabel: lenient(toggleLabels),
};

export const textSpan = z.object({
  text: z.string(),
  weight: lenient(z.enum(['regular', 'medium', 'semibold', 'bold', 'extrabold', 'black'])),
  tone: lenient(tokenName),
  style: lenient(tokenName),
  strike: lenient(z.boolean()),
  italic: lenient(z.boolean()),
  underline: lenient(z.boolean()),
  shift: lenient(z.enum(['up', 'down'])),
  action: lenient(spanAction),
});
export type TextSpan = z.infer<typeof textSpan>;

const unique = <T>(xs: readonly T[]) => new Set(xs).size === xs.length;

const stack: ViewNodeDefinition = {
  type: 'stack',
  schema: node({ ...styled, ...stackLayout, ...spend, children: nodeList }),
  slots: { list: ['children'] },
  tracking: [],
  drafts: true,
  spendScope: true,
};

const text: ViewNodeDefinition = {
  type: 'text',
  schema: node({
    ...base,
    style: tokenName,
    value: z.string().optional(),
    spans: z.array(textSpan).min(1).optional(),
    tone: lenient(tokenName),
    align: lenient(align3),
    gradient: lenient(tokenName),
    maxLines: z.number().int().min(1).max(20).optional(),
    readMore: lenient(toggleLabels),
    role: lenient(z.literal('heading')),
  }).superRefine((n, ctx) => {
    if ((n.value === undefined) === (n.spans === undefined)) ctx.addIssue({ code: 'custom', message: 'exactly one of value or spans' });
    if (n.readMore !== undefined && n.maxLines === undefined) ctx.addIssue({ code: 'custom', path: ['readMore'], message: 'readMore needs maxLines' });
  }),
  tracking: [],
};

const markdown: ViewNodeDefinition = {
  type: 'markdown',
  schema: node({ ...base, value: z.string().min(1).max(2000) }),
  tracking: [],
};

const icon: ViewNodeDefinition = {
  type: 'icon',
  schema: node({ ...styled, name: iconName, tone: lenient(tokenName), size: lenient(tokenName) }),
  tracking: [],
};

const image: ViewNodeDefinition = {
  type: 'image',
  schema: node({
    ...styled,
    ...lookFields,
    images: z.array(viewImage).length(1),
    role: lenient(tokenName),
    aspect: lenient(tokenName),
    radius: lenient(tokenName),
  }),
  tracking: [],
};

const pill: ViewNodeDefinition = {
  type: 'pill',
  schema: node({
    ...styled,
    ...lookFields,
    label: nonEmpty,
    icon: lenient(iconName),
    tone: lenient(tokenName),
    variant: lenient(tokenName),
    hue: lenient(tokenName),
    align: lenient(align4),
    shape: lenient(z.enum(['pill', 'circle', 'square'])),
  }),
  tracking: [],
};

const button: ViewNodeDefinition = {
  type: 'button',
  schema: node({
    ...styled,
    ...lookFields,
    action: viewAction,
    label: z.union([nonEmpty, z.array(textSpan).min(1)]).optional(),
    accessibilityLabel: nonEmpty.optional(),
    leadingIcon: lenient(iconName),
    trailingIcon: lenient(iconName),
    variant: lenient(tokenName),
    size: lenient(z.enum(['md', 'sm'])),
    fullWidth: lenient(z.boolean()),
    disabled: lenient(z.boolean()),
    ignoreFormValidity: lenient(z.boolean()),
  }).superRefine((n, ctx) => {
    if (n.label !== undefined) return;
    const icons = Number(n.leadingIcon !== undefined) + Number(n.trailingIcon !== undefined);
    if (n.accessibilityLabel === undefined || icons !== 1) {
      ctx.addIssue({ code: 'custom', message: 'needs a label, or an accessibilityLabel and exactly one icon' });
    }
  }),
  tracking: [],
  readsForm: true,
};

export const menuItem = z.object({ label: nonEmpty, icon: lenient(iconName), action: menuAction });

const menu: ViewNodeDefinition = {
  type: 'menu',
  schema: node({
    id: lenient(nonEmpty),
    style: styleRecord,
    ...lookFields,
    ...spend,
    items: z.array(menuItem).min(1).max(8),
    icon: lenient(iconName),
    label: lenient(nonEmpty),
    accessibilityLabel: lenient(nonEmpty),
  }),
  tracking: 'single',
  lenientEntries: [{ field: 'items', entry: menuItem, shape: 'list' }],
  spendScope: true,
};

const indicator: ViewNodeDefinition = {
  type: 'indicator',
  schema: node({ ...base, ...lookFields, style: lenient(z.union([tokenName, z.record(z.string(), z.unknown())])) }),
  tracking: [],
};

const divider: ViewNodeDefinition = {
  type: 'divider',
  schema: node({ ...base, orientation: z.enum(['horizontal', 'vertical']).optional(), stroke: lenient(tokenName) }),
  tracking: [],
};

const background = z
  .object({
    images: z.array(viewImage).min(1).optional(),
    gradient: tokenName.optional(),
    scrim: z.object({ top: tokenName.optional(), bottom: tokenName.optional() }).optional(),
  })
  .refine((b) => b.images !== undefined || b.gradient !== undefined, 'background needs images or gradient');

const card: ViewNodeDefinition = {
  type: 'card',
  schema: node({
    ...styled,
    ...stackLayout,
    ...lookFields,
    surface: lenient(tokenName),
    hue: lenient(tokenName),
    radius: lenient(tokenName),
    aspect: lenient(aspectValue),
    selected: lenient(z.boolean()),
    action: viewAction.optional(),
    longPress: lenient(nonEmpty),
    background: background.optional(),
    children: nodeList,
  }),
  slots: { list: ['children'] },
  tracking: [],
};

export const itemWidth = z.union([sizeValue, z.object({ max: sizeValue, peek: spaceValue.optional() })]);
const rowFields = {
  ...styled,
  ...spend,
  itemWidth: lenient(itemWidth),
  gap: lenient(spaceValue),
  bleed: lenient(z.boolean()),
  align: lenient(z.enum(['stretch', 'start'])),
};

const scrollRow: ViewNodeDefinition = {
  type: 'scroll-row',
  schema: node({ ...rowFields, children: nodeList }),
  slots: { list: ['children'] },
  tracking: ['onSelect'],
  spendScope: true,
};

const carousel: ViewNodeDefinition = {
  type: 'carousel',
  schema: node({ ...rowFields, ...lookFields, children: nodeList.min(1).max(10), front: nonEmpty.optional(), dots: lenient(tokenName) }),
  slots: { list: ['children'] },
  tracking: ['onSelect'],
  spendScope: true,
};

const grid: ViewNodeDefinition = {
  type: 'grid',
  schema: node({
    ...styled,
    ...spend,
    columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    children: nodeList.min(1),
    gap: lenient(spaceValue),
    rowGap: lenient(spaceValue),
    align: lenient(align4),
  }),
  slots: { list: ['children'] },
  tracking: [],
  spendScope: true,
};

const overlayAnchor = z.enum(['top-start', 'top', 'top-end', 'bottom-start', 'bottom', 'bottom-end', 'center', 'fill']);
const overlay: ViewNodeDefinition = {
  type: 'overlay',
  schema: node({
    ...styled,
    base: requiredNode,
    layers: z
      .array(
        z.object({
          anchor: overlayAnchor,
          inset: lenient(z.union([tokenName, z.object({ x: tokenName.optional(), y: tokenName.optional() })])),
          node: requiredNode,
        }),
      )
      .min(1)
      .max(3),
  }),
  slots: { node: ['base'], entry: [{ field: 'layers', key: 'node' }], inert: { layers: 'an overlay layer' } },
  tracking: [],
};

const rating: ViewNodeDefinition = {
  type: 'rating',
  schema: node({
    ...styled,
    ...lookFields,
    value: z.number().min(0).max(5),
    variant: lenient(tokenName),
    hue: lenient(tokenName),
    countLabel: lenient(nonEmpty),
    word: lenient(nonEmpty),
  }),
  tracking: [],
};

const table: ViewNodeDefinition = {
  type: 'table',
  schema: node({
    ...styled,
    ...lookFields,
    columns: z.array(z.object({ label: nonEmpty, width: lenient(tokenName) })).min(1).max(6),
    children: nodeList.min(1).optional(),
    rows: z.array(z.object({ cells: nodeList })).min(1).optional(),
    bleed: lenient(z.boolean()),
  }).superRefine((n, ctx) => {
    if ((n.children === undefined) === (n.rows === undefined)) ctx.addIssue({ code: 'custom', message: 'exactly one of children or rows' });
    if (n.children && n.children.length % n.columns.length !== 0) ctx.addIssue({ code: 'custom', path: ['children'], message: 'not a multiple of columns' });
    n.rows?.forEach((r, i) => {
      if (r.cells.length !== n.columns.length) ctx.addIssue({ code: 'custom', path: ['rows', i, 'cells'], message: 'cell count differs from columns' });
    });
  }),
  slots: { list: ['children'], whole: ['children'], grid: [{ field: 'rows', key: 'cells' }] },
  tracking: [],
};

const timeline: ViewNodeDefinition = {
  type: 'timeline',
  schema: node({
    ...styled,
    ...lookFields,
    children: nodeList.min(1),
    markers: z.array(z.enum(['done', 'pending']).catch('pending')).optional(),
  }).refine((n) => n.markers === undefined || n.markers.length === n.children.length, {
    path: ['markers'],
    message: 'one marker per child',
  }),
  slots: { list: ['children'], paired: { children: 'markers' } },
  tracking: [],
};

const disclosure: ViewNodeDefinition = {
  type: 'disclosure',
  schema: node({
    ...styled,
    ...lookFields,
    summary: requiredNode,
    detail: requiredNode,
    open: lenient(z.boolean()),
    gap: lenient(tokenName),
    tone: lenient(tokenName),
  }),
  slots: { node: ['summary', 'detail'] },
  tracking: ['onExpand'],
  drafts: true,
};

const accordion: ViewNodeDefinition = {
  type: 'accordion',
  schema: node({ ...base, ...stackLayout, children: nodeList }),
  slots: { list: ['children'] },
  tracking: ['onExpand'],
  drafts: true,
};

const tabs: ViewNodeDefinition = {
  type: 'tabs',
  schema: node({
    ...styled,
    ...lookFields,
    labels: z.array(z.string().min(1)).min(2).max(6),
    children: nodeList,
  }).refine((n) => n.labels.length === n.children.length, { path: ['labels'], message: 'one label per pane' }),
  slots: { list: ['children'], required: ['children'], paired: { children: 'labels' } },
  tracking: ['onSelect'],
  drafts: true,
};

const form: ViewNodeDefinition = {
  type: 'form',
  schema: node({ ...base, ...stackLayout, children: nodeList }),
  slots: { list: ['children'] },
  tracking: [],
  drafts: true,
  formScope: true,
};

const inputName = z
  .string()
  .regex(INPUT_NAME)
  .refine((n) => !(RESERVED_INPUT_NAMES as readonly string[]).includes(n), 'reserved input name');

const choiceOption = z.object({ id: nonEmpty, label: short, caption: lenient(short), icon: lenient(iconName), disabled: lenient(z.boolean()) });
const choice: ViewNodeDefinition = {
  type: 'choice',
  schema: node({
    ...styled,
    ...lookFields,
    ...spend,
    name: inputName,
    label: short,
    mode: z.enum(['single', 'multi']),
    display: z.enum(['chips', 'list', 'cards']),
    control: lenient(z.enum(['radio', 'checkbox', 'switch', 'tick'])),
    options: z.array(choiceOption).min(1).max(20),
    children: nodeList.optional(),
    selected: z.array(nonEmpty).optional(),
    required: z.boolean().optional(),
    max: z.number().int().min(1).optional(),
    emptyLabel: short.optional(),
  }).superRefine((n, ctx) => {
    const fail = (message: string, path: (string | number)[] = []) => ctx.addIssue({ code: 'custom', path, message });
    if (!unique(n.options.map((o) => o.id))) fail('option ids must be unique', ['options']);
    if ((n.display === 'cards') !== (n.children !== undefined)) fail('children required exactly when display is cards', ['children']);
    if (n.children && n.children.length !== n.options.length) fail('one card per option', ['children']);
    if (n.control !== undefined && n.display !== 'list') fail('control is list-only', ['control']);
    if (n.control === 'switch' && n.mode !== 'multi') fail('switch is multi-only', ['control']);
    if (n.max !== undefined && n.mode !== 'multi') fail('max is multi-only', ['max']);
    if (n.selected) {
      if (n.mode === 'single' && n.selected.length > 1) fail('single takes one selection', ['selected']);
      for (const id of n.selected) {
        const o = n.options.find((x) => x.id === id);
        if (!o || o.disabled) fail(`selected ${id} is missing or disabled`, ['selected']);
      }
      if (n.max !== undefined && n.selected.length > n.max) fail('selected above max', ['selected']);
    }
  }),
  slots: { list: ['children'], required: ['children'], paired: { children: 'options' } },
  tracking: [],
  formInput: true,
  untouchableChildren: 'a choice card',
  spendScope: true,
};

const stepper: ViewNodeDefinition = {
  type: 'stepper',
  schema: node({
    ...styled,
    ...lookFields,
    name: inputName,
    label: short,
    caption: short.optional(),
    value: z.number().int(),
    min: z.number().int().min(0),
    max: z.number().int().max(99),
    unit: z.object({ one: short, other: short }).optional(),
  }).refine((n) => n.min <= n.value && n.value <= n.max, { path: ['value'], message: 'min ≤ value ≤ max' }),
  tracking: [],
  formInput: true,
};

const textInput: ViewNodeDefinition = {
  type: 'textInput',
  schema: node({
    ...styled,
    ...lookFields,
    name: inputName,
    label: short.optional(),
    placeholder: z.string().min(1).max(80).optional(),
    value: z.string().max(500).optional(),
    multiline: z.boolean().optional(),
    maxLength: z.number().int().min(1).max(500).optional(),
  }),
  tracking: [],
  formInput: true,
};

const palette = lenient(z.union([tokenName, z.array(tokenName).min(2).max(12)]));
const positive = z.number().finite().gt(0);

const bars: ViewNodeDefinition = {
  type: 'bars',
  schema: node({
    ...styled,
    ...lookFields,
    bars: z.array(z.object({ value: positive, valueLabel: nonEmpty, label: nonEmpty, action: viewAction.optional() })).min(2).max(24),
    selected: z.number().int().min(0),
    badge: nonEmpty.optional(),
    palette,
  }).refine((n) => n.selected < n.bars.length, { path: ['selected'], message: 'selected out of range' }),
  tracking: ['onInspect'],
};

const pie: ViewNodeDefinition = {
  type: 'pie',
  schema: node({
    ...styled,
    ...lookFields,
    slices: z
      .array(
        z.object({
          id: nonEmpty.optional(),
          label: nonEmpty,
          value: positive,
          valueText: nonEmpty.optional(),
          tone: lenient(tokenName),
          icon: lenient(iconName),
          image: lenient(viewImage),
          action: viewAction.optional(),
        }),
      )
      .min(2)
      .max(8),
    palette,
    size: lenient(z.enum(['sm', 'md', 'lg'])),
    legend: lenient(z.boolean()),
    total: lenient(z.object({ label: nonEmpty, valueText: nonEmpty })),
    accessibilityLabel: lenient(nonEmpty),
  }),
  tracking: ['onInspect'],
};

const finite = z.number().finite();
const lines = z.array(nonEmpty).min(1).max(2);
const trend: ViewNodeDefinition = {
  type: 'trend',
  schema: node({
    ...styled,
    ...lookFields,
    points: z.array(finite).min(2).max(90),
    range: lenient(z.object({ min: finite, max: finite })),
    yLabels: lenient(z.array(nonEmpty).min(2).max(6)),
    xLabels: z.array(nonEmpty).min(2).max(8),
    markers: z
      .array(
        z.object({
          index: z.number().int().min(0),
          lines,
          look: lenient(tokenName),
          kind: lenient(tokenName),
          place: lenient(z.literal('below')),
        }),
      )
      .max(2)
      .optional(),
    readouts: z.array(lines).optional(),
  }).superRefine((n, ctx) => {
    n.markers?.forEach((m, i) => {
      if (m.index >= n.points.length) ctx.addIssue({ code: 'custom', path: ['markers', i, 'index'], message: 'index past points' });
    });
    if (n.readouts && n.readouts.length !== n.points.length) ctx.addIssue({ code: 'custom', path: ['readouts'], message: 'one readout per point' });
  }),
  tracking: ['onInspect'],
};

const MONTH = /^(19\d\d|20\d\d|21\d\d)-(0[1-9]|1[0-2])$/;
const daysIn = (ym: string) => {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
const nextMonth = (ym: string) => {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};
export const calendarMark = z.object({
  icon: iconName,
  tone: tokenName.optional(),
  size: sizeValue.optional(),
  anchor: overlayAnchor,
  inset: z.union([tokenName, z.object({ x: tokenName.optional(), y: tokenName.optional() })]).optional(),
});
const calendarDay = z.object({
  body: z.unknown().optional(),
  look: lenient(tokenName),
  marks: z.array(z.string()).optional(),
  action: viewAction.optional(),
});
const calendar: ViewNodeDefinition = {
  type: 'calendar',
  schema: node({
    ...styled,
    ...lookFields,
    weekdays: z.array(z.string()).length(7),
    weekStart: z.number().int().min(0).max(6),
    months: z.array(z.object({ month: z.string().regex(MONTH), title: nonEmpty, days: z.array(calendarDay) })).min(1).max(12),
    marks: z.record(tokenName, calendarMark).optional(),
    labels: lenient(z.record(tokenName, nonEmpty)),
    looks: lenient(z.record(tokenName, nonEmpty)),
    dayAction: viewAction.optional(),
  })
    .superRefine((n, ctx) => {
      n.months.forEach((m, i) => {
        if (m.days.length !== daysIn(m.month)) ctx.addIssue({ code: 'custom', path: ['months', i, 'days'], message: 'one entry per day' });
        const prev = n.months[i - 1];
        if (prev && nextMonth(prev.month) !== m.month) ctx.addIssue({ code: 'custom', path: ['months', i, 'month'], message: 'months must be consecutive' });
      });
    })
    .transform(({ looks, ...n }) => {
      const known = new Set(Object.keys(n.marks ?? {}));
      return {
        ...n,
        labels: looks || n.labels ? { ...looks, ...n.labels } : undefined,
        months: n.months.map((m) => ({
          ...m,
          days: m.days.map((d) => ({ ...d, marks: [...new Set(d.marks ?? [])].filter((x) => known.has(x)) })),
        })),
      };
    }),
  lenientEntries: [{ field: 'marks', entry: calendarMark, shape: 'record' }],
  inner: {
    scope: 'a calendar cell',
    visit(cal, walk) {
      (cal.months as { days: { body?: unknown }[] }[]).forEach((m, mi) =>
        m.days.forEach((d, di) => {
          if (d.body === undefined || d.body === null) return;
          d.body = walk(d.body, `months[${mi}].days[${di}].body`);
        }),
      );
    },
  },
  tracking: [],
};

export const NODE_DEFINITIONS: readonly ViewNodeDefinition[] = [
  stack,
  text,
  markdown,
  icon,
  image,
  pill,
  button,
  menu,
  indicator,
  divider,
  card,
  scrollRow,
  carousel,
  grid,
  overlay,
  rating,
  table,
  timeline,
  disclosure,
  accordion,
  tabs,
  form,
  choice,
  stepper,
  textInput,
  bars,
  pie,
  trend,
  calendar,
];

export const NODE_TYPES = [
  'stack', 'text', 'markdown', 'icon', 'image', 'pill', 'button', 'menu', 'indicator', 'divider',
  'card', 'scroll-row', 'carousel', 'grid', 'overlay', 'rating', 'table', 'timeline', 'disclosure',
  'accordion', 'tabs', 'form', 'choice', 'stepper', 'textInput', 'bars', 'pie', 'trend', 'calendar',
] as const;
export type ViewNodeType = (typeof NODE_TYPES)[number];
