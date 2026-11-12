import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { View } from 'react-native';
import { parseView, viewNodeRegistry } from '../src';
import { ViewDraftsProvider } from '../src/render/drafts';
import { ViewRenderer } from '../src/render/ViewRenderer';
import { figmaUrl, STORIES, type Story } from './stories';
import { BACKGROUNDS, ChatFrame, manifest, registry, WIDTHS, type Frame } from './shared';
import { Editor } from './editor/Editor';
import { openStoryInPlayground, playgroundHash } from './editor/fromStory';
import { compileJsx, instantiate } from '../src/authoring/compile';
import type { TemplateManifest } from '../src/authoring/template';


interface LogEntry {
  at: string;
  kind: 'action' | 'track';
  payload: unknown;
}

function useRoute(): [string, (id: string) => void] {
  const read = () => decodeURIComponent(location.hash.replace(/^#\/?/, '')) || STORIES[0]!.id;
  const [id, setId] = useState(read);
  useEffect(() => {
    const on = () => setId(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return [id, (next) => (location.hash = `/${next}`)];
}

function Canvas({
  raw,
  width,
  background,
  onLog,
  place,
  frame = 'plain',
  prompt = '',
}: {
  raw: unknown;
  width: number;
  background: string;
  onLog?: (e: LogEntry) => void;
  place: string;
  frame?: Frame;
  prompt?: string;
}) {
  const parsed = useMemo(() => parseView(viewNodeRegistry, raw), [raw]);
  const log = (kind: LogEntry['kind']) => (payload: unknown) => onLog?.({ at: new Date().toLocaleTimeString(), kind, payload });
  const onAction = useMemo(() => log('action'), [onLog]);
  const onTrack = useMemo(() => log('track'), [onLog]);
  const content = parsed.root ? (
    <View style={{ width }}>
      <ViewDraftsProvider>
        <ViewRenderer key={place} root={parsed.root} registry={registry} manifest={manifest} place={place} draftKey={place} onAction={onAction as never} onTrack={onTrack as never} />
      </ViewDraftsProvider>
    </View>
  ) : (
    <div className="empty">Nothing draws: the tree failed to parse.</div>
  );
  if (frame === 'chat') {
    return (
      <ChatFrame width={width} prompt={prompt} background={background}>
        {content}
      </ChatFrame>
    );
  }
  return (
    <div className="device" style={{ width: width + 40, background }}>
      {parsed.root ? (
        <View style={{ width }}>
          <ViewDraftsProvider>
            <ViewRenderer key={place} root={parsed.root} registry={registry} manifest={manifest} place={place} draftKey={place} onAction={onAction as never} onTrack={onTrack as never} />
          </ViewDraftsProvider>
        </View>
      ) : (
        <div className="empty">Nothing draws: the tree failed to parse.</div>
      )}
    </div>
  );
}

function issuesOf(raw: unknown) {
  return parseView(viewNodeRegistry, raw).issues;
}

const topGroupOf = (s: Story) => `${s.section}/${s.family ?? s.group}`;
const FIRST_GROUP = topGroupOf(STORIES[0]!);

function Sidebar({ current, onPick }: { current: string; onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const currentStory = STORIES.find((s) => s.id === current);
  const [open, setOpen] = useState<Set<string>>(() => new Set([FIRST_GROUP, ...(currentStory ? [topGroupOf(currentStory)] : [])]));
  useEffect(() => {
    if (!currentStory) return;
    const key = topGroupOf(currentStory);
    setOpen((o) => (o.has(key) ? o : new Set(o).add(key)));
  }, [currentStory]);
  const toggle = (key: string) =>
    setOpen((o) => {
      const next = new Set(o);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const shown = STORIES.filter((s) => !q || `${s.family ?? ''} ${s.group} ${s.title}`.toLowerCase().includes(q.toLowerCase()));
  const sections = ['Atoms', 'Components'] as const;
  return (
    <nav className="sidebar">
      <div className="sidebarHead">
        <ModeSwitch mode="explore" />
        <input className="search" placeholder="Search stories" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="sidebarList">
      {sections.map((section) => {
        const inSection = shown.filter((s) => s.section === section);
        const tops = [...new Set(inSection.map(topGroupOf))];
        if (!tops.length) return null;
        return (
          <div key={section}>
            <div className="section">{section}</div>
            {tops.map((top) => {
              const stories = inSection.filter((s) => topGroupOf(s) === top);
              const isOpen = q !== '' || open.has(top);
              const label = top.slice(section.length + 1);
              const hasActive = stories.some((s) => s.id === current);
              const subgroups = [...new Set(stories.map((s) => s.group))].filter((g) => g !== label);
              return (
                <div key={top} className="top">
                  <button className={hasActive ? 'topTitle current' : 'topTitle'} aria-expanded={isOpen} onClick={() => toggle(top)}>
                    <span className={isOpen ? 'chev open' : 'chev'}>›</span>
                    {label}
                    <span className="count">{stories.length}</span>
                  </button>
                  {isOpen ? (
                    <div className="topBody">
                      {(subgroups.length ? subgroups : [label]).map((g) => {
                        const missing = section === 'Atoms' && !registry.has(g);
                        return (
                          <div key={g} className="group">
                            {subgroups.length ? (
                              <div className="groupTitle">
                                {g}
                                {missing ? <span className="tag">no view</span> : null}
                              </div>
                            ) : null}
                            {stories
                              .filter((s) => s.group === g)
                              .map((s) => (
                                <a key={s.id} className={s.id === current ? 'item active' : 'item'} href={`#/${s.id}`} onClick={() => onPick(s.id)}>
                                  {s.title}
                                </a>
                              ))}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })}
      </div>
    </nav>
  );
}

interface Settings {
  width: number;
  bg: keyof typeof BACKGROUNDS;
  frame: Frame;
}
const SETTINGS_KEY = 'sdui-viewer-settings';
const DEFAULT_SETTINGS: Settings = { width: 320, bg: 'white', frame: 'chat' };

function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') as Partial<Settings> | null;
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function Segmented<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <div className="setting">
      <span className="settingLabel">{label}</span>
      <div className="seg">
        {options.map((o) => (
          <button key={String(o)} className={o === value ? 'on' : ''} onClick={() => onChange(o)}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function StoryView({ story, settings, onSettings }: { story: Story; settings: Settings; onSettings: (s: Settings) => void }) {
  const { width, bg, frame } = settings;
  const [tab, setTab] = useState<'json' | 'issues' | 'events'>('events');
  const [source, setSource] = useState(() => JSON.stringify(story.raw, null, 2));
  const [raw, setRaw] = useState<unknown>(story.raw);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  const issues = useMemo(() => issuesOf(raw), [raw]);
  const missing = story.section === 'Atoms' && !registry.has(story.group);
  const onLog = useMemo(() => (e: LogEntry) => setLog((l) => [e, ...l].slice(0, 50)), []);
  const edited = source !== JSON.stringify(story.raw, null, 2);
  const [opening, setOpening] = useState<string | null>(null);
  const editInPlayground = async () => {
    setOpening('Opening…');
    try {
      location.hash = playgroundHash(await openStoryInPlayground(story, raw));
    } catch (e) {
      setOpening(`Couldn't open: ${(e as Error).message}`);
    }
  };

  return (
    <>
      <main className={frame === 'chat' ? 'stage chat' : 'stage'}>
        {missing ? <div className="banner">No view is registered for “{story.group}” yet: the tree parses but draws nothing.</div> : null}
        <Canvas raw={raw} width={width} background={BACKGROUNDS[bg]} onLog={onLog} place={story.id} frame={frame} prompt={story.prompt} />
      </main>
      <aside className="inspector">
        <header className="inspectorHead">
          <span className="crumb">
            {story.section} / {story.family ? `${story.family} / ` : ''}
            {story.group}
          </span>
          <h1>{story.title}</h1>
          <button className="editInPg" onClick={() => void editInPlayground()} disabled={opening === 'Opening…'} title="Make a template from this story (or reopen the one made before) and edit it in the playground">
            {opening ?? 'Edit in Playground →'}
          </button>
          <div className="links">
            {story.figma ? (
              <a href={figmaUrl(story.figma)} target="_blank" rel="noreferrer">
                Open in Figma ↗
              </a>
            ) : null}
            <a href={`?story=${encodeURIComponent(story.id)}&bare=1&w=${width}&frame=${frame}`} target="_blank" rel="noreferrer">
              Canvas only ↗
            </a>
          </div>
        </header>
        <div className="settings">
          <Segmented label="Frame" value={frame} options={['chat', 'plain'] as const} onChange={(v) => onSettings({ ...settings, frame: v })} />
          <Segmented label="Width" value={width} options={WIDTHS} onChange={(v) => onSettings({ ...settings, width: v })} />
          <Segmented label="Screen" value={bg} options={Object.keys(BACKGROUNDS) as (keyof typeof BACKGROUNDS)[]} onChange={(v) => onSettings({ ...settings, bg: v })} />
        </div>
        <div className="tabs">
          <button className={tab === 'events' ? 'on' : ''} onClick={() => setTab('events')}>
            Events {log.length ? <span className="badge">{log.length}</span> : null}
          </button>
          <button className={tab === 'issues' ? 'on' : ''} onClick={() => setTab('issues')}>
            Issues {issues.length ? <span className="badge warn">{issues.length}</span> : null}
          </button>
          <button className={tab === 'json' ? 'on' : ''} onClick={() => setTab('json')}>
            JSON {edited ? <span className="badge">edited</span> : null}
          </button>
        </div>
        <div className="tabBody">
          {tab === 'events' ? (
            <div className="log">
              {log.length === 0 ? <div className="muted">Tap something in the preview to see its action or tracking event.</div> : null}
              {log.map((e, i) => (
                <div key={i} className="entry">
                  <div className="entryHead">
                    <span className={`kind ${e.kind}`}>{e.kind}</span>
                    <span className="muted">{e.at}</span>
                  </div>
                  <pre>{JSON.stringify(e.payload, null, 2)}</pre>
                </div>
              ))}
            </div>
          ) : null}
          {tab === 'issues' ? (
            <div className="log">
              {issues.length === 0 ? <div className="muted">No parse issues.</div> : null}
              {issues.map((i, n) => (
                <pre key={n}>{JSON.stringify(i, null, 2)}</pre>
              ))}
            </div>
          ) : null}
          {tab === 'json' ? (
            <div className="jsonEditor">
              <textarea
                spellCheck={false}
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  try {
                    setRaw(JSON.parse(e.target.value));
                    setJsonError(null);
                  } catch (err) {
                    setJsonError((err as Error).message);
                  }
                }}
              />
              <div className="editorFoot">
                {jsonError ? <span className="error">{jsonError}</span> : <span className="muted">Edits re-render live.</span>}
                {edited ? (
                  <button
                    className="linkButton"
                    onClick={() => {
                      setSource(JSON.stringify(story.raw, null, 2));
                      setRaw(story.raw);
                      setJsonError(null);
                    }}
                  >
                    Reset
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}

function Viewer() {
  const [id, go] = useRoute();
  const story = STORIES.find((s) => s.id === id) ?? STORIES[0]!;
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const update = (next: Settings) => {
    setSettings(next);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {}
  };
  return (
    <div className="app">
      <Sidebar current={story.id} onPick={go} />
      <StoryView key={story.id} story={story} settings={settings} onSettings={update} />
    </div>
  );
}

/** Headless render of a saved template, for the MCP render tool. Reports `sdui-ready:<height>` or `sdui-error:<message>` in the title. */
function TemplateBare({ id, params }: { id: string; params: URLSearchParams }) {
  const [state, setState] = useState<{ raw?: unknown; prompt?: string; error?: string }>({});
  const width = Number(params.get('w') ?? 360);
  const frame: Frame = params.get('frame') === 'chat' ? 'chat' : 'plain';
  useEffect(() => {
    fetch(`/api/templates/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? r.statusText);
        const { manifest: m, sources } = body as { manifest: TemplateManifest; sources: Record<string, string> };
        const variant = params.get('variant') ?? m.variants[0]?.id ?? '';
        if (!(variant in sources)) throw new Error(`Unknown variant "${variant}"`);
        const sample = m.samples[Number(params.get('sample') ?? 0)]?.data ?? {};
        const compiled = compileJsx(sources[variant]!);
        setState({ raw: instantiate(compiled, sample), prompt: m.name });
      })
      .catch((e: Error) => setState({ error: e.message }));
  }, [id]);
  useEffect(() => {
    if (state.error) {
      document.title = `sdui-error:${state.error}`;
      return;
    }
    if (!state.raw) return;
    let live = true;
    const settle = async () => {
      await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 50));
      await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => {
                img.addEventListener('load', r, { once: true });
                img.addEventListener('error', r, { once: true });
              }))));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const el = document.querySelector('.bare')?.firstElementChild as HTMLElement | null;
      if (live) document.title = `sdui-ready:${Math.ceil(el?.getBoundingClientRect().height ?? 0)}`;
    };
    void settle();
    return () => {
      live = false;
    };
  }, [state]);
  if (state.error) return <div className="empty">{state.error}</div>;
  if (!state.raw) return null;
  return (
    <div className="bare">
      <Canvas raw={state.raw} width={width} background="#FFFFFF" place={`template-${id}`} frame={frame} prompt={state.prompt} />
    </div>
  );
}

function Bare() {
  const params = new URLSearchParams(location.search);
  const template = params.get('template');
  if (template) return <TemplateBare id={template} params={params} />;
  const story = STORIES.find((s) => s.id === params.get('story'));
  const width = Number(params.get('w') ?? 320);
  if (!story) return <div className="empty">Unknown story</div>;
  return (
    <div className="bare">
      <Canvas raw={story.raw} width={width} background="#FFFFFF" place={story.id} frame={params.get('frame') === 'chat' ? 'chat' : 'plain'} prompt={story.prompt} />
    </div>
  );
}

export function ModeSwitch({ mode }: { mode: 'explore' | 'playground' }) {
  return (
    <div className="modeRow">
      <span className="brand">SDUI</span>
      <div className="modeSwitch" role="tablist">
        <a role="tab" aria-selected={mode === 'explore'} className={mode === 'explore' ? 'on' : ''} href="#/">
          Explore
        </a>
        <a role="tab" aria-selected={mode === 'playground'} className={mode === 'playground' ? 'on' : ''} href="#/playground">
          Playground
        </a>
      </div>
    </div>
  );
}

function App() {
  const [playground, setPlayground] = useState(() => location.hash.startsWith('#/playground'));
  useEffect(() => {
    const on = () => setPlayground(location.hash.startsWith('#/playground'));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return playground ? <Editor modeSwitch={<ModeSwitch mode="playground" />} /> : <Viewer />;
}

const bare = new URLSearchParams(location.search).get('bare') === '1';
createRoot(document.getElementById('root')!).render(bare ? <Bare /> : <App />);
