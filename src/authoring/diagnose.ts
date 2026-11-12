import { NODE_DEFINITIONS } from '../nodes/schemas';
import { parseView } from '../parse/parse';
import { createViewNodeRegistry } from '../parse/registry';
import { compileJsx, instantiate, JsxCompileError, type CompiledTemplate } from './compile';
import { schemaPaths, usedPaths, validateSample, type TemplateManifest } from './template';

const registry = createViewNodeRegistry(NODE_DEFINITIONS);

export interface Diagnostic {
  severity: 'error' | 'warning';
  kind: 'compile' | 'parse' | 'empty' | 'sample' | 'props';
  message: string;
  line?: number;
  column?: number;
  sample?: string;
  path?: string;
}

export interface VariantReport {
  compiled?: CompiledTemplate;
  diagnostics: Diagnostic[];
}

/**
 * Everything wrong with one variant's JSX against a template: compile errors (with line/column),
 * nodes the parser drops for each sample, samples that render nothing, props read but not declared,
 * and samples that don't match the schema.
 */
export function diagnoseVariant(source: string, manifest: Pick<TemplateManifest, 'schema' | 'samples'>): VariantReport {
  const out: Diagnostic[] = [];
  let compiled: CompiledTemplate;
  try {
    compiled = compileJsx(source);
  } catch (e) {
    if (e instanceof JsxCompileError) {
      out.push({ severity: 'error', kind: 'compile', message: e.message.replace(/ \(line \d+:\d+\)$/, ''), line: e.line, column: e.column });
    } else out.push({ severity: 'error', kind: 'compile', message: (e as Error).message });
    return { diagnostics: out };
  }

  const samples = manifest.samples.length ? manifest.samples : [{ name: 'empty', data: {} }];
  for (const s of samples) {
    const parsed = parseView(registry, instantiate(compiled, s.data));
    for (const i of parsed.issues)
      out.push({ severity: i.fellBack ? 'warning' : 'error', kind: 'parse', sample: s.name, path: i.path, message: `${i.reason}${i.type ? ` (${i.type})` : ''}${i.detail ? `: ${i.detail}` : ''}` });
    if (!parsed.root) out.push({ severity: 'error', kind: 'empty', sample: s.name, message: 'Renders nothing with this sample' });
  }

  const declared = new Set(schemaPaths(manifest.schema));
  for (const p of usedPaths(compiled.tree)) if (!declared.has(p)) out.push({ severity: 'warning', kind: 'props', path: p, message: `Reads props.${p.replace(/\[\]/g, '[i]')} but the schema doesn't declare it` });
  for (const s of manifest.samples) for (const i of validateSample(manifest.schema, s.data)) out.push({ severity: 'warning', kind: 'sample', sample: s.name, path: i.path, message: i.message });

  return { compiled, diagnostics: out };
}

export function formatDiagnostics(ds: readonly Diagnostic[]): string {
  if (!ds.length) return 'No issues.';
  return ds
    .map((d) => {
      const where = [d.line !== undefined ? `line ${d.line}:${d.column ?? 0}` : '', d.sample ? `sample "${d.sample}"` : '', d.path ? `at ${d.path}` : ''].filter(Boolean).join(', ');
      return `- [${d.severity}] ${d.kind}${where ? ` (${where})` : ''}: ${d.message}`;
    })
    .join('\n');
}
