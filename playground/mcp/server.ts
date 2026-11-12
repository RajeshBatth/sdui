#!/usr/bin/env node
/**
 * SDUI template MCP server (stdio). Lets coding agents (Cursor, Codex, Claude Code) read and write the
 * playground's templates in playground/private/templates. Writes land on disk, so an open playground
 * picks them up live.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { diagnoseVariant, formatDiagnostics } from '../../src/authoring/diagnose';
import {
  describeTarget,
  resolveVariant,
  schemaToTs,
  selectionPrompt,
  selectionSchema,
  validRange,
  type JsonSchema,
  type TemplateManifest,
  type VariantInfo,
  type VariantTarget,
} from '../../src/authoring/template';
import { describeContext } from '../server/context';
import { readFileSync } from 'node:fs';
import { addReference, listTemplates, markWrite, readAsset, readContext, readTemplate, removeReference, writeFocus, writeTemplate } from '../server/store';
import { AUTHORING_GUIDE } from './guide';
import { designTokens, nodeIndex, nodeReference, TOKEN_SCALES } from './reference';
import { PLAYGROUND_URL, renderPng } from './render';

const server = new McpServer({ name: 'sdui', version: '0.1.0' }, { instructions: AUTHORING_GUIDE });

const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }] });
const fail = (t: string) => ({ content: [{ type: 'text' as const, text: t }], isError: true });
const clientName = () => server.server.getClientVersion()?.name ?? 'agent';

const ID = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, 'lowercase letters, digits and dashes');
const VARIANT_ID = z.string().regex(/^[a-z0-9][a-z0-9-]{0,40}$/, 'lowercase letters, digits and dashes');
const platform = z.enum(['android', 'ios', 'web']);
const target = z
  .object({
    platform: platform.optional(),
    appVersion: z.string().optional().describe('semver range, e.g. ">=1.1.0 <2.0.0", "^1.2", "1.x || >=3"'),
    experiment: z.object({ name: z.string(), arm: z.string() }).optional(),
  })
  .describe('A client the variant serves. Omitted fields match any client.');
const jsonSchema = z.record(z.string(), z.unknown()).describe('JSON Schema (type: "object") for the props. Give every field a "description": it is the extraction prompt.');
const samples = z.array(z.object({ name: z.string(), data: z.record(z.string(), z.unknown()) }));

function exists(id: string): boolean {
  return listTemplates().some((t) => t.id === id);
}

function save(id: string, patch: Parameters<typeof writeTemplate>[1]) {
  markWrite(id, clientName());
  return writeTemplate(id, patch);
}

function badRanges(targets: VariantTarget[] | undefined): string | null {
  const bad = (targets ?? []).filter((t) => t.appVersion && !validRange(t.appVersion)).map((t) => t.appVersion);
  return bad.length ? `Invalid version range: ${bad.join(', ')}` : null;
}

function report(m: TemplateManifest, variantId: string, source: string): string {
  const { diagnostics } = diagnoseVariant(source, m);
  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  return `${variantId}: ${errors ? `${errors} error(s)` : 'ok'}\n${formatDiagnostics(diagnostics)}`;
}

function describeTemplate(id: string, withSources: boolean): string {
  const { manifest: m, sources } = readTemplate(id);
  const parts = [
    `# ${m.id}: ${m.name}`,
    `Prompt: ${m.prompt}`,
    '',
    'Props (TypeScript view of the schema):',
    schemaToTs(m.schema),
    '',
    `JSON Schema:\n${JSON.stringify(m.schema, null, 2)}`,
    '',
    `Samples: ${m.samples.map((s, i) => `[${i}] ${s.name}`).join(', ') || 'none'}`,
    ...m.samples.map((s, i) => `Sample ${i} "${s.name}": ${JSON.stringify(s.data)}`),
    '',
    `References: ${(m.references ?? []).map((r) => `"${r.name}"${r.sample !== undefined ? ` (sample ${r.sample})` : ''}${r.figma ? ` from ${r.figma}` : ''}`).join(', ') || 'none'}`,
    '',
    'Variants (checked in this order):',
    ...m.variants.map((v, i) => `${i + 1}. ${v.id} "${v.label}" (${v.file})${v.fallback ? ' [fallback]' : ''}: ${v.targets.map(describeTarget).join('; ') || 'no targets'}`),
  ];
  if (withSources) for (const v of m.variants) parts.push('', `## ${v.id} (${v.file})`, '```jsx', sources[v.id] ?? '', '```');
  return parts.join('\n');
}

/* ------------------------------------------------------------------ */
/*  Reference                                                          */
/* ------------------------------------------------------------------ */

