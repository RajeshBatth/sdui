import { msg, t, type PublicComponent } from '../component-types';

const sectionHeader = (icon: string, title: string, extra?: string) => ({
  type: 'stack',
  direction: 'horizontal',
  gap: 'sm',
  align: 'center',
  children: [
    { type: 'icon', name: icon, size: 'iconMd', tone: 'ink2' },
    extra
      ? { type: 'text', style: 'htSection', tone: 'ink2', spans: [{ text: `${title} ` }, { text: extra, style: 'htSuggestion', weight: 'regular', tone: 'muted' }] }
      : t('htSection', title, { tone: 'ink2' }),
  ],
});

const roomCard = (name: string, detail: string, price: string) => ({
  type: 'card',
  look: 'htRoom',
  direction: 'horizontal',
  justify: 'between',
  align: 'center',
  gap: 'md',
  action: msg(`Tell me about the ${name}`),
  children: [
    { type: 'stack', grow: true, gap: 'xxs', children: [t('htRoomTitle', name), t('caption', detail, { tone: 'muted' })] },
    { type: 'text', style: 'htRoomPrice', spans: [{ text: `${price} ` }, { text: '/ night', style: 'caption', weight: 'regular', tone: 'muted' }] },
  ],
});

const avatar = (n: number) => ({ type: 'image', look: 'avatar', images: [{ url: `/assets/avatar-${n}.png`, alt: '' }] });

/** Published Hotels components. The rest of the Hotels namespace stays in the private folder. */
export const COMPONENTS: Record<string, PublicComponent> = {
  'hotels-price-card': {
    group: 'Hotels',
    title: 'Price card',
    prompt: 'Taj Exotica Goa',
    raw: {
      type: 'card',
      look: 'panel',
      direction: 'horizontal',
      justify: 'between',
      align: 'start',
      children: [
        { type: 'stack', gap: 'xs', children: [t('price', '₹21,828 / night'), t('caption', 'Sun, 6 Sept – Mon, 7 Sept', { tone: 'muted' }), t('caption', '1 room · 2 guests', { tone: 'muted' })] },
        { type: 'button', look: 'link', label: 'View rooms & prices', trailingIcon: 'chevron-right-sm', action: msg('Show rooms and prices') },
      ],
    },
  },
  'hotels-review-card': {
    group: 'Hotels',
    title: 'Reviews card',
    prompt: 'What do guests say about Taj Exotica?',
    raw: {
      type: 'card',
      look: 'review',
      gap: 'lg',
      children: [
        {
          type: 'stack',
          gap: 'sm',
          children: [
            {
              type: 'stack',
              direction: 'horizontal',
              justify: 'between',
              align: 'center',
              children: [t('label', 'Reviews', { tone: 'ink2' }), { type: 'button', look: 'link', label: 'View all reviews', trailingIcon: 'chevron-right-sm', action: msg('Show all reviews') }],
            },
            { type: 'rating', look: 'five', value: 4.7, countLabel: '(7.7k)' },
            t('caption', 'Guests love the lush surroundings, spacious rooms, and clean private beach, along with the warm hospitality and attentive staff. The varied food options and family-friendly activities are also frequently appreciated.', { tone: 'muted' }),
          ],
        },
        {
          type: 'stack',
          direction: 'horizontal',
          gap: 'md',
          align: 'center',
          children: [
            { type: 'stack', direction: 'horizontal', overlap: 'sm', overlapOrder: 'earlier', align: 'center', children: [avatar(1), avatar(2), avatar(3), { type: 'pill', look: 'count', label: '+213' }] },
            { type: 'stack', direction: 'horizontal', gap: 'xs', align: 'center', children: [{ type: 'icon', name: 'sparkle', size: 'iconLg' }, t('caption', 'Summarised by AI', { tone: 'muted' })] },
          ],
        },
      ],
    },
  },
  'hotels-room-types': {
    group: 'Hotels',
    title: 'Available room types (stacked peek)',
    prompt: 'Show me the rooms at Kays Calangute Resort',
    raw: {
      type: 'stack',
      gap: 'lg',
      children: [
        sectionHeader('hotel', 'Available Room Types', '(6 Room Types)'),
        {
          type: 'stack',
          gap: 'sm',
          align: 'center',
          children: [
            roomCard('Deluxe Ocean View Room', '2 guests, King bed, Private Balcony, Breakfast Include', '₹21,828'),
            {
              type: 'stack',
              overlap: 19,
              overlapOrder: 'earlier',
              align: 'center',
              width: 'fill',
              children: [
                roomCard('Premium Sea-Facing Villa', '2 guests, Private plunge pool, Jacuzzi bath', '₹26,800'),
                { type: 'card', look: 'htRoom', width: 'htPeek', minHeight: 27, children: [] },
              ],
            },
          ],
        },
        { type: 'stack', align: 'center', children: [{ type: 'button', look: 'htLink', label: 'View all +4 More Rooms Types', action: msg('Show all room types') }] },
      ],
    },
  },
};
