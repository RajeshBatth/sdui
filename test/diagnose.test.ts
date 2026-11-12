import { describe, expect, it } from 'vitest';
import { compileJsx, instantiate } from '../src/authoring/compile';
import { diagnoseVariant } from '../src/authoring/diagnose';
import type { TemplateManifest } from '../src/authoring/template';

const manifest: Pick<TemplateManifest, 'schema' | 'samples'> = {
  schema: { type: 'object', properties: { title: { type: 'string', description: 'Title' } }, required: ['title'] },
  samples: [
    { name: 'full', data: { title: 'Hello', tag: 'New' } },
    { name: 'none', data: {} },
  ],
};

describe('diagnoseVariant', () => {
  it('reports compile errors with a location and nothing else', () => {
    const r = diagnoseVariant('export default (props) => (<Stack>{props.a + 1}</Stack>);', manifest);
    expect(r.compiled).toBeUndefined();
    expect(r.diagnostics).toEqual([expect.objectContaining({ severity: 'error', kind: 'compile', line: 1 })]);
  });

  it('flags undeclared props and samples outside the schema', () => {
    const r = diagnoseVariant('export default (props) => (<Card><Text style="body">{props.title}</Text>{props.tag && <Pill>{props.tag}</Pill>}</Card>);', manifest);
    expect(r.compiled).toBeDefined();
    // The "none" sample lacks the required title, so its Text would be dropped on clients.
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([expect.objectContaining({ kind: 'parse', sample: 'none', path: 'root.children[0]' })]);
    expect(r.diagnostics).toContainEqual(expect.objectContaining({ kind: 'props', path: 'tag' }));
    expect(r.diagnostics).toContainEqual(expect.objectContaining({ kind: 'sample', sample: 'full' }));
    expect(r.diagnostics).toContainEqual(expect.objectContaining({ kind: 'sample', sample: 'none' }));
  });

  it('reports a sample that renders nothing', () => {
    const r = diagnoseVariant('export default (props) => (<>{props.title && <Text style="body">{props.title}</Text>}</>);', manifest);
    const empty = r.diagnostics.filter((d) => d.kind === 'empty' || d.kind === 'compile');
    expect(empty.length).toBeGreaterThan(0);
  });
});

describe('instantiate', () => {
  it('binds a template to props and returns a plain tree', () => {
    const t = compileJsx('export default (props) => (<Text style="body">{props.title}</Text>);');
    expect(instantiate(t, { title: 'Hi' })).toEqual({ type: 'text', style: 'body', value: 'Hi' });
  });
});