server.registerTool(
  'authoring_guide',
  { title: 'Authoring guide', description: 'How SDUI templates work and the exact JSX subset templates are written in. Read this before writing JSX.', annotations: { readOnlyHint: true } },
  async () => text(AUTHORING_GUIDE),
);

server.registerTool(
  'node_reference',
  {
    title: 'Node reference',
    description: 'Without a type: every element (tag, family, what its children are). With a type (e.g. "Card" or "scroll-row"): its props, token options and looks.',
    inputSchema: { type: z.string().optional() },
    annotations: { readOnlyHint: true },
  },
  async ({ type }) => {
    try {
      return text(type ? nodeReference(type) : nodeIndex());
    } catch (e) {
      return fail((e as Error).message);
    }
  },
);

server.registerTool(
  'design_tokens',
  {
    title: 'Design tokens',
    description: 'Token names and values for a scale (color, text, space, radius, icon, look, …). Without a scale: an overview. Use only these names in JSX.',
    inputSchema: { scale: z.enum(TOKEN_SCALES).optional() },
    annotations: { readOnlyHint: true },
  },
  async ({ scale }) => text(designTokens(scale)),
);

/* ------------------------------------------------------------------ */
/*  Reading                                                            */
/* ------------------------------------------------------------------ */

server.registerTool(
  'list_templates',
  { title: 'List templates', description: 'Every template with its id, name, selection prompt and variants.', annotations: { readOnlyHint: true } },
  async () => {
    const all = listTemplates();
    if (!all.length) return text('No templates yet. Create one with create_template.');
    return text(all.map((t) => `- ${t.id}: ${t.name} (${t.variants.map((v) => v.id).join(', ')})\n  ${t.prompt}`).join('\n'));
  },
);

server.registerTool(
  'get_template',
  {
    title: 'Get template',
    description: 'A template: prompt, props schema, samples, variants with their targets, and the JSX of every variant (or one).',
    inputSchema: { id: ID, variant: VARIANT_ID.optional().describe('Only include this variant’s JSX') },
    annotations: { readOnlyHint: true },
  },
  async ({ id, variant }) => {
    if (!exists(id)) return fail(`No template "${id}"`);
    if (!variant) return text(describeTemplate(id, true));
    const { manifest, sources } = readTemplate(id);
    const v = manifest.variants.find((x) => x.id === variant);
    if (!v) return fail(`No variant "${variant}". Variants: ${manifest.variants.map((x) => x.id).join(', ')}`);
    return text(`${describeTemplate(id, false)}\n\n## ${v.id} (${v.file})\n\`\`\`jsx\n${sources[v.id]}\n\`\`\``);
  },
);

/* ------------------------------------------------------------------ */
/*  Writing                                                            */
/* ------------------------------------------------------------------ */

server.registerTool(
  'create_template',
  {
    title: 'Create template',
    description: 'Create a template with one fallback variant "v1". Fails if the id exists.',
    inputSchema: {
      id: ID,
      name: z.string().min(1),
      prompt: z.string().min(1).describe('What the template shows and when the LLM should pick it'),
      jsx: z.string().describe('The v1 .sdui.jsx module'),
      schema: jsonSchema.optional(),
      samples: samples.optional(),
    },
  },
  async ({ id, name, prompt, jsx, schema, samples: s }) => {
    if (exists(id)) return fail(`Template "${id}" already exists. Use write_variant or update_template.`);
    const manifest: TemplateManifest = {
      id,
      name,
      prompt,
      schema: (schema as JsonSchema | undefined) ?? { type: 'object', properties: {} },
      samples: s?.length ? s : [{ name: 'default', data: {} }],
      variants: [{ id: 'v1', label: 'v1 · Default', file: 'v1.sdui.jsx', targets: [], fallback: true }],
    };
    const first = diagnoseVariant(jsx, manifest);
    if (!first.compiled) return fail(`Not created: the JSX doesn't compile.\n${formatDiagnostics(first.diagnostics)}`);
    save(id, { manifest, sources: { v1: jsx } });
    return text(`Created ${id}.\n${report(manifest, 'v1', jsx)}`);
  },
);

