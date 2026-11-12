import { msg, t, type PublicComponent } from '../component-types';

const sectionHeader = (icon: string, title: string, ask?: string) => ({
  type: 'stack',
  direction: 'horizontal',
  justify: 'between',
  align: 'center',
  children: [
    { type: 'stack', direction: 'horizontal', gap: 'xs', align: 'center', children: [{ type: 'icon', name: icon, size: 'iconMd' }, t('sectionTitle', title)] },
    ...(ask ? [{ type: 'button', look: 'link', label: 'ask myra', leadingIcon: 'ask', action: { kind: 'prefill-composer', text: ask } }] : []),
  ],
});

const numbered = (n: number, title: string, body: string) => ({
  type: 'stack',
  direction: 'horizontal',
  gap: 'sm',
  align: 'start',
  children: [
    { type: 'pill', look: 'tile', label: `${n}.` },
    { type: 'stack', grow: true, gap: 'xs', children: [t('bodyStrong', title), t('caption', body, { tone: 'secondary' })] },
  ],
});

const suggestion = (spans: { text: string; weight?: string }[]) => ({
  type: 'button',
  look: 'row',
  fullWidth: true,
  label: spans,
  trailingIcon: 'reply',
  action: msg(spans.map((s) => s.text).join('')),
});

/** Core namespace: building blocks shared across verticals. */
export const COMPONENTS: Record<string, PublicComponent> = {
  'core-section-header': {
    group: 'Core',
    title: 'Section header with ask myra',
    prompt: 'When should I visit Georgia?',
    raw: sectionHeader('weather', 'Best time to visit', 'When should I visit Georgia?'),
  },
  'core-section-header-plain': {
    group: 'Core',
    title: 'Section header',
    prompt: 'Why would I like Taj Exotica?',
    raw: sectionHeader('location', 'Why you might like it'),
  },
  'core-numbered-row': {
    group: 'Core',
    title: 'Numbered row',
    prompt: 'What currency do they use in Georgia?',
    raw: numbered(1, 'Currency: Georgian Lari (GEL)', '1 USD ≈ 2.7 GEL · Cards accepted in cities, cash preferred in villages'),
  },
  'core-travellers': {
    group: 'Core',
    title: 'Travellers (stepper)',
    prompt: 'Goa trip for my family',
    raw: {
      type: 'form',
      id: 'travellers',
      gap: 'md',
      dividers: true,
      children: [
        { type: 'stepper', name: 'adults', label: 'Adults', caption: '12+ years', value: 2, min: 1, max: 9, unit: { one: 'adult', other: 'adults' } },
        { type: 'stepper', name: 'children', label: 'Children', caption: '2–11 years', value: 0, min: 0, max: 6, unit: { one: 'child', other: 'children' } },
        { type: 'button', look: 'primary', fullWidth: true, label: 'Search for {adults}, {children}', action: msg('Search for {adults}, {children}') },
      ],
    },
  },
  'core-budget': {
    group: 'Core',
    title: 'Trip budget allocation (pie)',
    prompt: 'Plan a Goa trip for a couple',
    raw: {
      type: 'stack',
      gap: 'xl',
      children: [
        { type: 'text', style: 'sectionTitle', spans: [{ text: 'Trip Budget Allocation ' }, { text: '(for couple)', weight: 'regular' }] },
        {
          type: 'pie',
          slices: [
            { label: 'Flights', value: 22240, valueText: '₹22,240', action: msg('Show flight options') },
            { label: 'Hotels', value: 12980, valueText: '₹12,980', action: msg('Show hotel options') },
            { label: 'Food & Transport', value: 10780, valueText: '₹10,780' },
          ],
          total: { label: 'Total Estimate', valueText: '₹63,000' },
          tracking: { onInspect: { event: 'budget_inspect' } },
        },
      ],
    },
  },
  'core-suggestions': {
    group: 'Core',
    title: 'Follow-up suggestions',
    prompt: 'bangalore to singapore on 25 sep',
    raw: {
      type: 'card',
      look: 'suggestion',
      dividers: true,
      gap: 'md',
      padding: { x: 'md', y: 14 },
      children: [
        suggestion([{ text: 'Book ' }, { text: '6E-1457 | 12:55 -17:40 | ₹16,869', weight: 'bold' }]),
        suggestion([{ text: 'Only evening Flights' }]),
        suggestion([{ text: 'Compare 6E-1457 and SQ-511' }]),
      ],
    },
  },
  'core-rating-row': {
    group: 'Core',
    title: 'Rating row',
    prompt: 'Kays Calangute Resort',
    raw: { type: 'rating', value: 4.2, countLabel: '(12.65k reviews)' },
  },
};
