import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { TemplateManifest } from '../../src/authoring/template';
import type { PlaygroundContext, PlaygroundFocus } from './context';
import { fetchFigmaPng } from './figma';

export const TEMPLATES_DIR = resolve(import.meta.dirname, '../private/templates');

export interface TemplateSummary {
  id: string;
  name: string;
  prompt: string;
  variants: { id: string; label: string }[];
  origin?: TemplateManifest['origin'];
  updatedAt: number;
}

export interface TemplateBundle {
  manifest: TemplateManifest;
  sources: Record<string, string>;
  updatedAt: number;
}

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const FILE = /^[a-z0-9][a-z0-9.-]{0,80}\.sdui\.jsx$/;

export function assertId(id: string): void {
  if (!ID.test(id)) throw new Error(`Invalid template id "${id}" (lowercase letters, digits and dashes)`);
}

const dirOf = (id: string) => {
  assertId(id);
  return join(TEMPLATES_DIR, id);
};

function mtime(dir: string): number {
  return Math.max(0, ...readdirSync(dir).map((f) => statSync(join(dir, f)).mtimeMs));
}

export function listTemplates(): TemplateSummary[] {
  if (!existsSync(TEMPLATES_DIR)) return [];
  return readdirSync(TEMPLATES_DIR)
    .filter((id) => ID.test(id) && existsSync(join(TEMPLATES_DIR, id, 'template.json')))
    .map((id) => {
      const m = JSON.parse(readFileSync(join(TEMPLATES_DIR, id, 'template.json'), 'utf8')) as TemplateManifest;
      return { id, name: m.name, prompt: m.prompt, variants: m.variants.map((v) => ({ id: v.id, label: v.label })), origin: m.origin, updatedAt: mtime(join(TEMPLATES_DIR, id)) };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function readTemplate(id: string): TemplateBundle {
  const dir = dirOf(id);
  const manifest = JSON.parse(readFileSync(join(dir, 'template.json'), 'utf8')) as TemplateManifest;
  const sources = Object.fromEntries(
    manifest.variants.map((v) => [v.id, existsSync(join(dir, v.file)) ? readFileSync(join(dir, v.file), 'utf8') : '']),
  );
  return { manifest, sources, updatedAt: mtime(dir) };
}

export function writeTemplate(id: string, patch: { manifest?: TemplateManifest; sources?: Record<string, string> }): TemplateBundle {
  const dir = dirOf(id);
  mkdirSync(dir, { recursive: true });
  const current = existsSync(join(dir, 'template.json')) ? readTemplate(id).manifest : undefined;
  const manifest = patch.manifest ?? current;
  if (!manifest) throw new Error(`Template "${id}" doesn't exist`);
  if (manifest.id !== id) throw new Error(`Manifest id "${manifest.id}" doesn't match "${id}"`);
  for (const v of manifest.variants) if (!FILE.test(v.file)) throw new Error(`Invalid variant file name "${v.file}"`);
  if (patch.manifest) writeFileSync(join(dir, 'template.json'), JSON.stringify(manifest, null, 2) + '\n');
  for (const [vid, src] of Object.entries(patch.sources ?? {})) {
    const v = manifest.variants.find((x) => x.id === vid);
    if (!v) throw new Error(`Unknown variant "${vid}"`);
    writeFileSync(join(dir, v.file), src);
  }
  return readTemplate(id);
}

export function deleteTemplate(id: string): void {
  rmSync(dirOf(id), { recursive: true, force: true });
}

export function ensureSeed(): void {
  if (existsSync(TEMPLATES_DIR) && readdirSync(TEMPLATES_DIR).length) return;
  const manifest: TemplateManifest = {
    id: 'hotel-card',
    name: 'Hotel card',
    prompt: 'A single hotel the user asked about, with its name, rating, a short pitch and up to three room options. Use when the content is about one specific property.',
    schema: {
      type: 'object',
      required: ['name', 'pitch'],
      properties: {
        name: { type: 'string', description: 'Hotel name exactly as it appears in the content' },
        area: { type: 'string', description: 'Neighbourhood or city, short (e.g. "South Goa")' },
        rating: { type: 'number', description: 'Guest rating out of 5, if stated' },
        reviews: { type: 'string', description: 'Review count as written, e.g. "(12.6k reviews)"' },
        pitch: { type: 'string', description: 'One sentence on why this hotel fits the user, max 140 characters' },
        luxury: { type: 'boolean', description: 'True for 5-star or luxury-branded properties' },
        rooms: {
          type: 'array',
          description: 'Up to three room types with nightly prices',
          items: {
            type: 'object',
            required: ['name', 'price'],
            properties: { name: { type: 'string', description: 'Room type name' }, price: { type: 'string', description: 'Price per night with currency, e.g. "₹21,828"' } },
          },
        },
      },
    },
    samples: [
      {
        name: 'Luxury with rooms',
        data: { name: 'Seaview Resort & Spa', area: 'North Shore', rating: 4.7, reviews: '(7.7k reviews)', pitch: 'Beachfront resort with a kids club and a quiet stretch of sand.', luxury: true, rooms: [{ name: 'Deluxe Ocean View', price: '₹21,828' }, { name: 'Sea-Facing Villa', price: '₹26,800' }] },
      },
      { name: 'Minimal', data: { name: 'Palm Court Inn', pitch: 'Simple rooms a short walk from the beach.' } },
    ],
    variants: [
      { id: 'v1', label: 'v1 · Android 1.0', file: 'v1.sdui.jsx', targets: [{ platform: 'android', appVersion: '>=1.0.0 <1.1.0' }] },
      { id: 'v2', label: 'v2 · Android 1.1+, iOS', file: 'v2.sdui.jsx', targets: [{ platform: 'android', appVersion: '>=1.1.0' }, { platform: 'ios', appVersion: '>=1.0.0' }] },
      { id: 'v3', label: 'v3 · Web', file: 'v3.sdui.jsx', targets: [{ platform: 'web' }], fallback: true },
    ],
  };
  const v1 = `export default (props) => (
  <Card look="glass" gap="sm">
    <Text style="heading" tone="title">{props.name}</Text>
    <Text style="body">{props.pitch}</Text>
  </Card>
);
`;
  const v2 = `export default (props) => (
  <Card look="glass" gap="md">
    <Stack gap="xxs">
      <Text style="heading" tone="title">{props.name}</Text>
      {props.area && <Text style="caption" tone="secondary">{props.area}</Text>}
    </Stack>
    {props.rating && <Rating value={props.rating} countLabel={props.reviews} />}
    {props.luxury && <Pill look="success">LUXURY</Pill>}
    <Text style="body">{props.pitch}</Text>
    {props.rooms && (
      <Stack gap="sm" dividers>
        {props.rooms.map((room) => (
          <Stack direction="horizontal" justify="between">
            <Text style="bodyStrong">{room.name}</Text>
            <Text style="body">{room.price} / night</Text>
          </Stack>
        ))}
      </Stack>
    )}
    <Button look="primary" fullWidth action={{ kind: 'message', text: \`Show rooms at \${props.name}\` }}>
      View rooms
    </Button>
  </Card>
);
`;
  const v3 = v2.replace('<Card look="glass" gap="md">', '<Card look="outline" gap="md" padding="lg">');
  writeTemplate('hotel-card', { manifest, sources: { v1, v2, v3 } });
}

const WRITERS = () => join(TEMPLATES_DIR, '.writers.json');

/** Record who changed a template (an MCP client name), so the playground can attribute file changes. */
export function markWrite(id: string, by: string): void {
  mkdirSync(TEMPLATES_DIR, { recursive: true });
  let all: Record<string, { by: string; at: number }> = {};
  try {
    all = JSON.parse(readFileSync(WRITERS(), 'utf8'));
  } catch {}
  all[id] = { by, at: Date.now() };
  writeFileSync(WRITERS(), JSON.stringify(all));
}

/** The writer recorded for a template within the last few seconds, if any. */
export function recentWriter(id: string, withinMs = 5000): string | undefined {
  try {
    const w = (JSON.parse(readFileSync(WRITERS(), 'utf8')) as Record<string, { by: string; at: number }>)[id];
    return w && Date.now() - w.at < withinMs ? w.by : undefined;
  } catch {
    return undefined;
  }
}

/* ---------- playground ⇄ agent bridge ---------- */

const CONTEXT = () => join(TEMPLATES_DIR, '.context.json');
export const FOCUS_FILE = '.focus.json';

export function writeContext(ctx: PlaygroundContext): void {
  mkdirSync(TEMPLATES_DIR, { recursive: true });
  writeFileSync(CONTEXT(), JSON.stringify(ctx));
}

export function readContext(): PlaygroundContext | null {
  try {
    return JSON.parse(readFileSync(CONTEXT(), 'utf8')) as PlaygroundContext;
  } catch {
    return null;
  }
}

export function writeFocus(focus: PlaygroundFocus): void {
  mkdirSync(TEMPLATES_DIR, { recursive: true });
  writeFileSync(join(TEMPLATES_DIR, FOCUS_FILE), JSON.stringify(focus));
}

export function readFocus(): PlaygroundFocus | null {
  try {
    return JSON.parse(readFileSync(join(TEMPLATES_DIR, FOCUS_FILE), 'utf8')) as PlaygroundFocus;
  } catch {
    return null;
  }
}

/* ---------- reference images ---------- */

const ASSET = /^ref-[a-z0-9-]{1,60}\.(png|jpe?g|webp)$/;
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

function assetPath(id: string, file: string): string {
  if (!ASSET.test(file)) throw new Error(`Invalid asset name "${file}"`);
  return join(dirOf(id), file);
}

export function readAsset(id: string, file: string): { data: Buffer; type: string } {
  return { data: readFileSync(assetPath(id, file)), type: MIME[file.split('.').pop()!]! };
}

function imageExt(b: Buffer): 'png' | 'jpg' | 'webp' {
  if (b.subarray(0, 4).toString('hex') === '89504e47') return 'png';
  if (b.subarray(0, 2).toString('hex') === 'ffd8') return 'jpg';
  if (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return 'webp';
  throw new Error('Expected a PNG, JPEG or WebP image');
}

export interface NewReference {
  name: string;
  /** Image bytes; or omit and give `figma` to fetch it. */
  image?: Buffer;
  figma?: string;
  sample?: number;
  scale?: number;
}

/** Save a reference image (replacing one with the same name) and list it in the manifest. */
export async function addReference(id: string, r: NewReference): Promise<TemplateBundle> {
  const { manifest } = readTemplate(id);
  const name = r.name.trim() || 'reference';
  let image = r.image;
  let scale = r.scale;
  if (!image) {
    if (!r.figma) throw new Error('Give an image or a Figma link');
    image = await fetchFigmaPng(r.figma, 2);
    scale ??= 2;
  }
  if (image.length > 15 * 1024 * 1024) throw new Error('Image is over 15 MB');
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'ref';
  const file = `ref-${slug}-${Date.now().toString(36)}.${imageExt(image)}`;
  writeFileSync(assetPath(id, file), image);
  const old = (manifest.references ?? []).find((x) => x.name === name);
  if (old) rmSync(assetPath(id, old.image), { force: true });
  const ref = { name, image: file, ...(r.figma ? { figma: r.figma } : {}), ...(r.sample !== undefined ? { sample: r.sample } : {}), ...(scale ? { scale } : {}) };
  const references = [...(manifest.references ?? []).filter((x) => x.name !== name), ref];
  return writeTemplate(id, { manifest: { ...manifest, references } });
}

export function removeReference(id: string, name: string): TemplateBundle {
  const { manifest } = readTemplate(id);
  const ref = (manifest.references ?? []).find((x) => x.name === name);
  if (!ref) throw new Error(`No reference "${name}"`);
  rmSync(assetPath(id, ref.image), { force: true });
  return writeTemplate(id, { manifest: { ...manifest, references: manifest.references!.filter((x) => x.name !== name) } });
}
