import { describe, expect, it } from 'vitest';
import { parseView, parseViewPatch, viewNodeRegistry as R } from '../src';

const text = (value: string, extra = {}) => ({ type: 'text', style: 'body', value, ...extra });
const btn = (label: string, extra = {}) => ({ type: 'button', label, action: { kind: 'message', text: label }, ...extra });

describe('envelope', () => {
  it('requires exactly one of root or layout', () => {
    expect(parseViewPatch(R, { type: 'view', version: 1 }).kind).toBe('rejected');
    expect(parseViewPatch(R, { type: 'view', version: 1, root: text('a'), layout: {} }).kind).toBe('rejected');
  });
  it('rejects props beside root and soft above hard', () => {
    expect(parseViewPatch(R, { type: 'view', version: 1, root: text('a'), props: {} }).kind).toBe('rejected');
    expect(parseViewPatch(R, { type: 'view', version: 1, root: text('a'), limits: { soft: { nodes: 9 }, hard: { nodes: 5 } } }).kind).toBe('rejected');
  });
  it('root null draws nothing silently', () => expect(parseViewPatch(R, { type: 'view', version: 1, root: null }).kind).toBe('empty'));
  it('binds a layout and leaves root holes literal', () => {
    const r = parseViewPatch(R, { type: 'view', version: 1, layout: text('{{t}}'), props: { t: 'Hello' } });
    expect(r.kind === 'tree' && r.tree.root?.value).toBe('Hello');
    const s = parseViewPatch(R, { type: 'view', version: 1, root: text('{{t}}') });
    expect(s.kind === 'tree' && s.tree.root?.value).toBe('{{t}}');
  });
  it('drops root onShow when the block declares its own', () => {
    const ev = { event: 'seen' };
    const r = parseViewPatch(R, { type: 'view', version: 1, tracking: { onShow: ev }, root: text('a', { tracking: { onShow: ev } }) });
    expect(r.kind === 'tree' && r.tree.root?.tracking).toBeUndefined();
    expect(r.kind === 'tree' && r.trackingIssues[0]?.reason).toBe('tracking-duplicate');
  });
});

