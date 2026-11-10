/// <reference types="vite/client" />
import { SNAPSHOT_MANIFEST } from '../src/manifest/snapshot';
import { NAMESPACES, type GroupedStory } from './component-types';

const PRIVATE = import.meta.glob<{ GROUPED?: Record<string, GroupedStory> }>('./private/*.ts', { eager: true });
const PRIVATE_COMPONENTS: [string, GroupedStory][] = Object.keys(PRIVATE)
  .sort((a, b) => (a.endsWith('/core.ts') ? -1 : b.endsWith('/core.ts') ? 1 : a.localeCompare(b)))
  .flatMap((path) => Object.entries(PRIVATE[path]!.GROUPED ?? {}));
const PRIVATE_PHOTOS = new Set(Object.keys(import.meta.glob('./public/photos/core/*')).map((p) => p.split('/').pop()!));

export interface FigmaRef {
  file: string;
  node: string;
}

export interface Story {
  id: string;
  title: string;
  section: 'Atoms' | 'Components';
  group: string;
  family?: string;
  prompt: string;
  raw: unknown;
  figma?: FigmaRef;
}


export function figmaUrl(ref: FigmaRef): string {
  return `https://www.figma.com/design/${ref.file}/?node-id=${ref.node.replace(':', '-')}&m=dev`;
}

const t = (style: string, value: string, extra: Record<string, unknown> = {}) => ({ type: 'text', style, value, ...extra });
const msg = (text: string) => ({ kind: 'message', text });
const PHOTOS: Record<string, [string, string]> = {
  a1: ['avatar-1.png', 'Guest'],
  a2: ['avatar-2.png', 'Guest'],
  a3: ['avatar-3.png', 'Guest'],
  taj: ['taj-west-end.jpg', 'Taj West End'],
  itc: ['itc-windsor.jpg', 'ITC Windsor'],
  georgia: ['georgia-hero.jpg', 'Gergeti Trinity Church, Georgia'],
  aarti: ['ganga-aarti.jpg', 'Ganga Aarti, Varanasi'],
  dining: ['deck-dining.png', 'Dining'],
  chandrashila: ['deck-chandrashila.png', 'Sunrise at Chandrashila Peak'],
  chopta: ['deck-chopta-meadow.png', 'Chopta Meadow Walks'],
  deoria: ['deck-deoria-tal.png', 'Deoria Tal Lake Trek'],
};
const img = (key: string) => {
  const [file, alt] = PHOTOS[key]!;
  return { url: PRIVATE_PHOTOS.has(file) ? `/photos/core/${file}` : '/placeholder-photo.svg', alt };
};
const col = (...children: unknown[]) => ({ type: 'stack', gap: 'lg', children });
const row = (...children: unknown[]) => ({ type: 'stack', direction: 'horizontal', gap: 'sm', align: 'center', wrap: true, children });
const labelled = (label: string, node: unknown) => ({ type: 'stack', gap: 'xs', children: [t('overline', label, { tone: 'tertiary' }), node] });

const days = (count: number, body: (d: number) => unknown, look?: (d: number) => string | undefined) =>
  Array.from({ length: count }, (_, i) => {
    const d = i + 1;
    const l = look?.(d);
    return { body: body(d), ...(l ? { look: l } : {}) };
  });