server.registerTool(
  'write_variant',
  {
    title: 'Write variant',
    description:
      'Write a variant’s JSX (creating the variant if it is new) and optionally its label, targets and fallback flag. The JSX must compile or nothing is written. Returns diagnostics for every sample.',
    inputSchema: {
      id: ID,
      variant: VARIANT_ID.describe('e.g. "v2"'),
      jsx: z.string().optional().describe('The full .sdui.jsx module. Omit to change only targets/label, or with copy_from.'),
      copy_from: VARIANT_ID.optional().describe('For a new variant: start from this variant’s JSX'),
      label: z.string().optional(),
      targets: z.array(target).optional().describe('Replaces the variant’s targets'),
      fallback: z.boolean().optional().describe('Serve this variant when no target matches (only one fallback)'),
      position: z.number().int().min(0).optional().describe('Where to put a new variant in the check order (default: before the fallback)'),
    },
  },
  async ({ id, variant, jsx, copy_from, label, targets, fallback, position }) => {
    if (!exists(id)) return fail(`No template "${id}"`);
    const bad = badRanges(targets);
    if (bad) return fail(bad);
    const { manifest, sources } = readTemplate(id);
    const existing = manifest.variants.find((v) => v.id === variant);
    const source = jsx ?? (copy_from ? sources[copy_from] : existing ? sources[variant] : undefined);
    if (source === undefined) return fail(copy_from ? `No variant "${copy_from}" to copy` : 'Give jsx (or copy_from) for a new variant');
    if (jsx !== undefined) {
      const r = diagnoseVariant(jsx, manifest);
      if (!r.compiled) return fail(`Not written: the JSX doesn't compile.\n${formatDiagnostics(r.diagnostics)}`);
    }
    let variants = manifest.variants.map((v) => (fallback ? { ...v, fallback: v.id === variant } : v));
    if (existing) {
      variants = variants.map((v) => (v.id === variant ? { ...v, label: label ?? v.label, targets: targets ?? v.targets, ...(fallback === false ? { fallback: false } : {}) } : v));
    } else {
      const v: VariantInfo = { id: variant, label: label ?? variant, file: `${variant}.sdui.jsx`, targets: targets ?? [], ...(fallback ? { fallback: true } : {}) };
      const fb = variants.findIndex((x) => x.fallback);
      const at = position ?? (fb >= 0 ? fb : variants.length);
      variants.splice(Math.min(at, variants.length), 0, v);
    }
    const next = { ...manifest, variants };
    save(id, { manifest: next, sources: { [variant]: source } });
    const v = next.variants.find((x) => x.id === variant)!;
    return text(`${existing ? 'Updated' : 'Added'} ${variant} (${v.targets.map(describeTarget).join('; ') || (v.fallback ? 'fallback' : 'no targets: never served until you add one')}).\n${report(next, variant, source)}`);
  },
);

server.registerTool(
  'update_template',
  {
    title: 'Update template',
    description: 'Change a template’s name, selection prompt, props schema, samples, or variant check order. Returns diagnostics for every variant.',
    inputSchema: {
      id: ID,
      name: z.string().min(1).optional(),
      prompt: z.string().min(1).optional(),
      schema: jsonSchema.optional(),
      samples: samples.optional().describe('Replaces all samples'),
      variant_order: z.array(VARIANT_ID).optional().describe('Every variant id, in the order they should be checked'),
    },
  },
  async ({ id, name, prompt, schema, samples: s, variant_order }) => {
    if (!exists(id)) return fail(`No template "${id}"`);
    const { manifest, sources } = readTemplate(id);
    let variants = manifest.variants;
    if (variant_order) {
      const ids = new Set(manifest.variants.map((v) => v.id));
      if (variant_order.length !== ids.size || !variant_order.every((v) => ids.has(v))) return fail(`variant_order must list each of: ${[...ids].join(', ')}`);
      variants = variant_order.map((v) => manifest.variants.find((x) => x.id === v)!);
    }
    const next: TemplateManifest = {
      ...manifest,
      name: name ?? manifest.name,
      prompt: prompt ?? manifest.prompt,
      schema: (schema as JsonSchema | undefined) ?? manifest.schema,
      samples: s ?? manifest.samples,
      variants,
    };
    save(id, { manifest: next });
    return text(`Updated ${id}.\n${next.variants.map((v) => report(next, v.id, sources[v.id] ?? '')).join('\n\n')}`);
  },
);

server.registerTool(
  'remove_variant',
  { title: 'Remove variant', description: 'Remove a variant from a template (its .sdui.jsx file stays on disk).', inputSchema: { id: ID, variant: VARIANT_ID }, annotations: { destructiveHint: true } },
  async ({ id, variant }) => {
    if (!exists(id)) return fail(`No template "${id}"`);
    const { manifest } = readTemplate(id);
    if (!manifest.variants.some((v) => v.id === variant)) return fail(`No variant "${variant}"`);
    if (manifest.variants.length === 1) return fail('A template needs at least one variant');
    save(id, { manifest: { ...manifest, variants: manifest.variants.filter((v) => v.id !== variant) } });
    return text(`Removed ${variant} from ${id}.`);
  },
);

