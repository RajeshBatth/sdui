import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { View } from 'react-native';
import { parseView, viewNodeRegistry } from '../src';
import { SNAPSHOT_MANIFEST } from '../src/manifest/snapshot';
import type { Manifest } from '../src/manifest/types';
import { createRenderRegistry } from '../src/nodes/views';
import { ViewDraftsProvider } from '../src/render/drafts';
import { ViewRenderer } from '../src/render/ViewRenderer';
import { figmaUrl, STORIES, type Story } from './stories';
import battery from './assets/battery.svg';
import cellular from './assets/cellular.svg';
import close from './assets/close.svg';
import locationIcon from './assets/location.svg';
import menuDots from './assets/menu-dots.svg';
import paperclip from './assets/paperclip.svg';
import soundwave from './assets/soundwave.svg';
import sparkle from './assets/sparkle.svg';
import wifi from './assets/wifi.svg';

const WEB_FONTS: Manifest['font'] = {
  default: { regular: 'DM Sans', medium: 'DM Sans', semibold: 'DM Sans', bold: 'DM Sans', black: 'DM Sans' },
  geist: { regular: 'Geist', semibold: 'Geist' },
  inter: { semibold: 'Inter' },
};
const manifest: Manifest = { ...SNAPSHOT_MANIFEST, font: WEB_FONTS };
const registry = createRenderRegistry();

const WIDTHS = [320, 360, 412];
const BACKGROUNDS = { white: '#FFFFFF', screen: SNAPSHOT_MANIFEST.color.screen! };

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

type Frame = 'chat' | 'plain';

function ChatFrame({ width, prompt, background, children }: { width: number; prompt: string; background: string; children: React.ReactNode }) {
  return (
    <div className="phone" style={{ width: width + 40, background }}>
      <div className="statusbar">
        <span className="clock">9:41</span>
        <span className="levels">
          <img src={cellular} alt="" />
          <img src={wifi} alt="" />
          <img src={battery} alt="" />
        </span>
      </div>
      <div className="chatHeader">
        <span className="round">
          <img src={close} alt="Close" />
        </span>
        <span className="round">
          <img src={menuDots} alt="More" />
        </span>
      </div>
      <div className="chatBody">
        <div className="bubble">{prompt}</div>
        <div className="reply">
          <div className="myra">
            <span className="myraText">Myra</span>
            <img className="myraStar" src={sparkle} alt="" />
          </div>
          {children}
        </div>
      </div>
      <div className="composer">
        <div className="composerCard">
          <div className="placeholder">
            <span className="caret">|</span>Ask me anything
          </div>
          <div className="composerRow">
            <div className="composerLeft">
              <span className="chip iconChip">
                <img src={paperclip} alt="Attach" />
              </span>
              <span className="chip modeChip">
                <img src={locationIcon} alt="" />
                myItinerary Mode
              </span>
            </div>
            <span className="speak">
              <img src={soundwave} alt="" />
              <span className="speakText">Speak</span>
            </span>
          </div>
        </div>
        <div className="homeIndicator" />
      </div>
    </div>
  );
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
        <div className="brand">SDUI viewer</div>
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
            <div className="editor">
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

function Bare() {
  const params = new URLSearchParams(location.search);
  const story = STORIES.find((s) => s.id === params.get('story'));
  const width = Number(params.get('w') ?? 320);
  if (!story) return <div className="empty">Unknown story</div>;
  return (
    <div className="bare">
      <Canvas raw={story.raw} width={width} background="#FFFFFF" place={story.id} frame={params.get('frame') === 'chat' ? 'chat' : 'plain'} prompt={story.prompt} />
    </div>
  );
}

const bare = new URLSearchParams(location.search).get('bare') === '1';
createRoot(document.getElementById('root')!).render(bare ? <Bare /> : <Viewer />);