const ATOMS: Record<string, [string, unknown][]> = {
  stack: [
    ['Vertical with gap', col(t('body', 'First'), t('body', 'Second'), t('body', 'Third'))],
    ['Horizontal, space between', { type: 'stack', direction: 'horizontal', justify: 'between', children: [t('body', 'Left'), t('bodyStrong', 'Right')] }],
    ['Dividers', { type: 'stack', gap: 'md', dividers: true, children: [t('body', 'One'), t('body', 'Two'), t('body', 'Three')] }],
    ['Collapse after 2', { type: 'stack', gap: 'sm', collapseAfter: 2, children: ['A', 'B', 'C', 'D'].map((x) => t('body', `Item ${x}`)) }],
    ['Overlap', { type: 'stack', direction: 'horizontal', overlap: 'sm', overlapOrder: 'earlier', children: ['a1', 'a2', 'a3'].map((s) => ({ type: 'image', look: 'avatar', images: [img(s)] })) }],
  ],
  text: [
    [
      'Type scale',
      col(
        ...['sectionTitle', 'heading', 'figure', 'body', 'bodyStrong', 'caption', 'captionMedium', 'captionBold', 'overline', 'micro', 'badge', 'statValue', 'statLabel'].map((s) =>
          t(s, `${s} — The quick brown fox`),
        ),
      ),
    ],
    ['Tones', col(...['primary', 'secondary', 'tertiary', 'title', 'accent', 'link', 'success', 'muted'].map((tone) => t('body', tone, { tone })))],
    [
      'Spans',
      {
        type: 'text',
        style: 'body',
        spans: [
          { text: 'Book ' },
          { text: '6E-1457', weight: 'bold' },
          { text: ' was ' },
          { text: '₹4,000', strike: true, tone: 'tertiary' },
          { text: ' now ₹3,256 · ' },
          { text: 'see fares', action: msg('Show fares') },
        ],
      },
    ],
    ['Read more', t('body', 'Tucked between the Greater and Lesser Caucasus mountain ranges, Georgia is a country of staggering contrasts — ancient cave monasteries, snow-capped peaks, lush wine valleys, and a capital that pulses with contemporary culture.', { maxLines: 2, readMore: {} })],
  ],
  markdown: [['Bullets', { type: 'markdown', value: '- There are no restaurants in Chopta\n- The road closes after heavy snowfall' }]],
  icon: [
    [
      'All icons in the theme',
      {
        type: 'grid',
        columns: 4,
        gap: 'md',
        rowGap: 'lg',
        children: Object.keys(SNAPSHOT_MANIFEST.icon).map((name) => ({
          type: 'stack',
          align: 'center',
          gap: 'xs',
          children: [{ type: 'icon', name, size: 'iconLg', tone: 'primary' }, t('micro', name, { tone: 'tertiary', align: 'center' })],
        })),
      },
    ],
    ['Sizes and tones', row(...['iconXs', 'iconSm', 'iconMd', 'iconLg'].map((size) => ({ type: 'icon', name: 'location', size })), { type: 'icon', name: 'location', size: 'iconLg', tone: 'accent' }, { type: 'icon', name: 'location', size: 'iconLg', tone: 'success' })],
  ],
  image: [
    ['Thumb', { type: 'image', look: 'thumb', images: [img('taj')] }],
    ['Hero', { type: 'image', look: 'hero', images: [img('georgia')] }],
    ['Avatar', { type: 'image', look: 'avatar', images: [img('a1')] }],
  ],
  pill: [
    ['Looks', row(...['chip', 'success', 'count', 'tile'].map((look) => ({ type: 'pill', look, label: look === 'tile' ? '1.' : look === 'success' ? 'CHEAPEST' : look === 'count' ? '+213' : '4h 10m • Non Stop' })))],
    ['Ribbon with icon', { type: 'pill', look: 'ribbon', icon: 'sparkle', label: 'Myra’s Recommendation' }],
  ],
  button: [
    ['Link', { type: 'button', look: 'link', label: 'ask myra', leadingIcon: 'ask', action: msg('ask') }],
    ['Link with chevron', { type: 'button', look: 'link', label: 'View all reviews', trailingIcon: 'chevron-right-sm', action: msg('reviews') }],
    ['Row (suggestion)', { type: 'button', look: 'row', fullWidth: true, label: 'Only evening Flights', trailingIcon: 'reply', action: msg('evening') }],
    ['CTA', { type: 'button', look: 'cta', label: 'Next', action: msg('next') }],
    ['Icon only', { type: 'button', accessibilityLabel: 'Save', leadingIcon: 'bookmark', action: msg('save') }],
    ['Disabled', { type: 'button', look: 'cta', label: 'Next', disabled: true, action: msg('next') }],
  ],
  menu: [
    [
      'Text trigger (dropdown)',
      {
        type: 'stack',
        direction: 'horizontal',
        gap: 'xs',
        align: 'center',
        children: [
          { type: 'text', style: 'heading', value: 'How to reach from' },
          { type: 'menu', label: 'Delhi', items: ['Delhi', 'Mumbai', 'Bengaluru'].map((c) => ({ label: c, action: msg(`How to reach from ${c}`) })) },
        ],
      },
    ],
    ['Trigger and items', { type: 'menu', items: [{ label: 'Share', icon: 'reply', action: msg('share') }, { label: 'Save', icon: 'bookmark', action: msg('save') }] }]],
  indicator: [
    ['Dots (in a carousel)', { type: 'carousel', dots: 'dots', itemWidth: 'fill', children: ['deoria', 'chopta', 'chandrashila'].map((s) => ({ type: 'image', look: 'hero', images: [img(s)] })) }],
    ['Count (in a carousel)', { type: 'carousel', dots: 'count', itemWidth: 'fill', children: ['deoria', 'chopta', 'chandrashila'].map((s) => ({ type: 'image', look: 'hero', images: [img(s)] })) }],
  ],
  divider: [
    ['Strokes', col(...['divider', 'box', 'subtle', 'dashed', 'suggestionLine'].map((stroke) => labelled(stroke, { type: 'divider', stroke })))],
    ['Vertical', { type: 'stack', direction: 'horizontal', gap: 'md', minHeight: 'tile', children: [t('body', 'Left'), { type: 'divider', orientation: 'vertical' }, t('body', 'Right')] }],
  ],
  card: [
    ...(['glass', 'outline', 'box', 'filled', 'suggestion', 'priceBox', 'panel', 'review', 'offer', 'iconTile', 'ribbon'] as const).map(
      (look): [string, unknown] => [`Look: ${look}`, { type: 'card', look, padding: 'md', children: [t('bodyStrong', look), t('caption', 'Card content', { tone: 'secondary' })] }],
    ),
    ['Tappable', { type: 'card', look: 'glass', action: msg('open'), children: [t('heading', 'Tap me')] }],
    [
      'Photo gallery with dots and caption',
      {
        type: 'card',
        radius: 'card',
        aspect: 1,
        justify: 'end',
        align: 'center',
        gap: 'sm',
        padding: 'md',
        background: { images: [img('dining'), img('chandrashila'), img('chopta')], scrim: { bottom: 'scrimBottom' } },
        children: [{ type: 'indicator' }, t('caption', '🌊 9 minutes walk to Calangute Beach', { tone: 'onAccent' })],
      },
    ],
  ],
  'scroll-row': [
    [
      'Cards',
      {
        type: 'scroll-row',
        itemWidth: 'sm',
        gap: 'md',
        children: ['Tbilisi', 'Batumi', 'Kazbegi', 'Sighnaghi'].map((n) => ({ type: 'card', look: 'outline', padding: 'md', children: [t('heading', n, { tone: 'accent' }), t('caption', 'City destination', { tone: 'secondary' })] })),
      },
    ],
  ],
  carousel: [
    [
      'Stacked deck',
      {
        type: 'carousel',
        look: 'deck',
        dots: 'dots',
        tracking: { onSelect: { event: 'deck_select' } },
        children: [
          ['Dining', 'Varied food options and breakfast choices', 'dining'],
          ['Sunrise at Chandrashila Peak', 'Nanda Devi, Trishul, Kedarnath range lit up in gold', 'chandrashila'],
          ['Chopta Meadow Walks', 'Rolling green bugyals surrounded by oak and rhododendron', 'chopta'],
          ['Deoria Tal Lake Trek', 'A mirror lake reflecting Chaukhamba peaks at dawn', 'deoria'],
        ].map(([title, body, seed]) => ({
          type: 'card',
          radius: 'lg',
          aspect: 1.68,
          justify: 'end',
          padding: 'md',
          gap: 'xxs',
          background: { images: [img(seed!)], scrim: { bottom: 'scrimBottom' } },
          children: [t('heading', title!, { tone: 'onAccent' }), t('caption', body!, { tone: 'dim' })],
        })),
      },
    ],
    ['Snapping with dots', { type: 'carousel', dots: 'dots', itemWidth: { max: 'itemLg', peek: 'md' }, gap: 'md', children: ['1', '2', '3'].map((n) => ({ type: 'card', look: 'glass', children: [t('heading', `Flight option ${n}`)] })) }]],
  grid: [['Two columns', { type: 'grid', columns: 2, gap: 'md', children: ['A', 'B', 'C'].map((x) => ({ type: 'card', look: 'box', children: [t('body', x)] })) }]],
  overlay: [
    [
      'Photo card with layers',
      {
        type: 'overlay',
        base: { type: 'card', radius: 'lg', aspect: 1.4, background: { images: [img('aarti')], scrim: { bottom: 'scrimBottom' } }, justify: 'end', padding: 'lg', children: [t('heading', 'Ganga Aarti', { tone: 'onAccent' })] },
        layers: [
          { anchor: 'top-start', inset: { x: 'md', y: 'md' }, node: { type: 'pill', look: 'count', label: 'Culture' } },
          { anchor: 'top-end', inset: { x: 'md', y: 'md' }, node: { type: 'icon', name: 'close', size: 'iconLg', tone: 'onAccent' } },
        ],
      },
    ],
  ],
  rating: [
    ['Inline', { type: 'rating', value: 4.2, countLabel: '(12.65k reviews)' }],
    ['Five stars', { type: 'rating', look: 'five', value: 4.7, countLabel: '(7.7k)' }],
  ],
  table: [
    [
      'Rows',
      {
        type: 'table',
        look: 'box',
        bleed: false,
        columns: [{ label: 'Activity', width: 'columnWide' }, { label: 'Best time', width: 'md' }, { label: 'Duration', width: 'sm' }],
        rows: [
          { cells: [t('bodyStrong', 'Jeep Safari'), t('caption', 'Early morning'), t('caption', '2–3 hrs')] },
          { cells: [t('bodyStrong', 'Elephant Safari'), t('caption', 'Early morning'), t('caption', '~1 hr')] },
        ],
      },
    ],
  ],
  timeline: [
    ['Branch', { type: 'timeline', children: ['Flight + Drive', 'Train + Drive', 'By road'].map((x) => ({ type: 'card', look: 'outline', padding: 'md', children: [t('body', x)] })) }],
    ['Progress', { type: 'timeline', markers: ['done', 'done', 'pending'], children: ['Booked', 'Checked in', 'Boarding'].map((x) => t('body', x)) }],
  ],
  disclosure: [['Summary and detail', { type: 'disclosure', summary: t('bodyStrong', 'Why this area?'), detail: t('caption', 'Iconic stays with waterparks, private beaches, and skyline views.') }]],
  accordion: [
    [
      'One open at a time',
      {
        type: 'accordion',
        gap: 'md',
        dividers: true,
        children: ['Visa', 'Currency', 'Tipping'].map((x, i) => ({ type: 'disclosure', open: i === 0, summary: t('bodyStrong', x), detail: t('caption', `${x} details`) })),
      },
    ],
  ],
  tabs: [['Segmented', { type: 'tabs', look: 'segmented', labels: ['One way', 'Round trip'], children: [t('body', 'One way dates'), t('body', 'Round trip dates')] }], ['Underline', { type: 'tabs', labels: ['Money & Costs', 'Visa & Entry', 'Getting Around'], children: ['Lari', 'Visa-free', 'Marshrutka'].map((x) => t('body', x)) }]],
  form: [
    [
      'Fields and a submit button',
      {
        type: 'form',
        gap: 'md',
        children: [
          { type: 'textInput', name: 'from', label: 'From', value: 'Delhi' },
          { type: 'textInput', name: 'to', label: 'To', placeholder: 'Where to?' },
          { type: 'button', look: 'primary', fullWidth: true, label: 'Search {from} to {to}', action: msg('Search {from} to {to}') },
        ],
      },
    ],
    [
      'Required choice gates the button',
      {
        type: 'form',
        gap: 'md',
        children: [
          { type: 'choice', name: 'when', label: 'When', mode: 'single', display: 'list', required: true, options: [{ id: 'a', label: 'This weekend' }, { id: 'b', label: 'Next month' }] },
          { type: 'button', look: 'primary', fullWidth: true, label: 'Continue', action: msg('Travel {when}') },
        ],
      },
    ],
  ],
  choice: [
    [
      'Radio list',
      {
        type: 'form',
        children: [
          {
            type: 'choice',
            name: 'when',
            label: 'Popular time',
            mode: 'single',
            display: 'list',
            control: 'radio',
            options: [
              { id: 'nov', label: 'Mid November', caption: 'Quieter travel days' },
              { id: 'xmas', label: 'Christmas Week', caption: 'Dec 22–28' },
              { id: 'flex', label: 'Flexible', caption: 'Show me the best dates' },
            ],
          },
        ],
      },
    ],
    ['Chips', { type: 'form', children: [{ type: 'choice', name: 'area', label: 'Area', mode: 'multi', display: 'chips', options: [{ id: 'pj', label: 'Palm Jumeirah' }, { id: 'dt', label: 'Downtown' }, { id: 'jbr', label: 'JBR' }] }] }],
  ],
  stepper: [
    ['Adults with caption', { type: 'form', children: [{ type: 'stepper', name: 'adults', label: 'Adults', caption: '12+ years', value: 2, min: 1, max: 9, unit: { one: 'adult', other: 'adults' } }] }],
    ['At minimum (0–11)', { type: 'form', children: [{ type: 'stepper', name: 'rooms', label: 'Rooms', value: 0, min: 0, max: 11 }] }],
    ['At maximum', { type: 'form', children: [{ type: 'stepper', name: 'kids', label: 'Children', value: 11, min: 0, max: 11 }] }],
  ],
  textInput: [
    ['Filled with label', { type: 'form', children: [{ type: 'textInput', name: 'from', label: 'From', value: 'Delhi' }] }],
    ['Placeholder', { type: 'form', children: [{ type: 'textInput', name: 'note', label: 'Note', placeholder: 'Anything else?' }] }],
    ['Multiline', { type: 'form', children: [{ type: 'textInput', name: 'note', label: 'Note', multiline: true, maxLength: 200, value: 'Window seat please' }] }],
  ],
  bars: [
    [
      'Price trend',
      {
        type: 'bars',
        selected: 3,
        badge: 'CHEAPEST',
        bars: [
          { value: 34020, valueLabel: '₹34,020', label: '25 Oct' },
          { value: 24020, valueLabel: '₹24,020', label: '26 Oct' },
          { value: 22020, valueLabel: '₹22,020', label: '27 Oct' },
          { value: 19000, valueLabel: '₹19,000', label: '28 Oct' },
          { value: 17000, valueLabel: '₹17,000', label: '29 Oct' },
        ],
      },
    ],
  ],
  pie: [
    [
      'Legend with values and total',
      {
        type: 'pie',
        slices: [
          { label: 'Flights', value: 22240, valueText: '₹22,240' },
          { label: 'Hotels', value: 12980, valueText: '₹12,980' },
          { label: 'Food & Transport', value: 10780, valueText: '₹10,780' },
        ],
        total: { label: 'Total Estimate', valueText: '₹63,000' },
        tracking: { onInspect: { event: 'budget_inspect' } },
      },
    ],
    ['Shares as percentages', { type: 'pie', size: 'sm', slices: [{ label: 'Stay', value: 50 }, { label: 'Flights', value: 30 }, { label: 'Food', value: 19.5 }, { label: 'Tips', value: 0.5 }] }],
    ['No legend', { type: 'pie', legend: false, size: 'lg', slices: [{ label: 'Stay', value: 2 }, { label: 'Flights', value: 1 }, { label: 'Food', value: 1 }] }],
  ],
  trend: [
    [
      'With range, labels and marker',
      {
        type: 'trend',
        points: [9100, 8700, 8450, 8550, 8100, 8250, 8400, 8600, 8800],
        range: { min: 7000, max: 10000 },
        yLabels: ['₹10K', '₹9K', '₹8K', '₹7K'],
        xLabels: ['27 Oct', '6PM', '11 PM'],
        markers: [{ index: 4, lines: ['₹8,100', 'Lowest'], place: 'below' }],
      },
    ],
    [
      'Scrub readouts',
      {
        type: 'trend',
        points: [18, 17, 19, 21, 24, 22, 20],
        xLabels: ['1 Dec', '31 Dec'],
        readouts: [['1 Dec', '₹18K'], ['6 Dec', '₹17K'], ['11 Dec', '₹19K'], ['16 Dec', '₹21K'], ['21 Dec', '₹24K'], ['26 Dec', '₹22K'], ['31 Dec', '₹20K']],
        tracking: { onInspect: { event: 'trend_inspect' } },
      },
    ],
  ],
  calendar: [
    [
      'Fare calendar',
      {
        type: 'calendar',
        weekdays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
        weekStart: 0,
        months: [
          {
            month: '2026-12',
            title: 'December 2026',
            days: days(31, (d) => t('micro', d === 7 ? '₹3.8K' : `₹${(5 + (d % 3) * 0.4).toFixed(1)}K`), (d) => (d === 7 ? 'cheapest' : [14, 15, 21, 23].includes(d) ? 'low' : undefined)),
          },
        ],
        dayAction: msg('Fly on {date}'),
      },
    ],
  ],
};

