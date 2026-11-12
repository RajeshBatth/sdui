import { existsSync, mkdirSync, watch } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import type { PlaygroundContext } from './context';
import { addReference, deleteTemplate, ensureSeed, FOCUS_FILE, listTemplates, readAsset, readContext, readFocus, readTemplate, removeReference, recentWriter, TEMPLATES_DIR, writeContext, writeTemplate } from './store';

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
};

const readBody = (req: IncomingMessage) =>
  new Promise<unknown>((ok, fail) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        ok(data ? JSON.parse(data) : {});
      } catch (e) {
        fail(e);
      }
    });
  });

/** /api/templates CRUD over playground/private/templates and an /api/events stream of file changes. */
export function templatesPlugin(): Plugin {
  const clients = new Set<ServerResponse>();
  const recentWrites = new Map<string, string>();
  return {
    name: 'sdui-templates',
    configureServer(server) {
      ensureSeed();
      if (!existsSync(TEMPLATES_DIR)) mkdirSync(TEMPLATES_DIR, { recursive: true });
      const pending = new Map<string, ReturnType<typeof setTimeout>>();
      watch(TEMPLATES_DIR, { recursive: true }, (_event, file) => {
        const id = String(file ?? '').split(/[\\/]/)[0];
        if (id === FOCUS_FILE) {
          clearTimeout(pending.get(FOCUS_FILE));
          pending.set(
            FOCUS_FILE,
            setTimeout(() => {
              const focus = readFocus();
              if (!focus) return;
              const msg = `data: ${JSON.stringify({ type: 'focus', ...focus })}\n\n`;
              for (const c of clients) c.write(msg);
            }, 60),
          );
          return;
        }
        if (!id || id.startsWith('.')) return;
        clearTimeout(pending.get(id));
        pending.set(
          id,
          setTimeout(() => {
            const by = recentWrites.get(id) ?? recentWriter(id) ?? 'disk';
            recentWrites.delete(id);
            const msg = `data: ${JSON.stringify({ type: 'changed', id, by, at: Date.now() })}\n\n`;
            for (const c of clients) c.write(msg);
          }, 120),
        );
      });

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '', 'http://x');
        if (url.pathname === '/api/events') {
          res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
          res.write(': connected\n\n');
          clients.add(res);
          req.on('close', () => clients.delete(res));
          return;
        }
        if (url.pathname === '/api/context') {
          try {
            if (req.method === 'PUT') {
              writeContext((await readBody(req)) as PlaygroundContext);
              return json(res, 200, { ok: true });
            }
            if (req.method === 'GET') return json(res, 200, readContext());
            return json(res, 405, { error: 'Method not allowed' });
          } catch (e) {
            return json(res, 400, { error: (e as Error).message });
          }
        }
        if (!url.pathname.startsWith('/api/templates')) return next();
        const [id = '', sub, file] = url.pathname.slice('/api/templates'.length).split('/').filter(Boolean).map(decodeURIComponent);
        try {
          if (sub === 'assets' && file) {
            if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
            const a = readAsset(id, file);
            res.setHeader('content-type', a.type);
            res.setHeader('cache-control', 'no-cache');
            return res.end(a.data);
          }
          if (sub === 'references') {
            recentWrites.set(id, String(req.headers['x-client-id'] ?? 'api'));
            if (req.method === 'POST') {
              const b = (await readBody(req)) as { name: string; imageBase64?: string; figma?: string; sample?: number; scale?: number };
              const image = b.imageBase64 ? Buffer.from(b.imageBase64.replace(/^data:[^,]+,/, ''), 'base64') : undefined;
              return json(res, 200, await addReference(id, { name: b.name, image, figma: b.figma, sample: b.sample, scale: b.scale }));
            }
            if (req.method === 'DELETE' && file) return json(res, 200, removeReference(id, file));
            return json(res, 405, { error: 'Method not allowed' });
          }
          if (sub) return json(res, 404, { error: 'Not found' });
          if (!id && req.method === 'GET') return json(res, 200, listTemplates());
          if (id && req.method === 'GET') return json(res, 200, readTemplate(id));
          if (id && req.method === 'PUT') {
            const body = (await readBody(req)) as Parameters<typeof writeTemplate>[1];
            recentWrites.set(id, String(req.headers['x-client-id'] ?? 'api'));
            return json(res, 200, writeTemplate(id, body));
          }
          if (id && req.method === 'DELETE') {
            deleteTemplate(id);
            return json(res, 200, { ok: true });
          }
          return json(res, 405, { error: 'Method not allowed' });
        } catch (e) {
          return json(res, 400, { error: (e as Error).message });
        }
      });
    },
  };
}
