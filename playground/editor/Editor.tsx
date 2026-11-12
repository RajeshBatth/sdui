import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { bindLayout, parseView, TOO_DEEP, viewNodeRegistry, type ViewNode } from '../../src';
import { compileJsx, JsxCompileError, toEnvelope, type CompiledTemplate } from '../../src/authoring/compile';
import { printJsx } from '../../src/authoring/print';
import {
  describeTarget,
  inferSchema,
  resolveVariant,
  schemaPaths,
  schemaToTs,
  selectionPrompt,
  usedPaths,
  validateSample,
  validRange,
  type ClientContext,
  type JsonSchema,
  type Platform,
  type TemplateManifest,
  type TemplateReference,
  type VariantInfo,
  type VariantTarget,
} from '../../src/authoring/template';
import { ViewDraftsProvider } from '../../src/render/drafts';
import { ViewRenderer } from '../../src/render/ViewRenderer';
import { BACKGROUNDS, ChatFrame, manifest as theme, registry, WIDTHS, type Frame } from '../shared';
import { STORIES } from '../stories';
import { describeContext, type PlaygroundContext } from '../server/context';
import { api, CLIENT_ID, subscribe, type FocusEvent, type TemplateBundle, type TemplateSummary } from './api';
import { CodeEditor, type CodeError } from './CodeEditor';
import { playgroundHash, templateFromHash } from './fromStory';
import {
  childNodes,
  FAMILY_OF,
  fieldKind,
  getAt,
  INPUT_TYPES,
  insertAt,
  insideForm,
  isContainer,
  isNode,
  moveAt,
  nodeLabel,
  parseKey,
  pathKey,
  removeAt,
  SECTIONS,
  sectionOf,
  setAt,
  shapeOf,
  SLOT_KEYS,
  snippet,
  TYPE_GLYPH,
  type Json,
  type Path,
} from './model';

type Obj = Record<string, unknown>;
type ViewMode = 'code' | 'split' | 'preview';
type Menu = 'templates' | 'client' | 'issues' | 'insert' | 'reference' | null;
type RefMode = 'off' | 'side' | 'overlay' | 'diff';

interface Activity {
  id: string;
  by: string;
  at: number;
}

const PLATFORM_NAME: Record<Platform, string> = { android: 'Android', ios: 'iOS', web: 'Web' };

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

