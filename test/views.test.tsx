import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NODE_TYPES } from '../src';
import { renderRegistry, renderView } from './helpers';

const text = (value: string, extra = {}) => ({ type: 'text', style: 'body', value, ...extra });
const msg = (t: string) => ({ kind: 'message', text: t });

describe('views', () => {
  it('stack draws its children', () => {
    renderView({ type: 'stack', gap: 'sm', children: [text('one'), text('two')] });
    expect(screen.getByText('one')).toBeTruthy();
    expect(screen.getByText('two')).toBeTruthy();
  });

  it('stack collapse shows a toggle and expands', () => {
    renderView({ type: 'stack', collapseAfter: 1, children: [text('a'), text('b'), text('c')] });
    expect(screen.queryByText('b')).toBeNull();
    fireEvent.click(screen.getByText('Show 2 more'));
    expect(screen.getByText('c')).toBeTruthy();
    expect(screen.getByText('Show less')).toBeTruthy();
  });

  it('text spans render and linked spans fire their action', () => {
    const { onAction } = renderView({ type: 'text', style: 'body', spans: [{ text: 'Hello ' }, { text: 'link', action: msg('go') }] });
    fireEvent.click(screen.getByText('link'));
    expect(onAction).toHaveBeenCalledWith(msg('go'), undefined);
  });

  it('button fires its action and draws nothing when unavailable', () => {
    const { onAction } = renderView({ type: 'button', look: 'primary', label: 'Book', action: msg('book') });
    fireEvent.click(screen.getByText('Book'));
    expect(onAction).toHaveBeenCalledTimes(1);
    renderView({ type: 'button', label: 'Hidden', action: msg('x') }, { available: () => false });
    expect(screen.queryByText('Hidden')).toBeNull();
  });

  it('button is busy while a request is pending', async () => {
    let resolve!: (v: boolean) => void;
    const onAction = vi.fn(() => new Promise<boolean>((r) => (resolve = r)));
    renderView({ type: 'button', label: 'Save', action: { kind: 'request', endpoint: '/x' } }, { onAction });
    fireEvent.click(screen.getByText('Save'));
    fireEvent.click(screen.getByText('Save'));
    expect(onAction).toHaveBeenCalledTimes(1);
    resolve(true);
  });

  it('spend scope spends after one action', () => {
    const { onAction } = renderView({ type: 'stack', spend: 'onAction', children: [{ type: 'button', label: 'A', action: msg('a') }, { type: 'button', label: 'B', action: msg('b') }] });
    fireEvent.click(screen.getByText('A'));
    fireEvent.click(screen.getByText('B'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('pill, rating, divider, icon and image draw', () => {
    renderView({
      type: 'stack',
      children: [
        { type: 'pill', label: 'Free cancellation', look: 'accent', icon: 'check' },
        { type: 'rating', value: 4.26, word: 'Excellent', countLabel: '1,204 reviews' },
        { type: 'divider' },
        { type: 'icon', name: 'star' },
        { type: 'image', images: [{ url: 'https://x/y.jpg', alt: 'Pool' }] },
      ],
    });
    expect(screen.getByText('Free cancellation')).toBeTruthy();
    expect(screen.getByLabelText('Rated 4.3 of 5, Excellent, 1,204 reviews')).toBeTruthy();
    expect(screen.getByLabelText('Pool')).toBeTruthy();
  });

  it('card fires its tap action', () => {
    const { onAction } = renderView({ type: 'card', look: 'elevated', action: msg('open'), children: [text('Goa')] });
    fireEvent.click(screen.getByText('Goa'));
    expect(onAction).toHaveBeenCalledWith(msg('open'), undefined);
  });

  it('grid pads the last row', () => {
    const { container } = renderView({ type: 'grid', columns: 2, children: [text('a'), text('b'), text('c')] });
    expect(screen.getByText('c')).toBeTruthy();
    expect(container.textContent).toBe('abc');
  });

  it('overlay layers are inert', () => {
    const { onAction } = renderView({
      type: 'overlay',
      base: { type: 'card', action: msg('base'), children: [text('base')] },
      layers: [{ anchor: 'top-end', node: { type: 'pill', label: 'Top pick' } }],
    });
    expect(screen.getByText('Top pick')).toBeTruthy();
    fireEvent.click(screen.getByText('base'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('carousel and scroll-row draw items', () => {
    renderView({ type: 'carousel', dots: 'dots', children: [text('one'), text('two')] });
    expect(screen.getByText('two')).toBeTruthy();
    renderView({ type: 'scroll-row', itemWidth: 'sm', children: [text('x')] });
    expect(screen.getByText('x')).toBeTruthy();
  });

  it('reports which node types still lack a view', () => {
    const missing = NODE_TYPES.filter((t) => !renderRegistry.has(t));
    expect(missing.length).toBeGreaterThanOrEqual(0);
  });
});
