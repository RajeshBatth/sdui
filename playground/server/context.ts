/** What the playground is showing, shared with agents. Pure: used by the browser and the MCP server. */
export interface PlaygroundContext {
  clientId: string;
  at: number;
  templateId: string;
  templateName: string;
  variant: string;
  variantLabel: string;
  variantFile: string;
  sample: { index: number; name: string; data: Record<string, unknown> };
  client: { platform: string; appVersion: string; experiments?: Record<string, string>; served: string | null };
  compileError?: { line: number; column: number; message: string };
  selection?: {
    /** Template path of the node, e.g. children.2.$value */
    path: string;
    type: string;
    /** `if luxury`, `else`, `each rooms` when the node sits under a condition or loop. */
    control?: string;
    /** 1-based, inclusive. */
    lines: [number, number];
    jsx: string;
  };
}

/** Agent asks the playground to open something. */
export interface PlaygroundFocus {
  id: string;
  variant?: string;
  sample?: number;
  /** Select the node that starts on this line of the variant's JSX. */
  line?: number;
  by: string;
  at: number;
}

const tag = (type: string) => type.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');

const ago = (t: number) => {
  const s = Math.round((Date.now() - t) / 1000);
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago`;
};

/** Plain-text description of what the user is looking at, for an agent prompt. */
export function describeContext(c: PlaygroundContext, opts: { withAge?: boolean } = {}): string {
  const lines = [
    `SDUI playground${opts.withAge ? ` (updated ${ago(c.at)})` : ''}:`,
    `- Template: ${c.templateId} ("${c.templateName}")`,
    `- Variant: ${c.variant} "${c.variantLabel}", file ${c.variantFile}`,
    `- Sample: [${c.sample.index}] "${c.sample.name}"`,
    `- Simulated client: ${c.client.platform} ${c.client.appVersion}${c.client.experiments && Object.keys(c.client.experiments).length ? ` ${JSON.stringify(c.client.experiments)}` : ''} → served ${c.client.served ?? 'nothing'}`,
  ];
  if (c.compileError) lines.push(`- The variant doesn't compile: line ${c.compileError.line}:${c.compileError.column} ${c.compileError.message}`);
  if (c.selection) {
    const s = c.selection;
    lines.push(
      `- Selected: <${tag(s.type)}> at ${s.lines[0] === s.lines[1] ? `line ${s.lines[0]}` : `lines ${s.lines[0]}–${s.lines[1]}`}${s.control ? ` (rendered ${s.control})` : ''}, template path ${s.path}`,
      '',
      '```jsx',
      s.jsx,
      '```',
    );
  } else lines.push('- Nothing selected.');
  return lines.join('\n');
}