function useTemplate(id: string | null) {
  const [bundle, setBundle] = useState<TemplateBundle | null>(null);
  const [status, setStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<{ manifest?: TemplateManifest; sources?: Record<string, string> }>({});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async () => {
    if (!id) return setBundle(null);
    try {
      setBundle(await api.get(id));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  const flush = useCallback(async () => {
    if (!id) return;
    const patch = pending.current;
    pending.current = {};
    if (!patch.manifest && !patch.sources) return;
    try {
      await api.put(id, patch);
      setStatus('saved');
      setError(null);
    } catch (e) {
      setStatus('error');
      setError((e as Error).message);
    }
  }, [id]);

  const schedule = () => {
    setStatus('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 450);
  };

  const setSource = (variant: string, src: string) => {
    setBundle((b) => (b ? { ...b, sources: { ...b.sources, [variant]: src } } : b));
    pending.current.sources = { ...pending.current.sources, [variant]: src };
    schedule();
  };
  const setManifest = (fn: (m: TemplateManifest) => TemplateManifest, extraSources?: Record<string, string>) => {
    setBundle((b) => {
      if (!b) return b;
      const manifest = fn(b.manifest);
      pending.current.manifest = manifest;
      if (extraSources) pending.current.sources = { ...pending.current.sources, ...extraSources };
      return { ...b, manifest, sources: { ...b.sources, ...extraSources } };
    });
    schedule();
  };
  const flushNow = async () => {
    clearTimeout(timer.current);
    await flush();
  };
  return { bundle, status, error, reload: load, setSource, setManifest, flushNow, hasPending: () => Boolean(pending.current.manifest || pending.current.sources) };
}

interface Compiled {
  ok?: CompiledTemplate;
  error?: CodeError;
}

function compile(src: string): Compiled {
  try {
    return { ok: compileJsx(src) };
  } catch (e) {
    if (e instanceof JsxCompileError) return { error: { line: e.line, column: e.column, message: e.message.replace(/ \(line \d+:\d+\)$/, '') } };
    return { error: { line: 1, column: 0, message: (e as Error).message } };
  }
}

/** Template paths for every node object in the template tree. */
function templatePaths(tree: Json): WeakMap<object, string> {
  const map = new WeakMap<object, string>();
  const walk = (n: Json, p: Path) => {
    if (!isNode(n)) return;
    map.set(n, pathKey(p));
    for (const c of childNodes(n, p)) walk(c.node, c.path);
  };
  walk(tree, []);
  return map;
}

/* ------------------------------------------------------------------ */
/*  Editor                                                             */
/* ------------------------------------------------------------------ */

export function Editor({ modeSwitch }: { modeSwitch: ReactNode }) {
  const [list, setList] = useState<TemplateSummary[]>([]);
  const [tplId, setTplId] = useState<string | null>(() => templateFromHash());
  const tpl = useTemplate(tplId);
  const { bundle } = tpl;
  const manifest = bundle?.manifest;

  const [variantId, setVariantId] = useState<string>('');
  const [sampleIdx, setSampleIdx] = useState(0);
  const [sim, setSim] = useState<ClientContext>({ platform: 'android', appVersion: '1.1.0', experiments: {} });
  const [followSim, setFollowSim] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [popFor, setPopFor] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [width, setWidth] = useState(360);
  const [frame, setFrame] = useState<Frame>('chat');
  const [mode, setMode] = useState<'select' | 'interact'>('select');
  const [menu, setMenu] = useState<Menu>(null);
  const [drawer, setDrawer] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const pendingFocus = useRef<FocusEvent | null>(null);
  const [refMode, setRefMode] = useState<RefMode>('off');
  const [refName, setRefName] = useState<string | null>(null);
  const [refOpacity, setRefOpacity] = useState(0.5);
  const [refBusy, setRefBusy] = useState<string | null>(null);
  const [drawerFocus, setDrawerFocus] = useState<{ section: string; n: number } | null>(null);
  const openDrawer = (section: string) => {
    setDrawer(true);
    setDrawerFocus((f) => ({ section, n: (f?.n ?? 0) + 1 }));
  };
  const [focusTick, setFocusTick] = useState(0);

  const flash = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 1800);
  };
  /** Save a reference image (or fetch one from Figma) and show it. */
  const addReference = async (r: { name: string; imageBase64?: string; figma?: string; sample?: number; scale?: number }) => {
    if (!tplId) return;
    setRefBusy(r.figma && !r.imageBase64 ? 'Fetching from Figma…' : 'Saving…');
    try {
      await tpl.flushNow();
      await api.addReference(tplId, r);
      await tpl.reload();
      setRefName(r.name);
      setRefMode((m) => (m === 'off' ? 'side' : m));
      setRefBusy(null);
      flash(`Added reference “${r.name}”`);
    } catch (e) {
      setRefBusy(`⚠ ${(e as Error).message}`);
    }
  };
  const addImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const dataUrl = await new Promise<string>((ok, fail) => {
      const fr = new FileReader();
      fr.onload = () => ok(String(fr.result));
      fr.onerror = () => fail(fr.error);
      fr.readAsDataURL(file);
    });
    const n = (bundle?.manifest.references?.length ?? 0) + 1;
    await addReference({ name: file.name && !/^image\.\w+$/.test(file.name) ? file.name.replace(/\.\w+$/, '') : `Screenshot ${n}`, imageBase64: dataUrl, sample: sampleIdx });
  };

  const nudgeRef = (name: string, dx: number, dy: number, reset = false) =>
    tpl.setManifest((m) => ({
      ...m,
      references: (m.references ?? []).map((r) => {
        if (r.name !== name) return r;
        const x = reset ? 0 : (r.offset?.x ?? 0) + dx;
        const y = reset ? 0 : (r.offset?.y ?? 0) + dy;
        const { offset: _drop, ...rest } = r;
        return x || y ? { ...rest, offset: { x, y } } : rest;
      }),
    }));

  const select = (k: string | null, pop = false) => {
    setSelected(k);
    setPopFor(pop ? k : null);
  };

  const refreshList = useCallback(async () => {
    const l = await api.list();
    setList(l);
    setTplId((cur) => cur ?? l[0]?.id ?? null);
  }, []);
  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  // The URL names the open template, so a link (e.g. from the explorer) opens it.
  useEffect(() => {
    const on = () => {
      const t = templateFromHash();
      if (t) setTplId(t);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    if (tplId && templateFromHash() !== tplId) history.replaceState(null, '', playgroundHash(tplId));
  }, [tplId]);

  /** An agent asked to show something (show_in_playground). */
  const onAgentFocus = (e: FocusEvent) => {
    pendingFocus.current = e;
    setTplId(e.id);
    setFollowSim(false);
    setMenu(null);
    setFocusTick((t) => t + 1);
    flash(`${e.by} opened ${e.id}${e.variant ? ` · ${e.variant}` : ''}`);
  };

  useEffect(
    () =>
      subscribe((e) => {
        void refreshList();
        if (e.by === CLIENT_ID) return;
        setActivity((a) => [{ id: e.id, by: e.by, at: e.at }, ...a].slice(0, 30));
        if (e.id === tplId && !tpl.hasPending()) {
          void tpl.reload();
          flash(`Updated by ${e.by === 'disk' ? 'a file change' : e.by}`);
        }
      }, onAgentFocus),
    [tplId, refreshList],
  );

  useEffect(() => {
    if (!manifest) return;
    if (!manifest.variants.some((v) => v.id === variantId)) setVariantId(resolveVariant(manifest, sim).variant?.id ?? manifest.variants[0]?.id ?? '');
    if (sampleIdx >= manifest.samples.length) setSampleIdx(0);
  }, [manifest]);

  const resolution = manifest ? resolveVariant(manifest, sim) : null;
  useEffect(() => {
    if (followSim && resolution?.variant && resolution.variant.id !== variantId) setVariantId(resolution.variant.id);
  }, [followSim, resolution?.variant?.id]);

  const source = bundle?.sources[variantId] ?? '';
  const compiled = useMemo(() => compile(source), [source]);
  const tree = compiled.ok?.tree;
  const sample = manifest?.samples[sampleIdx]?.data ?? {};

  const view = useMemo(() => {
    if (!tree) return null;
    const srcOf = new Map<object, object>();
    const bound = compiled.ok!.bound ? bindLayout(tree, sample, (b, s) => srcOf.set(b, s)) : tree;
    if (bound === TOO_DEEP || bound === null) return { parsed: null, issues: [], keyOf: new WeakMap<object, string>() };
    const parsed = parseView(viewNodeRegistry, bound);
    const tplKeys = templatePaths(tree);
    const keyOf = new WeakMap<object, string>();
    const pair = (p: Json, b: Json) => {
      if (!isNode(p) || !isNode(b)) return;
      const k = tplKeys.get(srcOf.get(b) ?? b);
      if (k !== undefined) keyOf.set(p, k);
      const pk = childNodes(p);
      const bk = childNodes(b);
      if (pk.length === bk.length) pk.forEach((c, i) => pair(c.node, bk[i]!.node));
    };
    pair(parsed.root, bound);
    return { parsed: parsed.root, issues: parsed.issues, keyOf };
  }, [tree, sample, compiled.ok]);

  const selectedPath = selected !== null ? parseKey(selected) : null;
  const selectedNode = selectedPath && tree ? getAt(tree, selectedPath) : undefined;
  const mark = useMemo(() => {
    if (!compiled.ok || !isNode(selectedNode)) return null;
    return compiled.ok.locs.get(selectedNode as object) ?? null;
  }, [compiled.ok, selectedNode]);

  /* ---------- what agents see (playground_context) ---------- */
  const agentContext = useMemo((): PlaygroundContext | null => {
    if (!manifest) return null;
    const v = manifest.variants.find((x) => x.id === variantId);
    if (!v) return null;
    const s = manifest.samples[sampleIdx];
    let selection: PlaygroundContext['selection'];
    if (mark && selected !== null && selectedPath && isNode(selectedNode) && tree) {
      const lineOf = (o: number) => source.slice(0, o).split('\n').length;
      const a = lineOf(mark.from);
      const b = lineOf(mark.to);
      const shown = source.split('\n').slice(a - 1, Math.min(b, a + 59));
      selection = { path: selected, type: selectedNode.type, control: controlBadge(tree, selectedPath) ?? undefined, lines: [a, b], jsx: shown.join('\n') + (b > a + 59 ? '\n…' : '') };
    }
    return {
      clientId: CLIENT_ID,
      at: Date.now(),
      templateId: manifest.id,
      templateName: manifest.name,
      variant: v.id,
      variantLabel: v.label,
      variantFile: v.file,
      sample: { index: sampleIdx, name: s?.name ?? 'none', data: s?.data ?? {} },
      client: { platform: sim.platform, appVersion: sim.appVersion, experiments: sim.experiments, served: resolution?.variant?.id ?? null },
      compileError: compiled.error ? { line: compiled.error.line, column: compiled.error.column, message: compiled.error.message } : undefined,
      selection,
    };
  }, [manifest, variantId, sampleIdx, mark, selected, source, sim, compiled.error, resolution?.variant?.id]);

  useEffect(() => {
    if (!agentContext) return;
    const post = () => {
      if (document.visibilityState === 'visible') void api.putContext({ ...agentContext, at: Date.now() }).catch(() => undefined);
    };
    const t = setTimeout(post, 250);
    window.addEventListener('focus', post);
    return () => {
      clearTimeout(t);
      window.removeEventListener('focus', post);
    };
  }, [agentContext]);

  useEffect(() => {
    const f = pendingFocus.current;
    if (!f || !manifest || manifest.id !== f.id) return;
    if (f.variant && f.variant !== variantId && manifest.variants.some((v) => v.id === f.variant)) {
      setVariantId(f.variant);
      return;
    }
    pendingFocus.current = null;
    if (f.sample !== undefined && f.sample < manifest.samples.length) setSampleIdx(f.sample);
    if (f.line && compiled.ok) {
      const lines = source.split('\n');
      const at = lines.slice(0, f.line - 1).join('\n').length + (f.line > 1 ? 1 : 0) + ((lines[f.line - 1] ?? '').match(/^\s*/)?.[0].length ?? 0);
      select(nodeAt(at));
    } else select(null);
  }, [manifest, variantId, compiled, focusTick]);

  /* ---------- edits that go through the tree and print back as JSX ---------- */
  const writeTree = (next: Json, sel?: string | null) => {
    if (!compiled.ok) return;
    tpl.setSource(variantId, printJsx(next as Obj, { itemNames: compiled.ok.itemNames }));
    if (sel !== undefined) select(sel, sel !== null && popFor !== null);
  };
  const updateField = (path: Path, value: Json) => tree && writeTree(setAt(tree, path, value));
  const insert = (type: string) => {
    if (!tree) return;
    let node: Json = snippet(type);
    const target = selectedPath && isNode(selectedNode) ? selectedPath : [];
    const targetNode = getAt(tree, target);
    let containerPath: Path;
    let index: number;
    if (isNode(targetNode) && isContainer(targetNode.type)) {
      containerPath = [...target, 'children'];
      index = ((targetNode.children as Json[] | undefined) ?? []).length;
    } else if (target.length && typeof target[target.length - 1] === 'number') {
      containerPath = target.slice(0, -1);
      index = (target[target.length - 1] as number) + 1;
    } else {
      writeTree({ type: 'stack', gap: 'md', children: [tree, node] }, pathKey(['children', 1]));
      setMenu(null);
      return;
    }
    if (INPUT_TYPES.has(type) && !insideForm(tree, containerPath)) node = { type: 'form', gap: 'md', children: [node] };
    writeTree(insertAt(tree, containerPath, index, node), pathKey([...containerPath, index]));
    setMenu(null);
    flash(`Inserted ${type}`);
  };
  const remove = (path: Path) => tree && path.length && writeTree(removeAt(tree, path), null);
  const duplicate = (path: Path) => {
    const last = path[path.length - 1];
    if (!tree || typeof last !== 'number') return;
    writeTree(insertAt(tree, path.slice(0, -1), last + 1, structuredClone(getAt(tree, path))), pathKey([...path.slice(0, -1), last + 1]));
  };
  const move = (path: Path, delta: number) => {
    if (!tree) return;
    const r = moveAt(tree, path, delta);
    writeTree(r.root, pathKey(r.path));
  };
  const wrap = (path: Path, type: 'stack' | 'card') => {
    if (!tree) return;
    const node = getAt(tree, path);
    writeTree(setAt(tree, path, type === 'card' ? { type: 'card', look: 'glass', children: [node] } : { type: 'stack', gap: 'md', children: [node] }));
  };

  const onCursor = (pos: number) => {
    const key = nodeAt(pos);
    if (key !== null) select(key);
  };
  /** Template path of the innermost node whose source range holds `pos`. */
  function nodeAt(pos: number): string | null {
    if (!compiled.ok || !tree) return null;
    let best: { key: string; size: number } | null = null;
    const walk = (n: Json, p: Path) => {
      if (!isNode(n)) return;
      const loc = compiled.ok!.locs.get(n as object);
      if (loc && pos >= loc.from && pos <= loc.to && (!best || loc.to - loc.from < best.size)) best = { key: pathKey(p), size: loc.to - loc.from };
      for (const c of childNodes(n, p)) walk(c.node, c.path);
    };
    walk(tree, []);
    return best ? (best as { key: string }).key : null;
  }

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (menu) setMenu(null);
        else if (popFor) setPopFor(null);
        else if (drawer) setDrawer(false);
        else select(null);
        setNewOpen(false);
        return;
      }
      const el = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.closest('.cm-editor')) return;
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (arrows[e.key] && (refMode === 'overlay' || refMode === 'diff') && manifest?.references?.length) {
        e.preventDefault();
        const name = (manifest.references.find((r) => r.name === refName) ?? manifest.references[0])!.name;
        const [dx, dy] = arrows[e.key]!.map((v) => v * (e.shiftKey ? 10 : 1)) as [number, number];
        nudgeRef(name, dx, dy);
        return;
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedPath) {
        e.preventDefault();
        remove(selectedPath);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && selectedPath) {
        e.preventDefault();
        duplicate(selectedPath);
      } else if (e.key === '/') {
        e.preventDefault();
        setMenu('insert');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* ---------- paste an image to add a reference ---------- */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(el.tagName) || el.closest('.cm-editor')) return;
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (!file) return;
      e.preventDefault();
      void addImageFile(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  /* ---------- diagnostics ---------- */
  const diagnostics = useMemo(() => {
    const out: { kind: 'compile' | 'parse' | 'sample' | 'props'; text: string; path?: string }[] = [];
    if (compiled.error) out.push({ kind: 'compile', text: compiled.error.message, path: `line ${compiled.error.line}` });
    for (const i of view?.issues ?? []) out.push({ kind: 'parse', text: i.reason + (i.detail ? `: ${i.detail}` : ''), path: i.path });
    if (manifest) {
      manifest.samples.forEach((s) => validateSample(manifest.schema, s.data).forEach((i) => out.push({ kind: 'sample', text: `${s.name}: ${i.path} ${i.message}` })));
      if (compiled.ok) {
        const declared = new Set(schemaPaths(manifest.schema));
        for (const p of usedPaths(compiled.ok.tree)) if (!declared.has(p)) out.push({ kind: 'props', text: `reads props.${p} but the schema doesn't declare it` });
      }
    }
    return out;
  }, [compiled, view, manifest]);

  /* ---------- template management ---------- */
  const createTemplate = async (id: string, name: string, prompt: string, jsx: string) => {
    const m: TemplateManifest = {
      id,
      name,
      prompt,
      schema: { type: 'object', properties: {} },
      samples: [{ name: 'default', data: {} }],
      variants: [{ id: 'v1', label: 'v1 · Default', file: 'v1.sdui.jsx', targets: [], fallback: true }],
    };
    await api.put(id, { manifest: m, sources: { v1: jsx } });
    await refreshList();
    setTplId(id);
    setNewOpen(false);
    setDrawer(true);
    flash(`Created ${id}`);
  };

  if (!manifest) {
    return (
      <div className="studio">
        <header className="edBar">{modeSwitch}</header>
        <div className="emptyNote">{tpl.error ?? 'Loading templates…'}</div>
      </div>
    );
  }

  const variant = manifest.variants.find((v) => v.id === variantId);
  const served = resolution?.variant;
  const used = compiled.ok ? usedPaths(compiled.ok.tree) : [];
  const references = manifest.references ?? [];
  const currentRef = references.find((r) => r.name === refName) ?? references[0];
  const pickRef = (name: string) => {
    setRefName(name);
    const r = references.find((x) => x.name === name);
    if (r?.sample !== undefined && r.sample < manifest.samples.length) setSampleIdx(r.sample);
    setRefMode((m) => (m === 'off' ? 'side' : m));
  };

  return (
    <div className={`studio mode-${viewMode}${drawer ? ' withDrawer' : ''}`}>
      <header className="edBar">
        {modeSwitch}
        <span className="barSep" />

        <div className="menuWrap">
          <button className="tplSwitch" onClick={() => setMenu(menu === 'templates' ? null : 'templates')} title="Switch template">
            <span className="tplSwitchName">{manifest.name}</span>
            <span className="caret">▾</span>
          </button>
          {menu === 'templates' ? (
            <Popover onClose={() => setMenu(null)} className="tplMenu">
              <TemplateMenu
                list={list}
                currentId={manifest.id}
                activity={activity}
                onOpen={(id) => {
                  setTplId(id);
                  select(null);
                  setMenu(null);
                }}
                onNew={() => {
                  setMenu(null);
                  setNewOpen(true);
                }}
                onDelete={async (id) => {
                  await api.remove(id);
                  const l = await api.list();
                  setList(l);
                  if (id === tplId) setTplId(l[0]?.id ?? null);
                }}
              />
            </Popover>
          ) : null}
        </div>

        <div className="vPills" role="tablist" aria-label="Variants">
          {manifest.variants.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={v.id === variantId}
              className={v.id === variantId ? 'vPill on' : 'vPill'}
              onClick={() => {
                setVariantId(v.id);
                setFollowSim(false);
                select(null);
              }}
              title={`${v.label}\n${v.targets.map(describeTarget).join('\n') || (v.fallback ? 'Fallback' : 'No targets')}`}
            >
              {v.id}
              {served?.id === v.id ? <span className="servedDot" /> : null}
            </button>
          ))}
          <button className="vPill add" title="Duplicate this variant" onClick={() => addVariant(tpl, manifest, variantId, source, setVariantId)}>
            ＋
          </button>
        </div>

        <div className="menuWrap">
          <button className={served ? 'clientChip' : 'clientChip none'} onClick={() => setMenu(menu === 'client' ? null : 'client')} title="Simulate a client">
            {PLATFORM_NAME[sim.platform]} {sim.appVersion}
            {Object.keys(sim.experiments ?? {}).length ? ' · exp' : ''} <span className="arrow">→</span> <b>{served ? served.id : 'none'}</b>
            {followSim ? <span className="followMark" title="The editor follows this client"> ⇢</span> : null}
            <span className="caret">▾</span>
          </button>
          {menu === 'client' ? (
            <Popover onClose={() => setMenu(null)} className="clientMenu">
              <ClientMenu sim={sim} onSim={setSim} follow={followSim} onFollow={setFollowSim} resolution={resolution} />
            </Popover>
          ) : null}
        </div>

        <span className="barFlex" />

        <span className={`saveDot ${tpl.status}`} title={tpl.status === 'saved' ? 'Saved to disk' : tpl.status === 'saving' ? 'Saving…' : `Save failed: ${tpl.error}`} />
        <div className="menuWrap">
          <button className={diagnostics.length ? 'chip warn' : 'chip ok'} onClick={() => setMenu(menu === 'issues' ? null : 'issues')}>
            {diagnostics.length ? `⚠ ${diagnostics.length}` : '✓'}
          </button>
          {menu === 'issues' ? (
            <Popover onClose={() => setMenu(null)} className="issuesMenu" align="right">
              <IssueList diagnostics={diagnostics} />
            </Popover>
          ) : null}
        </div>
        <div className="seg small" role="tablist" aria-label="View">
          {(['code', 'split', 'preview'] as const).map((m) => (
            <button key={m} className={viewMode === m ? 'on' : ''} onClick={() => setViewMode(m)} title={m}>
              {m === 'code' ? '</>' : m === 'split' ? '◫' : '▣'}
            </button>
          ))}
        </div>
        <button
          className="ghostBtn"
          disabled={!compiled.ok}
          title="Copy the view JSON for this variant and sample"
          onClick={() => {
            if (!compiled.ok) return;
            void navigator.clipboard?.writeText(JSON.stringify({ ...toEnvelope({ ...compiled.ok, sample }), templateId: manifest.id, variant: variantId }, null, 2));
            flash('Copied view JSON');
          }}
        >
          Copy JSON
        </button>
        <div className="menuWrap">
          <button className="ghostBtn" disabled={!tree} onClick={() => setMenu(menu === 'insert' ? null : 'insert')} title="Insert a node (/)">
            ＋ Insert
          </button>
          {menu === 'insert' ? <Palette onPick={insert} onClose={() => setMenu(null)} target={selectedNode} /> : null}
        </div>
        <button className={drawer ? 'primaryBtn on' : 'primaryBtn'} onClick={() => setDrawer((d) => !d)}>
          ⚙ Template
        </button>
      </header>

      <div className="studioMain">
        {viewMode !== 'preview' ? (
          <section className="codePane">
            <div className="paneHead">
              <span className="mono">{variant?.file ?? 'variant'}</span>
              {compiled.error ? <span className="paneErr">⚠ {compiled.error.message} · line {compiled.error.line}</span> : <span className="paneOk">✓</span>}
            </div>
            <CodeEditor value={source} onChange={(v) => tpl.setSource(variantId, v)} error={compiled.error ?? null} mark={mark} onCursor={onCursor} />
          </section>
        ) : null}
        {viewMode !== 'code' ? (
          <section
            className="previewPane"
            onDragOver={(e) => {
              if ([...e.dataTransfer.items].some((i) => i.type.startsWith('image/'))) e.preventDefault();
            }}
            onDrop={(e) => {
              const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
              if (!file) return;
              e.preventDefault();
              void addImageFile(file);
            }}
          >
            <Stage
              reference={
                currentRef && refMode !== 'off'
                  ? { src: api.assetUrl(manifest.id, currentRef.image), scale: currentRef.scale, mode: refMode, opacity: refOpacity, name: currentRef.name, offset: currentRef.offset }
                  : undefined
              }
              parsedRoot={view?.parsed ?? null}
              keyOf={view?.keyOf}
              width={width}
              frame={frame}
              prompt={manifest.name}
              mode={mode}
              selected={selected}
              hover={hover}
              popKey={popFor}
              popover={
                popFor && selectedPath && isNode(selectedNode) && tree ? (
                  <Inspector
                    tree={tree}
                    path={selectedPath}
                    node={selectedNode}
                    onChange={updateField}
                    onSelect={(k) => select(k, true)}
                    onRemove={remove}
                    onDuplicate={duplicate}
                    onMove={move}
                    onWrap={wrap}
                    onClose={() => setPopFor(null)}
                    onCopyForAgent={() => {
                      if (!agentContext) return;
                      void navigator.clipboard?.writeText(describeContext(agentContext));
                      flash('Copied for your agent: paste it with your request');
                    }}
                  />
                ) : null
              }
              onSelect={(k) => select(k, k !== null)}
              onHover={setHover}
              onAction={(a) => flash(`Action: ${(a as { kind: string }).kind}`)}
              empty={compiled.error ? 'The JSX has an error. See the code pane.' : 'Nothing renders with this sample.'}
            />
            {refMode !== 'off' && currentRef ? (
              <div className="refBar">
                {references.length > 1 ? (
                  <select className="footSelect" value={currentRef.name} onChange={(e) => pickRef(e.target.value)} title="Reference">
                    {references.map((r) => (
                      <option key={r.name} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="refBarName" title={currentRef.name}>
                    {currentRef.name}
                  </span>
                )}
                <div className="seg small">
                  {(['side', 'overlay', 'diff'] as const).map((m) => (
                    <button key={m} className={refMode === m ? 'on' : ''} onClick={() => setRefMode(m)} title={m === 'diff' ? 'Difference: matching pixels go black' : undefined}>
                      {m === 'side' ? 'Side' : m === 'overlay' ? 'Overlay' : 'Diff'}
                    </button>
                  ))}
                </div>
                {refMode === 'overlay' ? (
                  <input className="refOpacity" type="range" min={0.1} max={1} step={0.05} value={refOpacity} onChange={(e) => setRefOpacity(Number(e.target.value))} title={`Opacity ${Math.round(refOpacity * 100)}%`} />
                ) : null}
                {refMode !== 'side' ? (
                  <span className="muted small" title="Arrow keys nudge the image; Shift for 10pt">
                    ←↑→↓{currentRef.offset ? ` ${currentRef.offset.x}, ${currentRef.offset.y}` : ''}
                    {currentRef.offset ? (
                      <button className="linkBtn" onClick={() => nudgeRef(currentRef.name, 0, 0, true)}>
                        reset
                      </button>
                    ) : null}
                  </span>
                ) : null}
                <span className="barFlex" />
                <button className="linkBtn" onClick={() => openDrawer('references')}>
                  Manage
                </button>
                <button className="iconMini" onClick={() => setRefMode('off')} title="Hide reference">
                  ✕
                </button>
              </div>
            ) : null}
            <div className="previewFoot">
              <div className="seg small">
                {(['select', 'interact'] as const).map((m) => (
                  <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)} title={m === 'select' ? 'Click to inspect' : 'Use the UI'}>
                    {m === 'select' ? '⌖ Select' : '☝ Interact'}
                  </button>
                ))}
              </div>
              <button
                className={refMode !== 'off' && currentRef ? 'ghostBtn small on' : 'ghostBtn small'}
                onClick={() => (references.length ? setRefMode((m) => (m === 'off' ? 'side' : 'off')) : openDrawer('references'))}
                title={references.length ? 'Show or hide the design reference' : 'Add a design reference (Figma frame or screenshot)'}
              >
                ◐ {references.length ? `Reference${references.length > 1 ? ` (${references.length})` : ''}` : 'Add reference'}
              </button>
              <span className="barFlex" />
              <select className="footSelect" value={sampleIdx} onChange={(e) => setSampleIdx(Number(e.target.value))} title="Sample props">
                {manifest.samples.map((s, i) => (
                  <option key={i} value={i}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select className="footSelect" value={width} onChange={(e) => setWidth(Number(e.target.value))} title="Width">
                {WIDTHS.map((w) => (
                  <option key={w} value={w}>
                    {w}px
                  </option>
                ))}
              </select>
              <select className="footSelect" value={frame} onChange={(e) => setFrame(e.target.value as Frame)} title="Frame">
                <option value="chat">In chat</option>
                <option value="plain">Plain</option>
              </select>
            </div>
          </section>
        ) : null}

        {drawer ? (
          <TemplateDrawer
            manifest={manifest}
            used={used}
            variantId={variantId}
            sampleIdx={sampleIdx}
            onSample={setSampleIdx}
            onPickVariant={setVariantId}
            onChange={(fn) => tpl.setManifest(fn)}
            onClose={() => setDrawer(false)}
            focus={drawerFocus}
            refs={
              <ReferencesSection
                templateId={manifest.id}
                defaultFigma={manifest.origin?.figma}
                references={references}
                current={refMode !== 'off' ? (currentRef?.name ?? null) : null}
                samples={manifest.samples.map((s) => s.name)}
                sampleIdx={sampleIdx}
                busy={refBusy}
                onPick={pickRef}
                onAdd={(r) => void addReference(r)}
                onFile={(f) => void addImageFile(f)}
                onSample={(name, sample) => tpl.setManifest((m) => ({ ...m, references: (m.references ?? []).map((r) => (r.name === name ? { ...r, sample } : r)) }))}
                onScale={(name, scale) => tpl.setManifest((m) => ({ ...m, references: (m.references ?? []).map((r) => (r.name === name ? { ...r, scale } : r)) }))}
                onRemove={async (name) => {
                  await tpl.flushNow();
                  await api.removeReference(manifest.id, name);
                  await tpl.reload();
                }}
              />
            }
          />
        ) : null}
        {toast ? <div className="toast">{toast}</div> : null}
      </div>

      {newOpen ? <NewTemplateDialog existing={list.map((t) => t.id)} onClose={() => setNewOpen(false)} onCreate={createTemplate} /> : null}
    </div>
  );
}

function addVariant(tpl: ReturnType<typeof useTemplate>, manifest: TemplateManifest, fromId: string, source: string, select: (id: string) => void) {
  let n = manifest.variants.length + 1;
  while (manifest.variants.some((v) => v.id === `v${n}`)) n++;
  const id = `v${n}`;
  const next: VariantInfo = { id, label: `${id} · copy of ${fromId}`, file: `${id}.sdui.jsx`, targets: [] };
  tpl.setManifest((m) => ({ ...m, variants: [...m.variants, next] }), { [id]: source });
  select(id);
}

/* ------------------------------------------------------------------ */
/*  Bar menus                                                          */
/* ------------------------------------------------------------------ */

function Popover({ children, onClose, className, align }: { children: ReactNode; onClose: () => void; className?: string; align?: 'right' }) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className={['pop', align === 'right' ? 'right' : '', className ?? ''].join(' ')}>{children}</div>
    </>
  );
}

function TemplateMenu(props: { list: TemplateSummary[]; currentId: string; activity: Activity[]; onOpen: (id: string) => void; onNew: () => void; onDelete: (id: string) => void }) {
  const [q, setQ] = useState('');
  const shown = props.list.filter((t) => `${t.id} ${t.name}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div className="popHead">
        <input className="search" autoFocus placeholder="Search templates" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="primaryBtn small" onClick={props.onNew}>
          ＋ New
        </button>
      </div>
      <div className="popList">
        {shown.map((t) => (
          <div key={t.id} className={t.id === props.currentId ? 'menuRow on' : 'menuRow'} onClick={() => props.onOpen(t.id)}>
            <div className="tplMeta">
              <div className="tplName">{t.name}</div>
              <div className="tplSub">
                {t.id} · {t.variants.length} variant{t.variants.length === 1 ? '' : 's'} · {relTime(t.updatedAt)}
              </div>
            </div>
            <span className="lactions" onClick={(e) => e.stopPropagation()}>
              <button title="Delete template" onClick={() => props.onDelete(t.id)}>
                ✕
              </button>
            </span>
          </div>
        ))}
        {shown.length === 0 ? <div className="muted small pad">No templates match.</div> : null}
      </div>
      {props.activity.length ? (
        <div className="popFoot">
          <div className="popLabel">Agent activity</div>
          {props.activity.slice(0, 6).map((a, i) => (
            <div key={i} className="actRow">
              <span className="actDot" />
              <span>
                <b>{a.id}</b> by {a.by === 'disk' ? 'a file edit' : a.by}
              </span>
              <span className="muted small">{relTime(a.at)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function ClientMenu({
  sim,
  onSim,
  follow,
  onFollow,
  resolution,
}: {
  sim: ClientContext;
  onSim: (c: ClientContext) => void;
  follow: boolean;
  onFollow: (f: boolean) => void;
  resolution: ReturnType<typeof resolveVariant> | null;
}) {
  const [exp, setExp] = useState(() =>
    Object.entries(sim.experiments ?? {})
      .map(([k, v]) => `${k}=${v}`)
      .join(', '),
  );
  return (
    <div className="clientBody">
      <div className="popLabel">Simulate a client</div>
      <div className="seg">
        {(['android', 'ios', 'web'] as const).map((p) => (
          <button key={p} className={sim.platform === p ? 'on' : ''} onClick={() => onSim({ ...sim, platform: p })}>
            {PLATFORM_NAME[p]}
          </button>
        ))}
      </div>
      <label className="kv">
        <span>App version</span>
        <input className="txt mono" value={sim.appVersion} onChange={(e) => onSim({ ...sim, appVersion: e.target.value })} />
      </label>
      <label className="kv">
        <span>Experiments</span>
        <input
          className="txt"
          placeholder="name=arm, name2=arm"
          value={exp}
          onChange={(e) => {
            setExp(e.target.value);
            onSim({
              ...sim,
              experiments: Object.fromEntries(
                e.target.value
                  .split(',')
                  .map((p) => p.split('=').map((x) => x.trim()))
                  .filter((p) => p[0] && p[1]),
              ),
            });
          }}
        />
      </label>
      <div className={resolution?.variant ? 'resolveBox' : 'resolveBox none'}>
        <b>{resolution?.variant ? `Gets ${resolution.variant.label}` : 'Gets nothing'}</b>
        <span>{resolution?.reason}</span>
      </div>
      <label className="followRow">
        <input type="checkbox" checked={follow} onChange={(e) => onFollow(e.target.checked)} />
        Edit the variant this client gets
      </label>
    </div>
  );
}

function IssueList({ diagnostics }: { diagnostics: { kind: string; text: string; path?: string }[] }) {
  if (!diagnostics.length) return <div className="muted small pad">No issues. The variant compiles, every sample matches the schema, and the result parses cleanly.</div>;
  return (
    <div className="issueList">
      {diagnostics.map((d, n) => (
        <div key={n} className="issue">
          <span className={`issueReason k-${d.kind}`}>
            {d.kind}
            {d.path ? <span className="issuePath"> · {d.path}</span> : null}
          </span>
          <span className="issueDetail">{d.text}</span>
        </div>
      ))}
    </div>
  );
}

function relTime(t: number): string {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

/* ------------------------------------------------------------------ */
/*  Stage                                                              */
/* ------------------------------------------------------------------ */

const POP_W = 300;

function Stage(props: {
  parsedRoot: ViewNode | null;
  keyOf?: WeakMap<object, string>;
  width: number;
  frame: Frame;
  prompt: string;
  mode: 'select' | 'interact';
  selected: string | null;
  hover: string | null;
  popKey: string | null;
  popover: ReactNode;
  reference?: { src: string; scale?: number; mode: RefMode; opacity: number; name: string; offset?: { x: number; y: number } };
  onSelect: (k: string | null) => void;
  onHover: (k: string | null) => void;
  onAction: (a: unknown) => void;
  empty: string;
}) {
  const { parsedRoot, mode, selected, hover, keyOf } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<{ sel?: DOMRect & { label: string }; hov?: DOMRect; pop?: { left: number; top: number; above?: boolean }; content?: DOMRect; frame?: DOMRect }>({});
  const [refNatural, setRefNatural] = useState<number | null>(null);
  const ref = props.reference;

  const wrapper = useCallback(
    (node: ViewNode, el: React.ReactElement) => {
      const key = keyOf?.get(node);
      if (key === undefined) return el;
      return (
        <View style={{ display: 'contents' } as never} {...({ dataSet: { sduiPath: key, sduiType: node.type } } as object)}>
          {el}
        </View>
      );
    },
    [keyOf],
  );

  const measure = useCallback(() => {
    const host = wrapRef.current;
    if (!host) return;
    const base = host.getBoundingClientRect();
    const rectOf = (key: string | null) => {
      if (key === null) return undefined;
      const els = [...host.querySelectorAll(`[data-sdui-path="${CSS.escape(key)}"]`)];
      const rects = els
        .flatMap((el) => [...el.children] as HTMLElement[])
        .map((k) => k.getBoundingClientRect())
        .filter((r) => r.width || r.height);
      if (!rects.length) return undefined;
      const left = Math.min(...rects.map((r) => r.left));
      const top = Math.min(...rects.map((r) => r.top));
      const right = Math.max(...rects.map((r) => r.right));
      const bottom = Math.max(...rects.map((r) => r.bottom));
      return { el: els[0] as HTMLElement, count: els.length, rect: new DOMRect(left - base.left + host.scrollLeft, top - base.top + host.scrollTop, right - left, bottom - top) };
    };
    const s = rectOf(selected);
    const h = hover !== selected ? rectOf(hover) : undefined;
    let pop: { left: number; top: number; above?: boolean } | undefined;
    if (s) {
      const r = s.rect;
      const minX = host.scrollLeft + 8;
      const maxX = host.scrollLeft + host.clientWidth - POP_W - 8;
      const viewTop = host.scrollTop + 8;
      const viewBottom = host.scrollTop + host.clientHeight - 8;
      if (r.right + 14 <= maxX || r.left - POP_W - 14 >= minX) {
        // Beside the node.
        const left = r.right + 14 <= maxX ? r.right + 14 : r.left - POP_W - 14;
        pop = { left, top: Math.max(viewTop, Math.min(r.top - 8, viewBottom - 260)) };
      } else {
        // No room beside it: below the node, or above when it sits low.
        const left = Math.max(minX, Math.min(r.left, maxX));
        const below = r.bottom + 12;
        pop = below + 200 <= viewBottom ? { left, top: below } : { left, top: Math.max(viewTop, r.top - 12 - Math.min(400, r.top - viewTop)), above: true };
      }
    }
    const rel = (r: DOMRect) => new DOMRect(r.left - base.left + host.scrollLeft, r.top - base.top + host.scrollTop, r.width, r.height);
    const contentEl = host.querySelector('[data-sdui-content]');
    const frameEl = host.querySelector('.phone, .device');
    setBoxes({
      sel: s ? Object.assign(s.rect, { label: `${s.el.dataset.sduiType ?? ''}${s.count > 1 ? ` ×${s.count}` : ''}` }) : undefined,
      hov: h?.rect,
      pop,
      content: contentEl ? rel(contentEl.getBoundingClientRect()) : undefined,
      frame: frameEl ? rel(frameEl.getBoundingClientRect()) : undefined,
    });
  }, [selected, hover]);

  useLayoutEffect(() => {
    measure();
    const id = requestAnimationFrame(measure);
    const t = setTimeout(measure, 300);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(t);
    };
  }, [measure, parsedRoot, props.width, props.frame, ref?.mode, ref?.src]);

  useEffect(() => {
    const host = wrapRef.current;
    if (!host) return;
    const on = (e: Event) => {
      if (e.target instanceof Element && e.target.closest('.inspectPop')) return;
      measure();
    };
    host.addEventListener('scroll', on, true);
    window.addEventListener('resize', measure);
    return () => {
      host.removeEventListener('scroll', on, true);
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  const inPop = (t: EventTarget | null) => t instanceof Element && !!t.closest('.inspectPop');
  const pathFromEvent = (t: EventTarget | null) => (t instanceof Element ? (t.closest('[data-sdui-path]')?.getAttribute('data-sdui-path') ?? null) : null);

  const content = parsedRoot ? (
    <View style={{ width: props.width }} {...({ dataSet: { sduiContent: '1' } } as object)}>
      <ViewDraftsProvider>
        <ViewRenderer
          root={parsedRoot}
          registry={registry}
          manifest={theme}
          place="playground"
          draftKey="playground"
          onAction={props.onAction as never}
          onTrack={() => undefined}
          nodeWrapper={mode === 'select' ? wrapper : undefined}
        />
      </ViewDraftsProvider>
    </View>
  ) : (
    <div className="emptyNote">{props.empty}</div>
  );

  const showPop = mode === 'select' && props.popover && boxes.pop && props.popKey === selected;

  return (
    <div
      ref={wrapRef}
      className={['edStage', 'fit', mode === 'select' ? 'selecting' : '', ref?.mode === 'side' ? 'withSide' : ''].join(' ')}
      onClickCapture={(e) => {
        if (mode !== 'select' || inPop(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        props.onSelect(pathFromEvent(e.target));
      }}
      onMouseMove={(e) => mode === 'select' && !inPop(e.target) && props.onHover(pathFromEvent(e.target))}
      onMouseLeave={() => props.onHover(null)}
    >
      {props.frame === 'chat' ? (
        <ChatFrame width={props.width} prompt={props.prompt} background={BACKGROUNDS.white}>
          {content}
        </ChatFrame>
      ) : (
        <div className="device" style={{ width: props.width + 40, background: BACKGROUNDS.white }}>
          {content}
        </div>
      )}
      {ref && boxes.content ? (
        <img
          className={`refImage ${ref.mode}`}
          src={ref.src}
          alt={`Reference: ${ref.name}`}
          onLoad={(e) => {
            setRefNatural(e.currentTarget.naturalWidth);
            measure();
          }}
          style={{
            left: ref.mode === 'side' ? (boxes.frame ?? boxes.content).right + 32 : boxes.content.x + (ref.offset?.x ?? 0),
            top: boxes.content.y + (ref.mode === 'side' ? 0 : (ref.offset?.y ?? 0)),
            width: ref.scale && refNatural ? refNatural / ref.scale : props.width,
            opacity: ref.mode === 'overlay' ? ref.opacity : 1,
          }}
        />
      ) : null}
      {ref?.mode === 'side' && boxes.content ? (
        <span className="refTag" style={{ left: (boxes.frame ?? boxes.content).right + 32, top: boxes.content.y - 20 }}>
          {ref.name}
        </span>
      ) : null}
      {mode === 'select' && boxes.hov ? <div className="hoverBox" style={boxStyle(boxes.hov)} /> : null}
      {mode === 'select' && boxes.sel ? (
        <div className="selBox" style={boxStyle(boxes.sel)}>
          <span className="selTag">{boxes.sel.label}</span>
        </div>
      ) : null}
      {showPop ? (
        <div className="inspectPop" style={{ left: boxes.pop!.left, top: boxes.pop!.top, width: POP_W, maxHeight: boxes.pop!.above ? Math.max(160, (boxes.sel?.y ?? 0) - boxes.pop!.top - 12) : undefined }} onMouseEnter={() => props.onHover(null)}>
          {props.popover}
        </div>
      ) : null}
    </div>
  );
}

const boxStyle = (r: DOMRect) => ({ left: r.x, top: r.y, width: r.width, height: r.height });

function controlBadge(tree: Json, path: Path): string | null {
  const last = path[path.length - 1];
  if (last === '$value' || last === '$else') {
    const wrapper = getAt(tree, path.slice(0, -1)) as Obj | undefined;
    const cond = wrapper?.$when as string | undefined;
    if (!cond) return null;
    return last === '$value' ? `if ${cond}` : `else`;
  }
  const node = getAt(tree, path) as Obj | undefined;
  if (node && typeof node.$each === 'string') return `each ${node.$each}`;
  return null;
}

/* ------------------------------------------------------------------ */
/*  Reference menu                                                     */
/* ------------------------------------------------------------------ */

function ReferencesSection(props: {
  templateId: string;
  defaultFigma?: string;
  references: TemplateReference[];
  current: string | null;
  samples: string[];
  sampleIdx: number;
  busy: string | null;
  onPick: (name: string) => void;
  onAdd: (r: { name: string; figma: string; sample: number }) => void;
  onFile: (f: File) => void;
  onSample: (name: string, sample: number | undefined) => void;
  onScale: (name: string, scale: number | undefined) => void;
  onRemove: (name: string) => void;
}) {
  const [figma, setFigma] = useState(() => (props.references.some((r) => r.figma === props.defaultFigma) ? '' : (props.defaultFigma ?? '')));
  const [name, setName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <section id="ds-references" className="dSection">
      <h3>References</h3>
      <div className="muted small">Figma frames or screenshots to compare the preview with. Show one from ◐ under the preview.</div>
      {props.references.map((r) => (
        <div key={r.name} className={r.name === props.current ? 'refCard on' : 'refCard'}>
          <button className="refThumbBtn" onClick={() => props.onPick(r.name)} title="Show this reference">
            <img className="refThumb" src={api.assetUrl(props.templateId, r.image)} alt="" />
          </button>
          <div className="refCardBody">
            <div className="refCardHead">
              <b>{r.name}</b>
              {r.figma ? (
                <a className="iconMini" href={r.figma} target="_blank" rel="noreferrer" title="Open in Figma">
                  ↗
                </a>
              ) : null}
              <button className="iconMini danger" title="Remove reference" onClick={() => props.onRemove(r.name)}>
                ✕
              </button>
            </div>
            <div className="refCardProps">
              <select className="footSelect" value={r.sample ?? ''} onChange={(e) => props.onSample(r.name, e.target.value === '' ? undefined : Number(e.target.value))} title="Which sample the design shows">
                <option value="">Any sample</option>
                {props.samples.map((s, i) => (
                  <option key={i} value={i}>
                    Shows “{s}”
                  </option>
                ))}
              </select>
              <select className="footSelect" value={r.scale ?? ''} onChange={(e) => props.onScale(r.name, e.target.value === '' ? undefined : Number(e.target.value))} title="Image density">
                <option value="">Fit width</option>
                <option value={1}>@1x</option>
                <option value={2}>@2x</option>
                <option value={3}>@3x</option>
              </select>
            </div>
          </div>
        </div>
      ))}
      <button className="dropZone" onClick={() => fileRef.current?.click()}>
        <b>Paste (⌘V) or drop a screenshot</b>
        <span>or click to choose an image</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) props.onFile(f);
          e.target.value = '';
        }}
      />
      <div className="figmaRow">
        <input className="txt" placeholder="Figma link to a frame" value={figma} onChange={(e) => setFigma(e.target.value)} />
        <input className="txt nameIn" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="primaryBtn small" disabled={!figma.trim()} onClick={() => props.onAdd({ name: name.trim() || `Figma ${props.references.length + 1}`, figma: figma.trim(), sample: props.sampleIdx })}>
          Fetch
        </button>
      </div>
      {props.busy ? <div className={props.busy.startsWith('⚠') ? 'refBusy err' : 'refBusy'}>{props.busy}</div> : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Palette                                                            */
/* ------------------------------------------------------------------ */

function Palette({ onPick, onClose, target }: { onPick: (t: string) => void; onClose: () => void; target: Json }) {
  const [q, setQ] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const where = isNode(target) ? (isContainer(target.type) ? `into ${target.type}` : `after ${target.type}`) : 'into the template';
  const families = FAMILY_OF.map(([f, types]) => [f, types.filter((t) => t.toLowerCase().includes(q.toLowerCase()))] as const).filter(([, t]) => t.length);
  const first = families[0]?.[1][0];
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="palette" role="dialog" aria-label="Insert node">
        <input ref={ref} className="search" placeholder={`Insert ${where}…`} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && first && onPick(first)} />
        {families.map(([family, types]) => (
          <div key={family}>
            <div className="palFamily">{family}</div>
            <div className="palGrid">
              {types.map((t) => (
                <button key={t} className="palItem" onClick={() => onPick(t)}>
                  <span className="palGlyph">{TYPE_GLYPH[t]}</span>
                  {t}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Inspector (popover)                                                */
/* ------------------------------------------------------------------ */

function Inspector(props: {
  tree: Json;
  path: Path;
  node: Obj & { type: string };
  onChange: (p: Path, v: Json) => void;
  onSelect: (k: string) => void;
  onRemove: (p: Path) => void;
  onDuplicate: (p: Path) => void;
  onMove: (p: Path, d: number) => void;
  onWrap: (p: Path, t: 'stack' | 'card') => void;
  onClose: () => void;
  onCopyForAgent: () => void;
}) {
  const { node, path, tree } = props;
  const parent: { key: string; type: string } | null = (() => {
    for (let i = path.length - 1; i >= 0; i--) {
      const n = getAt(tree, path.slice(0, i));
      if (isNode(n)) return { key: pathKey(path.slice(0, i)), type: n.type };
    }
    return null;
  })();
  const keys = Object.keys(node).filter((k) => k !== 'type' && !k.startsWith('$') && !SLOT_KEYS.has(k));
  const missing = Object.keys(shapeOf(node.type)).filter((k) => !SLOT_KEYS.has(k) && !(k in node));
  const grouped = new Map<string, string[]>();
  for (const k of keys) grouped.set(sectionOf(k), [...(grouped.get(sectionOf(k)) ?? []), k]);
  const order = [...SECTIONS.map(([s]) => s), 'Advanced'];
  const movable = typeof path[path.length - 1] === 'number';
  const badge = controlBadge(tree, path);
  return (
    <div className="inspector">
      <div className="ipHead">
        <span className="glyph">{TYPE_GLYPH[node.type]}</span>
        <span className="insType">{node.type}</span>
        {badge ? <span className="cfBadge">{badge}</span> : null}
        <span className="barFlex" />
        {parent ? (
          <button className="iconMini" title={`Select parent (${parent.type})`} onClick={() => props.onSelect(parent.key)}>
            ⤴
          </button>
        ) : null}
        {movable ? (
          <>
            <button className="iconMini" title="Move up" onClick={() => props.onMove(path, -1)}>
              ↑
            </button>
            <button className="iconMini" title="Move down" onClick={() => props.onMove(path, 1)}>
              ↓
            </button>
            <button className="iconMini" title="Duplicate (⌘D)" onClick={() => props.onDuplicate(path)}>
              ⧉
            </button>
          </>
        ) : null}
        <details className="moreMenu">
          <summary className="iconMini" title="More">
            ⋯
          </summary>
          <div className="moreList">
            <button onClick={props.onCopyForAgent}>Copy for agent</button>
            <button onClick={() => props.onWrap(path, 'stack')}>Wrap in stack</button>
            <button onClick={() => props.onWrap(path, 'card')}>Wrap in card</button>
            {path.length ? (
              <button className="danger" onClick={() => props.onRemove(path)}>
                Delete
              </button>
            ) : null}
          </div>
        </details>
        <button className="iconMini" title="Close (Esc)" onClick={props.onClose}>
          ✕
        </button>
      </div>
      <div className="insBody">
        {order
          .filter((s) => grouped.has(s))
          .map((section) => (
            <div key={section} className="ipSection">
              <div className="ipSectionName">{section}</div>
              {grouped.get(section)!.map((k) => (
                <Field key={k} type={node.type} name={k} value={node[k]} onChange={(v) => props.onChange([...path, k], v)} />
              ))}
            </div>
          ))}
        {missing.length ? (
          <div className="addProp">
            <select
              value=""
              onChange={(e) => {
                const k = e.target.value;
                if (!k) return;
                const kind = fieldKind(node.type, k, undefined);
                props.onChange(
                  [...path, k],
                  kind.kind === 'boolean' ? true : kind.kind === 'number' ? 0 : kind.kind === 'enum' || kind.kind === 'token' ? (kind.options[0] ?? '') : kind.kind === 'string' ? '' : {},
                );
              }}
            >
              <option value="">＋ Add property…</option>
              {missing.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const humanize = (k: string) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
const isDynamic = (v: unknown) => (typeof v === 'string' && /\{\{.+?\}\}/.test(v)) || (!!v && typeof v === 'object' && '$when' in (v as object));

function Field({ type, name, value, onChange }: { type: string; name: string; value: unknown; onChange: (v: Json) => void }) {
  const kind = isDynamic(value) && typeof value !== 'string' ? ({ kind: 'json' } as const) : fieldKind(type, name, value);
  let control: ReactNode;
  switch (kind.kind) {
    case 'token': {
      const swatch = kind.scale === 'color' && typeof value === 'string' ? theme.color[value] : undefined;
      control = (
        <div className="tokenCtl">
          {swatch ? <span className="swatch" style={{ background: swatch }} /> : null}
          <select value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)}>
            {typeof value === 'string' && !kind.options.includes(value) ? <option value={value}>{value}</option> : null}
            {kind.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      );
      break;
    }
    case 'enum':
      control =
        kind.options.length <= 3 ? (
          <div className="seg small">
            {kind.options.map((o) => (
              <button key={o} className={value === o ? 'on' : ''} onClick={() => onChange(o)}>
                {o}
              </button>
            ))}
          </div>
        ) : (
          <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
            {kind.options.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        );
      break;
    case 'boolean':
      control = (
        <label className="switch">
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          <span />
        </label>
      );
      break;
    case 'number':
      control = <input className="num" type="number" value={typeof value === 'number' ? value : ''} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />;
      break;
    case 'string':
      control = kind.multiline ? (
        <textarea className={isDynamic(value) ? 'txt dyn' : 'txt'} rows={2} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={isDynamic(value) ? 'txt dyn' : 'txt'} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
      );
      break;
    default:
      control = <JsonField value={value} onChange={onChange} />;
  }
  return (
    <div className={kind.kind === 'json' || (kind.kind === 'string' && kind.multiline) ? 'field stacked' : 'field'}>
      <label className="fieldLabel" title={name}>
        {humanize(name)}
        {isDynamic(value) ? <span className="dynTag">bound</span> : null}
      </label>
      <div className="fieldCtl">{control}</div>
      <button className="fieldClear" title={`Remove ${name}`} onClick={() => onChange(undefined)}>
        ×
      </button>
    </div>
  );
}

function JsonField({ value, onChange, rows }: { value: unknown; onChange: (v: Json) => void; rows?: number }) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [err, setErr] = useState(false);
  useEffect(() => setText(JSON.stringify(value, null, 2)), [value]);
  return (
    <textarea
      className={err ? 'json err' : 'json'}
      spellCheck={false}
      rows={rows ?? Math.min(10, text.split('\n').length)}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        try {
          JSON.parse(e.target.value);
          setErr(false);
        } catch {
          setErr(true);
        }
      }}
      onBlur={() => {
        try {
          onChange(JSON.parse(text));
        } catch {}
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Template drawer: about · props · samples · variants               */
/* ------------------------------------------------------------------ */

type ManifestFn = (fn: (m: TemplateManifest) => TemplateManifest) => void;

const DRAWER_SECTIONS = [
  ['about', 'About'],
  ['props', 'Props'],
  ['samples', 'Samples'],
  ['references', 'References'],
  ['variants', 'Variants'],
] as const;

function TemplateDrawer(props: {
  manifest: TemplateManifest;
  used: string[];
  variantId: string;
  sampleIdx: number;
  onSample: (i: number) => void;
  onPickVariant: (id: string) => void;
  onChange: ManifestFn;
  onClose: () => void;
  focus: { section: string; n: number } | null;
  refs: ReactNode;
}) {
  const { manifest, onChange } = props;
  const bodyRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string>('about');
  const jump = (id: string) => {
    bodyRef.current?.querySelector(`#ds-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActive(id);
  };
  useEffect(() => {
    if (props.focus) requestAnimationFrame(() => jump(props.focus!.section));
  }, [props.focus?.n]);
  const onScroll = () => {
    const body = bodyRef.current;
    if (!body) return;
    const top = body.getBoundingClientRect().top + 40;
    let cur: string = DRAWER_SECTIONS[0][0];
    for (const [id] of DRAWER_SECTIONS) {
      const el = body.querySelector(`#ds-${id}`);
      if (el && el.getBoundingClientRect().top <= top) cur = id;
    }
    setActive(cur);
  };
  return (
    <aside className="drawer" aria-label="Template settings">
      <div className="drawerHead">
        <div className="drawerNav">
          {DRAWER_SECTIONS.map(([id, label]) => (
            <button key={id} className={active === id ? 'on' : ''} onClick={() => jump(id)}>
              {label}
            </button>
          ))}
        </div>
        <button className="iconMini" onClick={props.onClose} title="Close (Esc)">
          ✕
        </button>
      </div>
      <div className="drawerBody" ref={bodyRef} onScroll={onScroll}>
        <section id="ds-about" className="dSection">
          <div className="field stacked">
            <label className="fieldLabel">Name</label>
            <div className="fieldCtl">
              <input className="txt" value={manifest.name} onChange={(e) => onChange((m) => ({ ...m, name: e.target.value }))} />
            </div>
          </div>
          <div className="muted small">
            <span className="mono">id: {manifest.id}</span>
            {manifest.origin?.story ? (
              <>
                {' · from story '}
                <a href={`#/${manifest.origin.story}`}>{manifest.origin.story.split('/').pop()}</a>
              </>
            ) : null}
            {manifest.origin?.figma ? (
              <>
                {' · '}
                <a href={manifest.origin.figma} target="_blank" rel="noreferrer">
                  Figma ↗
                </a>
              </>
            ) : null}
          </div>
          <div className="field stacked">
            <label className="fieldLabel">Selection prompt: what this shows and when the LLM should pick it</label>
            <div className="fieldCtl">
              <textarea className="txt promptBox" rows={4} value={manifest.prompt} onChange={(e) => onChange((m) => ({ ...m, prompt: e.target.value }))} />
            </div>
          </div>
          <details className="llmPreview">
            <summary>What the LLM sees</summary>
            <pre className="tsView">{selectionPrompt([manifest])}</pre>
          </details>
        </section>

        <SchemaSection manifest={manifest} used={props.used} onChange={onChange} />
        <SamplesSection manifest={manifest} sampleIdx={props.sampleIdx} onSample={props.onSample} onChange={onChange} />
        {props.refs}

        <section id="ds-variants" className="dSection">
          <h3>Variants</h3>
          <div className="muted small">Checked top to bottom: the first variant with a matching target is served. The fallback serves when nothing matches.</div>
          <VariantsList manifest={manifest} current={props.variantId} onPick={props.onPickVariant} onChange={onChange} />
        </section>
      </div>
    </aside>
  );
}

type FieldType = 'string' | 'number' | 'integer' | 'boolean' | 'enum' | 'object' | 'array';

const fieldTypeOf = (s: JsonSchema): FieldType => (s.enum ? 'enum' : ((s.type as FieldType | undefined) ?? 'string'));

function schemaFor(t: FieldType, prev: JsonSchema): JsonSchema {
  const base = prev.description ? { description: prev.description } : {};
  switch (t) {
    case 'enum':
      return { ...base, type: 'string', enum: prev.enum ?? ['option'] };
    case 'object':
      return { ...base, type: 'object', properties: prev.properties ?? {} };
    case 'array':
      return { ...base, type: 'array', items: prev.items ?? { type: 'string' } };
    default:
      return { ...base, type: t };
  }
}

function SchemaSection({ manifest, used, onChange }: { manifest: TemplateManifest; used: string[]; onChange: ManifestFn }) {
  const [view, setView] = useState<'fields' | 'ts' | 'json'>('fields');
  const setSchema = (schema: JsonSchema) => onChange((m) => ({ ...m, schema }));
  const declared = schemaPaths(manifest.schema);
  const unused = declared.filter((p) => !used.includes(p) && !used.some((u) => u.startsWith(`${p}.`) || u.startsWith(`${p}[]`)));
  return (
    <section id="ds-props" className="dSection">
      <div className="dHead">
        <h3>Props</h3>
        <div className="seg small">
          {(['fields', 'ts', 'json'] as const).map((v) => (
            <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
              {v === 'fields' ? 'Fields' : v === 'ts' ? 'TS' : 'JSON'}
            </button>
          ))}
        </div>
      </div>
      <div className="muted small">Shared by every variant. Each field's prompt tells the LLM what to extract.</div>
      {view === 'fields' ? (
        <SchemaFields schema={manifest.schema} onChange={setSchema} path="" used={used} />
      ) : view === 'ts' ? (
        <pre className="tsView">{schemaToTs(manifest.schema)}</pre>
      ) : (
        <JsonField value={manifest.schema} onChange={(v) => setSchema(v as JsonSchema)} rows={14} />
      )}
      {unused.length ? <div className="hintRow">Not read by this variant: {unused.join(', ')}</div> : null}
    </section>
  );
}

function SamplesSection({ manifest, sampleIdx, onSample, onChange }: { manifest: TemplateManifest; sampleIdx: number; onSample: (i: number) => void; onChange: ManifestFn }) {
  const sample = manifest.samples[sampleIdx];
  const issues = sample ? validateSample(manifest.schema, sample.data) : [];
  const setSchema = (schema: JsonSchema) => onChange((m) => ({ ...m, schema }));
  return (
    <section id="ds-samples" className="dSection">
      <div className="dHead">
        <h3>Samples</h3>
        <button className="ghostBtn small" onClick={() => onChange((m) => ({ ...m, samples: [...m.samples, { name: `sample ${m.samples.length + 1}`, data: structuredClone(m.samples[sampleIdx]?.data ?? {}) }] }))}>
          ＋ Add
        </button>
      </div>
      <div className="sampleTabs">
        {manifest.samples.map((s, i) => (
          <button key={i} className={i === sampleIdx ? 'on' : ''} onClick={() => onSample(i)}>
            {s.name}
          </button>
        ))}
      </div>
      {sample ? (
        <>
          <input className="txt" value={sample.name} aria-label="Sample name" onChange={(e) => onChange((m) => ({ ...m, samples: m.samples.map((s, i) => (i === sampleIdx ? { ...s, name: e.target.value } : s)) }))} />
          <JsonField value={sample.data} rows={12} onChange={(v) => onChange((m) => ({ ...m, samples: m.samples.map((s, i) => (i === sampleIdx ? { ...s, data: v as Obj } : s)) }))} />
          {issues.length ? (
            <ul className="sampleIssues">
              {issues.map((i, n) => (
                <li key={n}>
                  <code>{i.path}</code> {i.message}
                </li>
              ))}
            </ul>
          ) : (
            <div className="okNote">✓ Matches the schema</div>
          )}
          <div className="rowBtns">
            <button className="ghostBtn small" onClick={() => setSchema(inferSchema(sample.data))} title="Replace the schema with one inferred from this sample">
              Infer schema from sample
            </button>
            {manifest.samples.length > 1 ? (
              <button className="ghostBtn small danger" onClick={() => onChange((m) => ({ ...m, samples: m.samples.filter((_, i) => i !== sampleIdx) }))}>
                Delete sample
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}

function SchemaFields({ schema, onChange, path, used }: { schema: JsonSchema; onChange: (s: JsonSchema) => void; path: string; used: string[] }) {
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const setProp = (key: string, next: JsonSchema | undefined, newKey?: string) => {
    const entries = Object.entries(props).flatMap(([k, v]) => (k === key ? (next ? [[newKey ?? k, next] as const] : []) : [[k, v] as const]));
    const req = [...required].filter((r) => r !== key || (next && !newKey)).concat(newKey && required.has(key) ? [newKey] : []);
    onChange({ ...schema, properties: Object.fromEntries(entries), required: req.length ? req : undefined });
  };
  const toggleRequired = (key: string) => {
    const req = required.has(key) ? [...required].filter((r) => r !== key) : [...required, key];
    onChange({ ...schema, required: req.length ? req : undefined });
  };
  return (
    <div className="schemaFields">
      {Object.entries(props).map(([key, sub]) => {
        const t = fieldTypeOf(sub);
        const full = path ? `${path}.${key}` : key;
        const isUsed = used.some((u) => u === full || u.startsWith(`${full}.`) || u.startsWith(`${full}[]`));
        return (
          <div key={key} className="schemaField">
            <div className="sfRow">
              <span className={isUsed ? 'usedDot on' : 'usedDot'} title={isUsed ? 'Read by this variant' : 'Not read by this variant'} />
              <input className="sfName" value={key} onChange={(e) => e.target.value && setProp(key, sub, e.target.value)} />
              <select value={t} onChange={(e) => setProp(key, schemaFor(e.target.value as FieldType, sub))}>
                {(['string', 'number', 'integer', 'boolean', 'enum', 'object', 'array'] as const).map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
              <button className={required.has(key) ? 'reqBtn on' : 'reqBtn'} title="Required" onClick={() => toggleRequired(key)}>
                req
              </button>
              <button className="fieldClear" title={`Remove ${key}`} onClick={() => setProp(key, undefined)}>
                ×
              </button>
            </div>
            <textarea className="sfPrompt" rows={1} placeholder="Prompt: what this field holds and how to extract it" value={sub.description ?? ''} onChange={(e) => setProp(key, { ...sub, description: e.target.value || undefined })} />
            {t === 'enum' ? (
              <input
                className="txt sfEnum"
                value={(sub.enum ?? []).join(', ')}
                onChange={(e) =>
                  setProp(key, {
                    ...sub,
                    enum: e.target.value
                      .split(',')
                      .map((x) => x.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Allowed values, comma separated"
              />
            ) : null}
            {t === 'object' ? (
              <div className="sfNested">
                <SchemaFields schema={sub} onChange={(n) => setProp(key, n)} path={full} used={used} />
              </div>
            ) : null}
            {t === 'array' ? (
              <div className="sfNested">
                <div className="sfItems">
                  Each item is
                  <select value={fieldTypeOf(sub.items ?? {})} onChange={(e) => setProp(key, { ...sub, items: schemaFor(e.target.value as FieldType, sub.items ?? {}) })}>
                    {(['string', 'number', 'integer', 'boolean', 'enum', 'object'] as const).map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>
                {sub.items?.type === 'object' ? <SchemaFields schema={sub.items} onChange={(n) => setProp(key, { ...sub, items: n })} path={`${full}[]`} used={used} /> : null}
              </div>
            ) : null}
          </div>
        );
      })}
      <button
        className="addField"
        onClick={() => {
          let n = 1;
          while (`field${n}` in props) n++;
          setProp(`field${n}`, { type: 'string' });
        }}
      >
        ＋ Add field
      </button>
    </div>
  );
}

function VariantsList({ manifest, current, onPick, onChange }: { manifest: TemplateManifest; current: string; onPick: (id: string) => void; onChange: ManifestFn }) {
  const update = (id: string, fn: (v: VariantInfo) => VariantInfo) => onChange((m) => ({ ...m, variants: m.variants.map((v) => (v.id === id ? fn(v) : v)) }));
  const moveVariant = (i: number, d: number) =>
    onChange((m) => {
      const vs = [...m.variants];
      const j = i + d;
      if (j < 0 || j >= vs.length) return m;
      [vs[i], vs[j]] = [vs[j]!, vs[i]!];
      return { ...m, variants: vs };
    });
  return (
    <div className="variantsList">
      {manifest.variants.map((v, i) => (
        <div key={v.id} className={v.id === current ? 'variantCard on' : 'variantCard'}>
          <div className="vcHead">
            <span className="vcOrder">{i + 1}</span>
            <input className="txt vcLabel" value={v.label} onChange={(e) => update(v.id, (x) => ({ ...x, label: e.target.value }))} />
            <button className="iconMini" onClick={() => moveVariant(i, -1)} title="Check earlier">
              ↑
            </button>
            <button className="iconMini" onClick={() => moveVariant(i, 1)} title="Check later">
              ↓
            </button>
            <button className="iconMini" onClick={() => onPick(v.id)} title="Edit this variant">
              ✎
            </button>
            {manifest.variants.length > 1 ? (
              <button className="iconMini danger" onClick={() => onChange((m) => ({ ...m, variants: m.variants.filter((x) => x.id !== v.id) }))} title="Remove variant">
                ✕
              </button>
            ) : null}
          </div>
          {v.targets.map((t, ti) => (
            <TargetRow
              key={ti}
              target={t}
              onChange={(nt) => update(v.id, (x) => ({ ...x, targets: x.targets.map((y, yi) => (yi === ti ? nt : y)) }))}
              onRemove={() => update(v.id, (x) => ({ ...x, targets: x.targets.filter((_, yi) => yi !== ti) }))}
            />
          ))}
          <div className="rowBtns">
            <button className="ghostBtn small" onClick={() => update(v.id, (x) => ({ ...x, targets: [...x.targets, { platform: 'android' }] }))}>
              ＋ Target
            </button>
            <label className="fallbackToggle">
              <input
                type="checkbox"
                checked={!!v.fallback}
                onChange={(e) => onChange((m) => ({ ...m, variants: m.variants.map((x) => ({ ...x, fallback: x.id === v.id ? e.target.checked : e.target.checked ? false : x.fallback })) }))}
              />
              Fallback
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}

function TargetRow({ target, onChange, onRemove }: { target: VariantTarget; onChange: (t: VariantTarget) => void; onRemove: () => void }) {
  const badRange = !!target.appVersion && !validRange(target.appVersion);
  return (
    <div className="targetRow">
      <select value={target.platform ?? ''} onChange={(e) => onChange({ ...target, platform: (e.target.value || undefined) as Platform | undefined })}>
        <option value="">Any</option>
        <option value="android">Android</option>
        <option value="ios">iOS</option>
        <option value="web">Web</option>
      </select>
      <input className={badRange ? 'txt bad mono' : 'txt mono'} placeholder=">=1.1.0" value={target.appVersion ?? ''} onChange={(e) => onChange({ ...target, appVersion: e.target.value || undefined })} title={badRange ? 'Not a valid semver range' : 'App version range (semver)'} />
      <input
        className="txt"
        placeholder="exp=arm"
        defaultValue={target.experiment ? `${target.experiment.name}=${target.experiment.arm}` : ''}
        title="Experiment bucket"
        onChange={(e) => {
          const [name, arm] = e.target.value.split('=').map((x) => x.trim());
          onChange({ ...target, experiment: name && arm ? { name, arm } : undefined });
        }}
      />
      <button className="fieldClear" onClick={onRemove} title="Remove target">
        ×
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  New template                                                       */
/* ------------------------------------------------------------------ */

function NewTemplateDialog({ existing, onClose, onCreate }: { existing: string[]; onClose: () => void; onCreate: (id: string, name: string, prompt: string, jsx: string) => void }) {
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [q, setQ] = useState('');
  const id = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  const taken = existing.includes(id);
  const ready = !!id && !taken;
  const stories = STORIES.filter((s) => `${s.group} ${s.title}`.toLowerCase().includes(q.toLowerCase())).slice(0, 60);
  const create = (tree: Obj) => ready && onCreate(id, name, prompt || `Describe when to use ${name}.`, printJsx(tree));
  return (
    <>
      <div className="scrim dark" onClick={onClose} />
      <div className="dialog" role="dialog" aria-label="New template">
        <div className="dialogHead">
          <h2>New template</h2>
          <button className="iconBtn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="field stacked">
          <label className="fieldLabel">Name</label>
          <div className="fieldCtl">
            <input className="txt" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hotel card" />
          </div>
        </div>
        <div className="muted small">{id ? (taken ? `“${id}” already exists` : `Template id: ${id}`) : 'The id comes from the name.'}</div>
        <div className="field stacked">
          <label className="fieldLabel">Selection prompt</label>
          <div className="fieldCtl">
            <textarea className="txt" rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="What it shows and when the LLM should pick it" />
          </div>
        </div>
        <div className="startGrid">
          <button className="startCard" disabled={!ready} onClick={() => create({ type: 'stack', gap: 'md', children: [{ type: 'text', style: 'body', value: 'Start here' }] })}>
            <span className="startGlyph">＋</span>
            <span className="startName">Blank</span>
            <span className="startSub">A stack with one text</span>
          </button>
          {(['card', 'form', 'carousel'] as const).map((t) => (
            <button key={t} className="startCard" disabled={!ready} onClick={() => create(snippet(t))}>
              <span className="startGlyph">{TYPE_GLYPH[t]}</span>
              <span className="startName">{t[0]!.toUpperCase() + t.slice(1)}</span>
              <span className="startSub">Starter {t}</span>
            </button>
          ))}
        </div>
        <div className="dialogSection">Or start from an explorer story</div>
        <input className="search" placeholder="Search components and atoms" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="storyPick">
          {stories.map((s) => (
            <button key={s.id} className="storyRow" disabled={!ready} onClick={() => create(s.raw as Obj)}>
              <span className="glyph">{TYPE_GLYPH[(s.raw as { type?: string }).type ?? ''] ?? '▢'}</span>
              <span className="storyTitle">{s.title}</span>
              <span className="storyGroup">
                {s.section} · {s.group}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
