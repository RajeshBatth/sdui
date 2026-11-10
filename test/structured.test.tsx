import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SNAPSHOT_MANIFEST } from '../src/manifest/snapshot';
import { createRenderRegistry, NODE_VIEWS } from '../src/nodes/views';
import { fillDayAction, STRUCTURED_LOOKS, structuredViews } from '../src/nodes/views/structured';
import { renderView } from './helpers';

const registry = createRenderRegistry({ ...NODE_VIEWS, ...structuredViews });
const manifest = { ...SNAPSHOT_MANIFEST, look: { ...SNAPSHOT_MANIFEST.look, ...STRUCTURED_LOOKS } };
const draw = (raw: unknown) => renderView(raw, { registry, manifest });
const text = (value: string) => ({ type: 'text', style: 'body', value });
const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function feb(days: (i: number) => object = () => ({})) {
  return { month: '2027-02', title: 'February', days: Array.from({ length: 28 }, (_, i) => days(i)) };
}

describe('table', () => {
  it('draws header and row-major children', () => {
    const { container } = draw({ type: 'table', columns: [{ label: 'Airline' }, { label: 'Fare', width: 'sm' }], children: [text('IndiGo'), text('₹4,210'), text('Akasa'), text('₹4,480')] });
    expect(screen.getByText('Airline')).toBeTruthy();
    expect(screen.getByText('₹4,480')).toBeTruthy();
    expect(container.querySelectorAll('[role="row"]').length).toBe(3);
    expect(container.querySelectorAll('[role="columnheader"]').length).toBe(2);
    expect(container.querySelectorAll('[role="cell"]').length).toBe(4);
  });

  it('draws the rows form', () => {
    const { container } = draw({ type: 'table', columns: [{ label: 'A' }], rows: [{ cells: [text('r1')] }, { cells: [text('r2')] }] });
    expect(screen.getByText('r2')).toBeTruthy();
    expect(container.querySelector('[role="table"]')).toBeTruthy();
  });
});

describe('timeline', () => {
  it('branch mode draws steps without markers', () => {
    draw({ type: 'timeline', children: [text('Day 1'), text('Day 2')] });
    expect(screen.getByText('Day 2')).toBeTruthy();
    expect(screen.queryByLabelText('Done')).toBeNull();
  });

  it('progress mode labels markers', () => {
    draw({ type: 'timeline', markers: ['done', 'pending'], children: [text('Booked'), text('Check-in')] });
    expect(screen.getByLabelText('Done')).toBeTruthy();
    expect(screen.getByLabelText('Pending')).toBeTruthy();
  });
});

describe('calendar', () => {
  it('draws weekdays, numbers and no title for a single month', () => {
    draw({ type: 'calendar', weekdays: WEEK, weekStart: 1, months: [feb()] });
    expect(screen.getAllByText('M').length).toBe(1);
    expect(screen.getByText('28')).toBeTruthy();
    expect(screen.queryByText('February')).toBeNull();
  });

  it('shows titles for several months', () => {
    const mar = { month: '2027-03', title: 'March', days: Array.from({ length: 31 }, () => ({})) };
    draw({ type: 'calendar', weekdays: WEEK, weekStart: 1, months: [feb(), mar] });
    expect(screen.getByText('February')).toBeTruthy();
    expect(screen.getByText('March')).toBeTruthy();
  });

  it('fills dayAction only where a day has a body', () => {
    const { onAction } = draw({
      type: 'calendar',
      weekdays: WEEK,
      weekStart: 1,
      dayAction: { kind: 'message', text: 'Fares on {date} ({day}, {month})' },
      months: [feb((i) => (i === 4 ? { body: text('₹3k') } : {}))],
    });
    fireEvent.click(screen.getByLabelText('5 February'));
    expect(onAction).toHaveBeenCalledWith({ kind: 'message', text: 'Fares on 2027-02-05 (5, 2027-02)' }, undefined);
    expect(screen.getByLabelText('6 February').getAttribute('role')).not.toBe('button');
  });

  it('own action is pressable without a body and never filled', () => {
    const own = { kind: 'message', text: 'pick {date}' };
    const { onAction } = draw({ type: 'calendar', weekdays: WEEK, weekStart: 0, months: [feb((i) => (i === 0 ? { action: own } : {}))] });
    fireEvent.click(screen.getByLabelText('1 February'));
    expect(onAction).toHaveBeenCalledWith(own, undefined);
  });

  it('a body that failed parsing stays pressable and undimmed', () => {
    const { onAction } = draw({
      type: 'calendar',
      weekdays: WEEK,
      weekStart: 1,
      dayAction: { kind: 'message', text: '{date}' },
      months: [feb((i) => (i === 2 ? { body: { type: 'nope' } } : {}))],
    });
    fireEvent.click(screen.getByLabelText('3 February'));
    expect(onAction).toHaveBeenCalledWith({ kind: 'message', text: '2027-02-03' }, undefined);
    expect(screen.getByText('3').getAttribute('style') ?? '').not.toContain('opacity: 0.5');
    expect(screen.getByText('4').getAttribute('style') ?? '').toContain('opacity: 0.5');
  });

  it('labels are spoken, never drawn; body actions are inert', () => {
    const { onAction } = draw({
      type: 'calendar',
      weekdays: WEEK,
      weekStart: 1,
      labels: { low: 'Lowest fare' },
      marks: { star: { icon: 'star', anchor: 'top-end' } },
      months: [feb((i) => (i === 9 ? { look: 'low', marks: ['star'], body: { type: 'button', label: 'Go', action: { kind: 'message', text: 'x' } } } : {}))],
    });
    expect(screen.getByLabelText('10 February, Lowest fare')).toBeTruthy();
    expect(screen.queryByText('Lowest fare')).toBeNull();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('fillDayAction passes other kinds through', () => {
    const a = { kind: 'navigate' as const, target: '{date}' };
    expect(fillDayAction(a, { day: '1', date: '2027-02-01', month: '2027-02' })).toBe(a);
  });
});
