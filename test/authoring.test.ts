import { describe, expect, it } from 'vitest';
import { bindLayout, parseView, viewNodeRegistry } from '../src';
import { compileJsx, JsxCompileError, toEnvelope } from '../src/authoring/compile';
import { printJsx } from '../src/authoring/print';
import { STORIES } from '../playground/stories';

const clean = (v: unknown) => JSON.parse(JSON.stringify(v));

describe('JSX ⇄ JSON round trip', () => {
  it.each(STORIES.map((s) => [s.id, s.raw] as const))('%s', (_, raw) => {
    const jsx = printJsx(raw as Record<string, unknown>);
    const back = compileJsx(jsx);
    expect(back.bound).toBe(false);
    expect(back.tree).toEqual(clean(raw));
  });
});

describe('compileJsx', () => {
  const src = `
// @name Hotel card
// @prompt Seaview Resort
export const sample = { hotel: { name: 'Taj', rating: 4.5 }, sale: true, rooms: [{ name: 'Deluxe', price: '₹21,828' }, { name: 'Villa', price: '₹26,800' }] };

export default (props) => (
  <Card look="glass" gap="md">
    <Text style="heading">{props.hotel.name}</Text>
    <Text style="caption">Rated {props.hotel.rating} by guests</Text>
    {props.sale && <Pill look="success">SALE</Pill>}
    {props.hotel.rating ? <Rating value={props.hotel.rating} /> : <Text style="caption">New</Text>}
    {props.rooms.map((room) => (
      <Text style="body">{room.name} · {room.price}</Text>
    ))}
    <Button look={props.sale ? 'primary' : 'link'} action={{ kind: 'message', text: \`Book \${props.hotel.name}\` }}>
      Book now
    </Button>
  </Card>
);`;

  it('compiles holes, conditionals and loops into binder syntax', () => {
    const t = compileJsx(src);
    expect(t.meta).toEqual({ name: 'Hotel card', prompt: 'Seaview Resort' });
    expect(t.bound).toBe(true);
    const kids = t.tree.children as Record<string, unknown>[];
    expect(kids[0]).toEqual({ type: 'text', style: 'heading', value: '{{hotel.name}}' });
    expect(kids[1]).toEqual({ type: 'text', style: 'caption', value: 'Rated {{hotel.rating}} by guests' });
    expect(kids[2]).toEqual({ $when: 'sale', $value: { type: 'pill', look: 'success', label: 'SALE' } });
    expect(kids[3]).toMatchObject({ $when: 'hotel.rating', $else: { type: 'text', value: 'New' } });
    expect(kids[4]).toEqual({ $each: 'rooms', type: 'text', style: 'body', value: '{{.name}} · {{.price}}' });
    expect(kids[5]).toMatchObject({ look: { $when: 'sale', $value: 'primary', $else: 'link' }, label: 'Book now', action: { text: 'Book {{hotel.name}}' } });
  });

  it('binds with the sample into a tree the engine parses cleanly', () => {
    const t = compileJsx(src);
    const env = toEnvelope(t);
    const bound = bindLayout(env.layout, env.props as Record<string, unknown>) as Record<string, unknown>;
    const parsed = parseView(viewNodeRegistry, bound);
    expect(parsed.issues).toEqual([]);
    const kids = bound.children as Record<string, unknown>[];
    expect(kids.map((k) => (k.type === 'rating' ? 'rating' : (k.value ?? k.label ?? k.type)))).toEqual(['Taj', 'Rated 4.5 by guests', 'SALE', 'rating', 'Deluxe · ₹21,828', 'Villa · ₹26,800', 'Book now']);
  });

  it('prints bound trees back to the same JSX semantics', () => {
    const t = compileJsx(src);
    const again = compileJsx(printJsx(t.tree, { sample: t.sample, meta: t.meta }));
    expect(again.tree).toEqual(t.tree);
    expect(again.sample).toEqual(t.sample);
  });

  it('supports comparisons and negation', () => {
    const t = compileJsx(`export default (props) => (
      <Stack>
        {props.tier === 'gold' && <Text style="body">Gold</Text>}
        {!props.hidden && <Text style="body">Shown</Text>}
        {props.a !== props.b ? <Text style="body">Diff</Text> : null}
      </Stack>
    );`);
    const kids = t.tree.children as Record<string, unknown>[];
    expect(kids.map((k) => k.$when)).toEqual(['tier=gold', '!hidden', 'a!=$b']);
  });

  it.each([
    ['unknown element', 'export default () => (<Foo />);', /Unknown element <Foo>/],
    ['spread props', 'export default (props) => (<Card {...props} />);', /Spread props/],
    ['loose text in a stack', 'export default () => (<Stack>hello</Stack>);', /wrap it in <Text>/],
    ['outside scope', 'export default (props) => (<Text style="body">{window.x}</Text>);', /Unknown name "window"/],
    ['array index', 'export default (props) => (<Text style="body">{props.a[0]}</Text>);', /no \[index\]/],
    ['syntax error', 'export default () => (<Card>);', JsxCompileError],
  ])('rejects %s with a located error', (_, code, err) => {
    expect(() => compileJsx(code)).toThrow(err as RegExp);
    try {
      compileJsx(code);
    } catch (e) {
      expect((e as JsxCompileError).line).toBeGreaterThan(0);
    }
  });
});

describe('loop variable names', () => {
  it('keeps the author’s map parameter names when printing back', () => {
    const src = `export default (props) => (
  <Stack>
    {props.rooms.map((room) => (
      <Stack>
        {room.perks.map((perk) => (
          <Text>{perk.label}</Text>
        ))}
      </Stack>
    ))}
  </Stack>
);
`;
    const c = compileJsx(src);
    const out = printJsx(c.tree, { itemNames: c.itemNames });
    expect(out).toContain('props.rooms.map((room) =>');
    expect(out).toContain('room.perks.map((perk) =>');
    expect(out).toContain('{perk.label}');
    expect(compileJsx(out).tree).toEqual(c.tree);
  });
});
