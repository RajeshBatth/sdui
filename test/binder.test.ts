import { describe, expect, it } from 'vitest';
import { bindLayout, BIND_DEPTH_LIMIT, TOO_DEEP } from '../src/binder';

describe('binder', () => {
  it('keeps the type of a whole hole', () => expect(bindLayout({ n: '{{count}}' }, { count: 3 })).toEqual({ n: 3 }));
  it('omits absent or null whole holes', () => expect(bindLayout({ a: '{{x}}', b: '{{y}}' }, { y: null })).toEqual({}));
  it('interpolates inside text, empty when absent', () =>
    expect(bindLayout({ t: 'Hi {{name}}{{none}}!' }, { name: 'Ana' })).toEqual({ t: 'Hi Ana!' }));
  it('expands $each with item and at', () =>
    expect(bindLayout([{ $each: 'xs', v: '{{.name}}', c: { $cycle: ['a', 'b'] } }], { xs: [{ name: 'p' }, { name: 'q' }, { name: 'r' }] })).toEqual([
      { v: 'p', c: 'a' },
      { v: 'q', c: 'b' },
      { v: 'r', c: 'a' },
    ]));
  it('emits nothing for a non-array $each source', () => expect(bindLayout([{ $each: 'x' }, 1], { x: 'no' })).toEqual([1]));
  it('$each outside a list is inert', () => expect(bindLayout({ $each: 'xs', a: 1 }, { xs: [1] })).toEqual({ a: 1 }));
  it('$when picks $value or $else', () => {
    expect(bindLayout({ a: { $when: 'on', $value: 'yes', $else: 'no' } }, { on: true })).toEqual({ a: 'yes' });
    expect(bindLayout({ a: { $when: 'on', $value: 'yes', $else: 'no' } }, { on: 0 })).toEqual({ a: 'yes' });
    expect(bindLayout({ a: { $when: 'on', $value: 'yes', $else: 'no' } }, { on: '' })).toEqual({ a: 'no' });
    expect(bindLayout({ a: { $when: 'on', $value: 'yes' } }, {})).toEqual({});
    expect(bindLayout({ a: { $when: 'on', k: 1 } }, { on: true })).toEqual({ a: { k: 1 } });
  });
  it('compares on strings with $ paths', () => {
    expect(bindLayout({ a: { $when: 'n=3', $value: 1 } }, { n: 3 })).toEqual({ a: 1 });
    expect(bindLayout({ a: { $when: 'n!=$m', $value: 1 } }, { n: 'x', m: 'x' })).toEqual({});
    expect(bindLayout({ a: { $when: '!flag', $value: 1 } }, { flag: [] })).toEqual({ a: 1 });
  });
  it('never outputs $ or prototype keys', () =>
    expect(bindLayout({ $x: 1, ['__proto__']: { p: 1 }, constructor: 2, ok: 3 } as never)).toEqual({ ok: 3 }));
  it('reads own properties only and cannot index arrays', () =>
    expect(bindLayout({ a: '{{xs.0}}', b: '{{toString}}' }, { xs: [1] })).toEqual({}));
  it('returns the sentinel past the depth limit', () => {
    let deep: unknown = 1;
    for (let i = 0; i < BIND_DEPTH_LIMIT + 2; i++) deep = [deep];
    expect(bindLayout(deep)).toBe(TOO_DEEP);
  });
});
