import { describe, expect, it } from 'vitest';
import { compileJsx } from '../src/authoring/compile';
import {
  resolveVariant,
  satisfies,
  schemaPaths,
  schemaToTs,
  selectionPrompt,
  selectionSchema,
  usedPaths,
  validateSample,
  validRange,
  type TemplateManifest,
} from '../src/authoring/template';

const manifest: TemplateManifest = {
  id: 'hotel-card',
  name: 'Hotel card',
  prompt: 'One hotel the user asked about: name, rating and a booking action.',
  schema: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', description: 'Hotel name as written in the content' },
      rating: { type: 'number', description: 'Guest rating out of 5' },
      tier: { type: 'string', enum: ['standard', 'luxury'] },
      rooms: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, price: { type: 'string' } } } },
    },
  },
  samples: [{ name: 'default', data: { name: 'Taj', rating: 4.5, tier: 'luxury', rooms: [{ name: 'Deluxe', price: '₹21,828' }] } }],
  variants: [
    { id: 'v1', label: 'v1', file: 'v1.sdui.jsx', targets: [{ platform: 'android', appVersion: '>=1.0.0 <1.1.0' }] },
    { id: 'v2', label: 'v2', file: 'v2.sdui.jsx', targets: [{ platform: 'android', appVersion: '>=1.1.0' }, { platform: 'ios', appVersion: '>=1.0.0' }] },
    { id: 'v3', label: 'v3', file: 'v3.sdui.jsx', targets: [{ platform: 'web' }] },
    { id: 'exp', label: 'exp', file: 'exp.sdui.jsx', targets: [{ experiment: { name: 'card-test', arm: 'B' } }] },
    { id: 'base', label: 'base', file: 'base.sdui.jsx', targets: [], fallback: true },
  ],
};

describe('semver ranges', () => {
  it.each([
    ['1.0.4', '>=1.0.0 <1.1.0', true],
    ['1.1.0', '>=1.0.0 <1.1.0', false],
    ['1.0.9', '1.0.x', true],
    ['1.2.3', '^1.0.0', true],
    ['2.0.0', '^1.0.0', false],
    ['1.2.9', '~1.2.0', true],
    ['1.3.0', '~1.2.0', false],
    ['3.0.0', '<1.0.0 || >=3.0.0', true],
    ['1.0.0', '= 1.0.0', true],
  ])('%s satisfies %s → %s', (v, r, ok) => expect(satisfies(v, r)).toBe(ok));
  it('validates range syntax', () => {
    expect(validRange('>=1.0.0 <2')).toBe(true);
    expect(validRange('one point oh')).toBe(false);
  });
});

describe('resolveVariant', () => {
  it.each([
    [{ platform: 'android', appVersion: '1.0.3' }, 'v1'],
    [{ platform: 'android', appVersion: '1.1.0' }, 'v2'],
    [{ platform: 'ios', appVersion: '1.0.0' }, 'v2'],
    [{ platform: 'web', appVersion: '0.0.1' }, 'v3'],
    [{ platform: 'ios', appVersion: '0.9.0', experiments: { 'card-test': 'B' } }, 'exp'],
    [{ platform: 'ios', appVersion: '0.9.0' }, 'base'],
  ] as const)('%o → %s', (ctx, id) => expect(resolveVariant(manifest, ctx as never).variant?.id).toBe(id));
  it('explains the match', () => {
    expect(resolveVariant(manifest, { platform: 'ios', appVersion: '1.4.0' }).reason).toBe('matches iOS >=1.0.0');
  });
});

describe('schema', () => {
  it('validates samples', () => {
    expect(validateSample(manifest.schema, manifest.samples[0]!.data)).toEqual([]);
    expect(validateSample(manifest.schema, { rating: 'high', tier: 'gold', extra: 1 })).toEqual([
      { path: 'name', message: 'is required' },
      { path: 'rating', message: 'expected number, got string' },
      { path: 'tier', message: 'must be one of standard, luxury' },
      { path: 'extra', message: 'is not in the schema' },
    ]);
  });
  it('lists declared and used paths', () => {
    expect(schemaPaths(manifest.schema)).toEqual(['name', 'rating', 'tier', 'rooms', 'rooms[].name', 'rooms[].price']);
    const t = compileJsx(`export default (props) => (
      <Stack>
        <Text style="heading">{props.name}</Text>
        {props.tier === 'luxury' && <Pill look="chip">Luxe</Pill>}
        {props.rooms.map((r) => <Text style="body">{r.name}</Text>)}
        <Text style="caption">{props.missing}</Text>
      </Stack>);`);
    expect(usedPaths(t.tree)).toEqual(['missing', 'name', 'rooms', 'rooms[].name', 'tier']);
  });
  it('prints a TypeScript view with field prompts', () => {
    const ts = schemaToTs(manifest.schema);
    expect(ts).toContain('/** Hotel name as written in the content */');
    expect(ts).toContain('  name: string;');
    expect(ts).toContain('  rating?: number;');
    expect(ts).toContain('  tier?: "standard" | "luxury";');
    expect(ts).toContain('  rooms?: {');
  });
});

describe('LLM selection', () => {
  it('collates template and field prompts into a system prompt', () => {
    const p = selectionPrompt([manifest]);
    expect(p).toContain('## hotel-card: Hotel card');
    expect(p).toContain('One hotel the user asked about');
    expect(p).toContain('- name (string, required): Hotel name as written in the content');
    expect(p).toContain('- rooms[].price (string)');
  });
  it('builds one response branch per template', () => {
    const s = selectionSchema([manifest, { ...manifest, id: 'other' }]);
    expect(s.oneOf).toHaveLength(2);
    expect(s.oneOf![1]!.properties!.templateId).toEqual({ type: 'string', const: 'other' });
    expect(s.oneOf![0]!.properties!.props).toBe(manifest.schema);
  });
});