/* ------------------------------------------------------------------ */
/*  Checking                                                           */
/* ------------------------------------------------------------------ */

server.registerTool(
  'validate_template',
  {
    title: 'Validate template',
    description: 'Compile every variant (or one) and check it against every sample: dropped nodes, empty renders, undeclared props, samples that break the schema.',
    inputSchema: { id: ID, variant: VARIANT_ID.optional() },
    annotations: { readOnlyHint: true },
  },
  async ({ id, variant }) => {
    if (!exists(id)) return fail(`No template "${id}"`);
    const { manifest, sources } = readTemplate(id);
    const vs = manifest.variants.filter((v) => !variant || v.id === variant);
    if (!vs.length) return fail(`No variant "${variant}"`);
    const out = vs.map((v) => report(manifest, v.id, sources[v.id] ?? ''));
    if (!manifest.variants.some((v) => v.fallback)) out.push('Note: no fallback variant; clients that match no target get nothing.');
    return text(out.join('\n\n'));
  },
);

server.registerTool(
  'resolve_variant',
  {
    title: 'Resolve variant',
    description: 'Which variant a client would be served, and why.',
    inputSchema: {
      id: ID,
      platform,
      app_version: z.string().describe('e.g. "1.1.0"'),
      experiments: z.record(z.string(), z.string()).optional().describe('experiment name → arm'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ id, platform: p, app_version, experiments }) => {
    if (!exists(id)) return fail(`No template "${id}"`);
    const r = resolveVariant(readTemplate(id).manifest, { platform: p, appVersion: app_version, experiments });
    return text(r.variant ? `${r.variant.id} (${r.variant.label}): ${r.reason}` : `Nothing served: ${r.reason}`);
  },
);

server.registerTool(
  'render_template',
  {
    title: 'Render template',
    description: `Render a variant with one of its samples to a PNG (2x), cropped to the content. Needs the playground running (${PLAYGROUND_URL}) and Chrome installed. Use it to compare against the Figma frame or screenshot.`,
    inputSchema: {
      id: ID,
      variant: VARIANT_ID.optional().describe('Default: the first variant'),
      sample: z.number().int().min(0).optional().describe('Sample index (default 0)'),
      width: z.number().int().min(240).max(800).optional().describe('Content width in points (default 360)'),
      frame: z.enum(['plain', 'chat']).optional().describe('"chat" draws it inside the chat screen'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ id, variant, sample, width, frame }) => {
    if (!exists(id)) return fail(`No template "${id}"`);
    const { manifest } = readTemplate(id);
    const v = variant ?? manifest.variants[0]?.id;
    if (!v || !manifest.variants.some((x) => x.id === v)) return fail(`No variant "${variant}"`);
    const i = sample ?? 0;
    if (i >= manifest.samples.length && manifest.samples.length) return fail(`No sample ${i}; there are ${manifest.samples.length}`);
    try {
      const r = await renderPng({ id, variant: v, sample: i, width: width ?? 360, frame: frame ?? 'plain' });
      const refs = manifest.references ?? [];
      const ref = refs.find((x) => x.sample === i) ?? refs.find((x) => x.sample === undefined);
      const content: ({ type: 'image'; data: string; mimeType: string } | { type: 'text'; text: string })[] = [
        { type: 'text', text: `Render of ${id} ${v} with sample "${manifest.samples[i]?.name ?? 'none'}" (${r.width}×${r.height}pt at 2x, 20pt padding around the content):` },
        { type: 'image', data: r.png, mimeType: 'image/png' },
      ];
      if (ref) {
        const a = readAsset(id, ref.image);
        content.push({ type: 'text', text: `Design reference "${ref.name}"${ref.figma ? ` (${ref.figma})` : ''}. Compare spacing, type, colour and alignment:` }, { type: 'image', data: a.data.toString('base64'), mimeType: a.type });
      } else content.push({ type: 'text', text: 'No design reference for this sample. Add one with set_reference to compare against.' });
      return { content };
    } catch (e) {
      return fail(`Render failed: ${(e as Error).message}`);
    }
  },
);

server.registerTool(
  'set_reference',
  {
    title: 'Set design reference',
    description:
      'Attach a design reference (a Figma frame or a screenshot) to a template, so render_template returns it beside the render and the playground can overlay it. Give a Figma link (needs FIGMA_TOKEN) or a local image path. Replaces a reference with the same name.',
    inputSchema: {
      id: ID,
      name: z.string().min(1).describe('e.g. "Luxury with rooms"'),
      figma_url: z.string().url().optional().describe('figma.com link with a node-id (Copy link to selection)'),
      image_path: z.string().optional().describe('Absolute path to a PNG, JPEG or WebP screenshot'),
      sample: z.number().int().min(0).optional().describe('Index of the sample whose data the design shows'),
      scale: z.number().int().min(1).max(4).optional().describe('Pixel density of the image (Figma exports are fetched at 2)'),
    },
  },
  async ({ id, name, figma_url, image_path, sample, scale }) => {
    if (!exists(id)) return fail(`No template "${id}"`);
    if (!figma_url && !image_path) return fail('Give figma_url or image_path');
    const { manifest } = readTemplate(id);
    if (sample !== undefined && sample >= manifest.samples.length) return fail(`No sample ${sample}`);
    try {
      const image = image_path ? readFileSync(image_path) : undefined;
      markWrite(id, clientName());
      const b = await addReference(id, { name, image, figma: figma_url, sample, scale });
      return text(`Saved reference "${name}" on ${id}. References: ${(b.manifest.references ?? []).map((r) => r.name).join(', ')}`);
    } catch (e) {
      return fail((e as Error).message);
    }
  },
);

server.registerTool(
  'remove_reference',
  { title: 'Remove design reference', description: 'Delete a design reference and its image.', inputSchema: { id: ID, name: z.string() }, annotations: { destructiveHint: true } },
  async ({ id, name }) => {
    if (!exists(id)) return fail(`No template "${id}"`);
    try {
      markWrite(id, clientName());
      removeReference(id, name);
      return text(`Removed reference "${name}" from ${id}.`);
    } catch (e) {
      return fail((e as Error).message);
    }
  },
);

/* ------------------------------------------------------------------ */
/*  Playground bridge                                                  */
/* ------------------------------------------------------------------ */

server.registerTool(
  'playground_context',
  {
    title: 'Playground context',
    description:
      'What the user is looking at in the SDUI playground right now: template, variant, sample, simulated client, and the selected node with its JSX lines. Call this first when the user says "this", "here", "the selected …" or refers to the playground.',
    annotations: { readOnlyHint: true },
  },
  async () => {
    const ctx = readContext();
    if (!ctx) return fail(`The playground hasn't reported anything yet. Open ${PLAYGROUND_URL}/#/playground.`);
    const stale = Date.now() - ctx.at > 30 * 60 * 1000;
    return text(`${describeContext(ctx, { withAge: true })}${stale ? '\n\nThis is over 30 minutes old; the playground may be closed.' : ''}\n\nSample data: ${JSON.stringify(ctx.sample.data)}`);
  },
);

server.registerTool(
  'show_in_playground',
  {
    title: 'Show in playground',
    description: 'Open a template in the user’s playground, optionally on a variant and sample, and select the node that starts on a JSX line. Use after writing so the user sees the change.',
    inputSchema: {
      id: ID,
      variant: VARIANT_ID.optional(),
      sample: z.number().int().min(0).optional(),
      line: z.number().int().min(1).optional().describe('1-based line in the variant’s JSX where the node to select starts'),
    },
  },
  async ({ id, variant, sample, line }) => {
    if (!exists(id)) return fail(`No template "${id}"`);
    const { manifest } = readTemplate(id);
    if (variant && !manifest.variants.some((v) => v.id === variant)) return fail(`No variant "${variant}"`);
    if (sample !== undefined && sample >= manifest.samples.length) return fail(`No sample ${sample}`);
    writeFocus({ id, variant, sample, line, by: clientName(), at: Date.now() });
    const open = readContext();
    const live = open && Date.now() - open.at < 30 * 60 * 1000;
    return text(live ? `Asked the playground to show ${id}${variant ? ` ${variant}` : ''}.` : `Queued, but no playground looks open. Open ${PLAYGROUND_URL}/#/playground.`);
  },
);

server.registerTool(
  'selection_prompt',
  {
    title: 'Selection prompt',
    description: 'The collated system prompt and response JSON Schema the backend gives the LLM to choose a template and extract its props.',
    inputSchema: { ids: z.array(ID).optional().describe('Default: every template') },
    annotations: { readOnlyHint: true },
  },
  async ({ ids }) => {
    const all = listTemplates()
      .filter((t) => !ids || ids.includes(t.id))
      .map((t) => readTemplate(t.id).manifest);
    if (!all.length) return fail('No templates');
    return text(`${selectionPrompt(all)}\n\nResponse schema:\n${JSON.stringify(selectionSchema(all), null, 2)}`);
  },
);

await server.connect(new StdioServerTransport());