export { NAMESPACES };


export const FAMILIES: [string, string[]][] = [
  ['Foundation', ['stack', 'text', 'markdown']],
  ['Content', ['icon', 'image', 'pill', 'button', 'menu', 'indicator', 'divider']],
  ['Layout', ['card', 'scroll-row', 'carousel', 'grid', 'overlay']],
  ['Domain', ['rating']],
  ['Structured', ['table', 'timeline', 'disclosure', 'accordion']],
  ['Selection', ['tabs', 'form', 'choice', 'stepper', 'textInput']],
  ['Chart', ['bars', 'pie', 'trend', 'calendar']],
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const STORIES: Story[] = [
  ...FAMILIES.flatMap(([family, types]) =>
    types.flatMap((type) =>
      (ATOMS[type] ?? []).map(([title, raw]): Story => ({ id: `atoms/${type}/${slug(title)}`, title, section: 'Atoms', group: type, family, prompt: `Show me a ${type}`, raw })),
    ),
  ),
  ...NAMESPACES.flatMap((ns) =>
    PRIVATE_COMPONENTS.filter(([, c]) => c.group === ns).map(
      ([key, c]): Story => ({ id: `components/${key}`, title: c.title, section: 'Components', group: ns, prompt: c.prompt, raw: c.raw, figma: c.figma }),
    ),
  ),
];
