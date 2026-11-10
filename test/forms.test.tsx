import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderView } from './helpers';

const msg = (text: string) => ({ kind: 'message', text });

describe('form inputs', () => {
  it('stepper steps within bounds and fills the button label', () => {
    const { onAction } = renderView({
      type: 'form',
      children: [
        { type: 'stepper', name: 'adults', label: 'Adults', value: 1, min: 1, max: 2, unit: { one: 'adult', other: 'adults' } },
        { type: 'button', label: 'Go with {adults}', action: msg('Go with {adults}') },
      ],
    });
    expect(screen.getByLabelText('Decrease Adults').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByLabelText('Increase Adults'));
    expect(screen.getByText('Go with 2 adults')).toBeTruthy();
    expect(screen.getByLabelText('Increase Adults').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByText('Go with 2 adults'));
    expect(onAction).toHaveBeenCalledWith(msg('Go with {adults}'), { values: { adults: 2 } });
  });

  it('single choice picks one; required gates the button', () => {
    const { onAction } = renderView({
      type: 'form',
      id: 'f',
      children: [
        { type: 'choice', name: 'when', label: 'When', mode: 'single', display: 'list', required: true, options: [{ id: 'a', label: 'Soon' }, { id: 'b', label: 'Later' }] },
        { type: 'button', label: 'Continue', action: msg('Travel {when}') },
      ],
    });
    fireEvent.click(screen.getByText('Continue'));
    expect(onAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Later'));
    fireEvent.click(screen.getByText('Continue'));
    expect(onAction).toHaveBeenCalledWith(msg('Travel {when}'), { id: 'f', values: { when: ['b'] } });
  });

  it('multi choice respects max', () => {
    renderView({
      type: 'form',
      children: [
        { type: 'choice', name: 'area', label: 'Area', mode: 'multi', display: 'chips', max: 1, options: [{ id: 'a', label: 'Deira' }, { id: 'b', label: 'Downtown' }] },
        { type: 'button', label: 'Areas: {area}', action: msg('x') },
      ],
    });
    fireEvent.click(screen.getByText('Deira'));
    fireEvent.click(screen.getByText('Downtown'));
    expect(screen.getByText('Areas: Deira')).toBeTruthy();
  });

  it('text input trims to maxLength and is locked when not interactive', () => {
    renderView({ type: 'form', children: [{ type: 'textInput', name: 'note', label: 'Note', maxLength: 3, value: 'abcdef' }] });
    expect((screen.getByLabelText('Note') as HTMLInputElement).value).toBe('abc');
  });

  it('locks inputs when the reply is not interactive', () => {
    renderView({ type: 'form', children: [{ type: 'textInput', name: 'note', label: 'Note', value: 'x' }] }, { interactive: false });
    expect((screen.getByLabelText('Note') as HTMLInputElement).readOnly).toBe(true);
  });
});

describe('charts', () => {
  const bars = {
    type: 'bars',
    selected: 0,
    badge: 'CHEAPEST',
    tracking: { onInspect: { event: 'inspect' } },
    bars: [
      { value: 10, valueLabel: '₹10', label: 'Mon', action: msg('mon') },
      { value: 20, valueLabel: '₹20', label: 'Tue', action: msg('tue') },
    ],
  };
  it('bars: first tap inspects once, second tap acts', () => {
    const { onAction, onTrack } = renderView(bars);
    const tue = screen.getByLabelText('Tue, ₹20');
    fireEvent.click(tue);
    expect(onTrack).toHaveBeenCalledTimes(1);
    fireEvent.click(tue);
    expect(onAction).toHaveBeenCalledWith(msg('tue'), undefined);
    expect(onTrack).toHaveBeenCalledTimes(1);
  });
  it('bars: inert blocks interaction', () => {
    const { onTrack } = renderView({ type: 'overlay', base: { type: 'text', style: 'body', value: 'x' }, layers: [{ anchor: 'fill', node: bars }] });
    fireEvent.click(screen.getByLabelText('Tue, ₹20'));
    expect(onTrack).not.toHaveBeenCalled();
  });
});

describe('trend scrub', () => {
  const trend = {
    type: 'trend',
    points: [10, 20, 30],
    xLabels: ['Mon', 'Wed'],
    readouts: [['Mon', '₹10'], ['Tue', '₹20'], ['Wed', '₹30']],
    tracking: { onInspect: { event: 'inspect' } },
  };
  it('mouse and touch pointers scrub and inspect once per point', () => {
    const { container, onTrack } = renderView(trend);
    const chart = container.querySelector('[style*="crosshair"]') as HTMLElement;
    expect(chart).toBeTruthy();
    chart.getBoundingClientRect = () => ({ left: 100, top: 0, width: 300, height: 130, right: 400, bottom: 130, x: 100, y: 0, toJSON() {} }) as DOMRect;
    fireEvent.pointerMove(chart, { clientX: 100, pointerType: 'mouse' });
    fireEvent.pointerMove(chart, { clientX: 100, pointerType: 'mouse' });
    expect(onTrack).toHaveBeenCalledTimes(1);
    expect((onTrack as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toMatchObject({ event: 'inspect', props: { index: 0, label: 'Mon' } });
    fireEvent.pointerDown(chart, { clientX: 900, pointerType: 'touch' });
    expect(onTrack).toHaveBeenCalledTimes(2);
    expect((onTrack as ReturnType<typeof vi.fn>).mock.calls[1]![0]).toMatchObject({ props: { index: 2, label: 'Wed' } });
  });
  it('no readouts means no scrub surface', () => {
    const { container } = renderView({ ...trend, readouts: undefined });
    expect(container.querySelector('[style*="crosshair"]')).toBeNull();
  });
});

describe('pie', () => {
  const pie = {
    type: 'pie',
    slices: [
      { label: 'Flights', value: 99.5, action: { kind: 'message', text: 'flights' } },
      { label: 'Tips', value: 0.5 },
    ],
    tracking: { onInspect: { event: 'inspect' } },
  };
  it('shows whole percentages and <1%', () => {
    renderView(pie);
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.getByText('<1%')).toBeTruthy();
  });
  it('first tap on a legend row inspects, second runs the action', () => {
    const { onAction, onTrack } = renderView(pie);
    fireEvent.click(screen.getByLabelText('Flights, 100%'));
    expect(onTrack).toHaveBeenCalledWith({ event: 'inspect', props: { index: 0, label: 'Flights' } });
    fireEvent.click(screen.getByLabelText('Flights, 100%'));
    expect(onAction).toHaveBeenCalledWith({ kind: 'message', text: 'flights' }, undefined);
    expect(onTrack).toHaveBeenCalledTimes(1);
  });
  it('total row and legend-off disc label', () => {
    renderView({ ...pie, total: { label: 'Total', valueText: '₹100' } });
    expect(screen.getByText('₹100')).toBeTruthy();
    renderView({ ...pie, legend: false });
    expect(screen.getByLabelText('Flights, 100%; Tips, <1%')).toBeTruthy();
  });
});
