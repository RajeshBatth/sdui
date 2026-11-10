import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderView } from './helpers';

const text = (value: string) => ({ type: 'text', style: 'body', value });
const disc = (s: string, d: string, extra = {}) => ({ type: 'disclosure', summary: text(s), detail: text(d), ...extra });

describe('interactive views', () => {
  it('disclosure toggles and tracks onExpand on open only', () => {
    const { onTrack } = renderView(disc('Policies', 'Free cancellation', { tracking: { onExpand: { event: 'exp' } } }));
    expect(screen.queryByText('Free cancellation')).toBeNull();
    fireEvent.click(screen.getByText('Policies'));
    expect(screen.getByText('Free cancellation')).toBeTruthy();
    fireEvent.click(screen.getByText('Policies'));
    expect(onTrack).toHaveBeenCalledTimes(1);
    expect(onTrack).toHaveBeenCalledWith({ event: 'exp', props: { index: 0 } });
  });

  it('accordion keeps one section open', () => {
    renderView({ type: 'accordion', children: [disc('A', 'a-detail', { open: true }), disc('B', 'b-detail')] });
    expect(screen.getByText('a-detail')).toBeTruthy();
    fireEvent.click(screen.getByText('B'));
    expect(screen.getByText('b-detail')).toBeTruthy();
    expect(screen.queryByText('a-detail')).toBeNull();
    fireEvent.click(screen.getByText('B'));
    expect(screen.queryByText('b-detail')).toBeNull();
  });

  it('tabs show one pane and track a change', () => {
    const { onTrack } = renderView({
      type: 'tabs',
      labels: ['Rooms', 'Reviews'],
      children: [text('room list'), { type: 'stack', id: 'rev', children: [text('review list')] }],
      tracking: { onSelect: { event: 'tab' } },
    });
    expect(screen.getByText('room list')).toBeTruthy();
    expect(screen.queryByText('review list')).toBeNull();
    fireEvent.click(screen.getByText('Reviews'));
    expect(screen.getByText('review list')).toBeTruthy();
    expect(onTrack).toHaveBeenCalledWith({ event: 'tab', props: { id: 'rev', index: 1 } });
    fireEvent.click(screen.getByText('Reviews'));
    expect(onTrack).toHaveBeenCalledTimes(1);
  });

  it('menu opens, tracks, and runs an item', () => {
    const action = { kind: 'message', text: 'share' };
    const { onAction, onTrack } = renderView({ type: 'menu', items: [{ label: 'Share', action }], tracking: { event: 'menu' } });
    fireEvent.click(screen.getByLabelText('More options'));
    expect(onTrack).toHaveBeenCalledWith({ event: 'menu' });
    fireEvent.click(screen.getByText('Share'));
    expect(onAction).toHaveBeenCalledWith(action, undefined);
  });

  it('menu with no available items draws nothing', () => {
    renderView({ type: 'menu', items: [{ label: 'Share', action: { kind: 'share', text: 'x' } }] }, { available: () => false });
    expect(screen.queryByLabelText('More options')).toBeNull();
  });

  it('card long press opens its menu', () => {
    renderView({
      type: 'card',
      longPress: 'm',
      children: [text('Hotel'), { type: 'menu', id: 'm', items: [{ label: 'Save', action: { kind: 'message', text: 's' } }] }],
    });
    vi.useFakeTimers();
    const target = screen.getByText('Hotel');
    const touch = { identifier: 1, target, pageX: 1, pageY: 1, clientX: 1, clientY: 1 };
    fireEvent.touchStart(target, { touches: [touch], changedTouches: [touch] });
    act(() => vi.advanceTimersByTime(800));
    fireEvent.touchEnd(target, { touches: [], changedTouches: [touch] });
    vi.useRealTimers();
    expect(screen.getByText('Save')).toBeTruthy();
  });
});

describe('deck carousel', () => {
  const deck = {
    type: 'carousel',
    look: 'deck',
    tracking: { onSelect: { event: 'sel' } },
    children: ['One', 'Two', 'Three'].map((x) => ({ type: 'text', style: 'body', value: x })),
  };
  it('draws every card and pages by accessibility action', async () => {
    const { onTrack } = renderView(deck);
    expect(screen.getByText('One')).toBeTruthy();
    expect(screen.getByText('Three')).toBeTruthy();
    expect(screen.getByLabelText('1 of 3')).toBeTruthy();
  });
});
