import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const PLAYGROUND_URL = (process.env.SDUI_PLAYGROUND_URL ?? 'http://localhost:5199').replace(/\/$/, '');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean) as string[];

export function chromePath(): string {
  const found = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!found) throw new Error('Chrome not found. Set CHROME_PATH to a Chrome or Chromium binary.');
  return found;
}

export interface RenderOptions {
  id: string;
  variant: string;
  sample: number;
  width: number;
  frame: 'plain' | 'chat';
  scale?: number;
}

/** Minimal Chrome DevTools Protocol session over the built-in WebSocket. */
class Cdp {
  private next = 1;
  private waiting = new Map<number, { ok: (v: any) => void; fail: (e: Error) => void }>();
  constructor(private ws: WebSocket) {
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(String(e.data));
      const w = msg.id !== undefined ? this.waiting.get(msg.id) : undefined;
      if (!w) return;
      this.waiting.delete(msg.id);
      if (msg.error) w.fail(new Error(msg.error.message));
      else w.ok(msg.result);
    });
  }
  static open(url: string): Promise<Cdp> {
    return new Promise((ok, fail) => {
      const ws = new WebSocket(url);
      ws.addEventListener('open', () => ok(new Cdp(ws)), { once: true });
      ws.addEventListener('error', () => fail(new Error('Could not connect to Chrome')), { once: true });
    });
  }
  send<T = any>(method: string, params: object = {}, sessionId?: string): Promise<T> {
    const id = this.next++;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((ok, fail) => this.waiting.set(id, { ok, fail }));
  }
  close() {
    this.ws.close();
  }
}

function launch(): Promise<{ wsUrl: string; kill: () => void }> {
  const profile = mkdtempSync(join(tmpdir(), 'sdui-chrome-'));
  const proc = spawn(chromePath(), ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const kill = () => {
    proc.kill();
    setTimeout(() => rmSync(profile, { recursive: true, force: true }), 500);
  };
  return new Promise((ok, fail) => {
    let buf = '';
    const timer = setTimeout(() => {
      kill();
      fail(new Error('Chrome did not start'));
    }, 15000);
    proc.stderr.on('data', (d) => {
      buf += String(d);
      const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf);
      if (m) {
        clearTimeout(timer);
        ok({ wsUrl: m[1]!, kill });
      }
    });
    proc.on('exit', () => {
      clearTimeout(timer);
      fail(new Error('Chrome exited early'));
    });
  });
}

/** Render a saved template through the running playground and return a PNG cropped to the content. */
export async function renderPng(o: RenderOptions): Promise<{ png: string; width: number; height: number }> {
  try {
    const r = await fetch(`${PLAYGROUND_URL}/api/templates`);
    if (!r.ok) throw new Error();
  } catch {
    throw new Error(`The playground isn't running at ${PLAYGROUND_URL}. Start it with \`npm run viewer\` (or set SDUI_PLAYGROUND_URL).`);
  }
  const url = `${PLAYGROUND_URL}/?bare=1&template=${encodeURIComponent(o.id)}&variant=${encodeURIComponent(o.variant)}&sample=${o.sample}&w=${o.width}&frame=${o.frame}`;
  const { wsUrl, kill } = await launch();
  let cdp: Cdp | undefined;
  try {
    cdp = await Cdp.open(wsUrl);
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const s = <T = any>(m: string, p: object = {}) => cdp!.send<T>(m, p, sessionId);
    const viewW = o.width + 40;
    await s('Emulation.setDeviceMetricsOverride', { width: viewW, height: 900, deviceScaleFactor: o.scale ?? 2, mobile: false });
    await s('Page.enable');
    await s('Page.navigate', { url });

    const deadline = Date.now() + 20000;
    let title = '';
    while (Date.now() < deadline) {
      const r = await s<{ result: { value: string } }>('Runtime.evaluate', { expression: 'document.title', returnByValue: true });
      title = r.result.value;
      if (title.startsWith('sdui-ready:') || title.startsWith('sdui-error:')) break;
      await new Promise((r) => setTimeout(r, 150));
    }
    if (title.startsWith('sdui-error:')) throw new Error(title.slice('sdui-error:'.length));
    if (!title.startsWith('sdui-ready:')) throw new Error('Timed out waiting for the template to render');
    const height = Math.max(1, Number(title.slice('sdui-ready:'.length)));
    await s('Emulation.setDeviceMetricsOverride', { width: viewW, height, deviceScaleFactor: o.scale ?? 2, mobile: false });
    await new Promise((r) => setTimeout(r, 100));
    const shot = await s<{ data: string }>('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: viewW, height, scale: 1 }, captureBeyondViewport: true });
    return { png: shot.data, width: viewW, height };
  } finally {
    cdp?.close();
    kill();
  }
}