describe('parseView', () => {
  it('drops a bad list child alone', () => {
    const r = parseView(R, { type: 'stack', children: [text('a'), { type: 'nope' }, text('b')] });
    expect((r.root!.children as unknown[]).length).toBe(2);
    expect(r.issues).toEqual([{ path: 'root.children[1]', reason: 'unknown-type', detail: 'nope' }]);
  });
  it('a strict field failure fails the node', () => {
    const r = parseView(R, { type: 'stack', direction: 'diagonal', children: [] });
    expect(r.root).toBeNull();
    expect(r.issues[0]!.reason).toBe('invalid-fields');
  });
  it('a lenient field reads as absent', () => {
    const r = parseView(R, { type: 'stack', align: 'sideways', children: [] });
    expect(r.root).not.toBeNull();
    expect(r.root!.align).toBeUndefined();
    expect(r.issues).toEqual([]);
  });
  it('walks fallback and flags the issue', () => {
    const r = parseView(R, { type: 'future-thing', fallback: text('old') });
    expect(r.root!.type).toBe('text');
    expect(r.issues[0]).toMatchObject({ reason: 'unknown-type', fellBack: true, type: 'future-thing' });
  });
  it('clears fellBack on descendants when an ancestor fails without fallback', () => {
    const r = parseView(R, { type: 'disclosure', summary: { type: 'x', fallback: text('s') }, detail: { type: 'y' } });
    expect(r.root).toBeNull();
    expect(r.issues.every((i) => !i.fellBack)).toBe(true);
  });
  it('counts nodes including fallback hops and aborts whole', () => {
    const r = parseView(R, { type: 'stack', children: Array.from({ length: 5 }, () => text('a')) }, { limits: { hard: { nodes: 4 } } });
    expect(r.root).toBeNull();
    expect(r.issues.at(-1)!.reason).toBe('too-many-nodes');
  });
  it('aborts on depth', () => {
    let n: unknown = text('leaf');
    for (let i = 0; i < 13; i++) n = { type: 'stack', children: [n] };
    const r = parseView(R, n);
    expect(r.root).toBeNull();
    expect(r.issues.at(-1)!.reason).toBe('too-deep');
  });
  it('a failed node slot fails the parent', () => {
    expect(parseView(R, { type: 'overlay', base: { type: 'x' }, layers: [{ anchor: 'top', node: text('a') }] }).root).toBeNull();
  });
  it('an overlay layer drops alone and forbids buttons', () => {
    const r = parseView(R, { type: 'overlay', base: text('b'), layers: [{ anchor: 'top', node: btn('x') }, { anchor: 'fill', node: text('a') }] });
    expect((r.root!.layers as unknown[]).length).toBe(1);
    expect(r.issues[0]).toMatchObject({ reason: 'form-scope' });
  });
  it('table fails whole when one child drops', () => {
    const r = parseView(R, { type: 'table', columns: [{ label: 'A' }], children: [text('a'), { type: 'x' }] });
    expect(r.root).toBeNull();
  });
  it('tabs drop a pane together with its label', () => {
    const r = parseView(R, { type: 'tabs', labels: ['A', 'B', 'C'], children: [text('a'), { type: 'x' }, text('c')] });
    expect(r.root!.labels).toEqual(['A', 'C']);
  });
  it('timeline mismatch fails, dropped step removes its marker', () => {
    expect(parseView(R, { type: 'timeline', markers: ['done'], children: [text('a'), text('b')] }).root).toBeNull();
    const r = parseView(R, { type: 'timeline', markers: ['done', 'what'], children: [{ type: 'x' }, text('b')] });
    expect(r.root!.markers).toEqual(['pending']);
  });
  it('inputs need a form and buttons read form names', () => {
    const stepper = { type: 'stepper', name: 'adults', label: 'Adults', value: 1, min: 1, max: 9 };
    expect(parseView(R, { type: 'stack', children: [stepper] }).issues[0]!.reason).toBe('form-scope');
    const ok = parseView(R, { type: 'form', children: [stepper, btn('Go {adults}')] });
    expect((ok.root!.children as unknown[]).length).toBe(2);
    const bad = parseView(R, { type: 'form', children: [stepper, btn('Go {kids}')] });
    expect((bad.root!.children as unknown[]).length).toBe(1);
    expect(parseView(R, btn('Go {kids}')).root).not.toBeNull();
  });
  it('nested forms are dropped', () => {
    const r = parseView(R, { type: 'form', children: [{ type: 'form', children: [] }] });
    expect(r.issues[0]!.reason).toBe('form-scope');
  });
  it('removes an unknown longPress but keeps the card', () => {
    const r = parseView(R, { type: 'card', longPress: 'm1', children: [text('a')] });
    expect(r.root!.longPress).toBeUndefined();
    expect(r.issues[0]!.reason).toBe('unknown-menu');
  });
  it('menu entries drop alone; empty menu fails', () => {
    const item = { label: 'Share', action: { kind: 'share', text: 'x' } };
    const r = parseView(R, { type: 'menu', items: [item, { label: '' }] });
    expect((r.root!.items as unknown[]).length).toBe(1);
    expect(parseView(R, { type: 'menu', items: [{ label: '' }] }).root).toBeNull();
  });
  it('tracking keys drop alone', () => {
    const r = parseView(R, text('a', { tracking: { onShow: { event: 'e' }, onSelect: { event: 'x' }, onExpand: 3 } }));
    expect(r.root!.tracking).toEqual({ onShow: { event: 'e' } });
    expect(r.issues.map((i) => i.reason)).toEqual(['tracking-unsupported', 'tracking-unsupported']);
  });
  it('reports duplicate draft ids and keeps both', () => {
    const r = parseView(R, { type: 'stack', children: [{ type: 'stack', id: 'a', children: [] }, { type: 'stack', id: 'a', children: [] }] });
    expect((r.root!.children as unknown[]).length).toBe(2);
    expect(r.issues[0]!.reason).toBe('duplicate-id');
  });
  it('text needs exactly one of value or spans; readMore needs maxLines', () => {
    expect(parseView(R, { type: 'text', style: 'body' }).root).toBeNull();
    expect(parseView(R, text('a', { readMore: {} })).root).toBeNull();
  });
  it('calendar walks day bodies; a failing body becomes null', () => {
    const days = Array.from({ length: 28 }, (_, i) => (i === 0 ? { body: { type: 'x' }, marks: ['low', 'low', 'nope'] } : {}));
    const r = parseView(R, {
      type: 'calendar',
      weekdays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
      weekStart: 0,
      marks: { low: { icon: 'star', anchor: 'top-end' }, bad: { icon: 'x' } },
      months: [{ month: '2027-02', title: 'Feb', days }],
    });
    const day0 = (r.root!.months as { days: { body: unknown; marks: string[] }[] }[])[0]!.days[0]!;
    expect(day0.body).toBeNull();
    expect(day0.marks).toEqual(['low']);
  });
  it('calendar fails on wrong day count', () => {
    expect(parseView(R, { type: 'calendar', weekdays: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], weekStart: 1, months: [{ month: '2027-02', title: 'F', days: [] }] }).root).toBeNull();
  });
  it('choice cards are untouchable and paired with options', () => {
    const r = parseView(R, {
      type: 'form',
      children: [
        {
          type: 'choice', name: 'room', label: 'Room', mode: 'single', display: 'cards',
          options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
          children: [btn('x'), text('b')],
        },
      ],
    });
    const choice = (r.root!.children as { options: unknown[] }[])[0]!;
    expect(choice.options).toEqual([{ id: 'b', label: 'B' }]);
  });
});
