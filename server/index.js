/**
 * HTTP server.
 *
 * Serves the static front end and the JSON API from Node's built-in modules —
 * no Express, no dependency tree at all. Two responsibilities:
 *
 *   static  the browser loads /web/* and imports /shared/* directly as ES
 *           modules, so both directories are served verbatim. That is what
 *           lets the same source run in Node and in the browser with no build
 *           step and no bundler.
 *
 *   api     everything under /api/*, delegated to server/api/*.js
 *
 * The app also runs as pure static hosting (GitHub Pages, Netlify) with no
 * server at all: the client falls back to executing commands locally against
 * the very same shared/ modules. The API adds cross-device persistence, not
 * capability.
 */

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, posix, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Router, sendError } from './router.js';
import * as store from './store.js';
import { getList, putList, deleteList, addListItem, updateListItem, deleteListItem } from './api/list.js';
import { postCommand, postParse } from './api/command.js';
import {
  getSearch,
  postSearch,
  getSuggestions,
  getSeasonal,
  getSubstitutes,
  getCatalog,
  getHealth
} from './api/discovery.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

/**
 * Directories the static handler will serve.
 *
 * A whitelist rather than "serve the repo": server/ source and any future
 * data directory should never be reachable over HTTP, even though this is an
 * open-source project.
 */
const PUBLIC_PREFIXES = ['/web/', '/shared/'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

// ---------------------------------------------------------------- routes ---

const router = new Router();

router
  .get('/api/health', getHealth)
  .get('/api/list', getList)
  .put('/api/list', putList)
  .delete('/api/list', deleteList)
  .post('/api/list/item', addListItem)
  .put('/api/list/item/:id', updateListItem)
  .delete('/api/list/item/:id', deleteListItem)
  .post('/api/command', postCommand)
  .post('/api/parse', postParse)
  .get('/api/search', getSearch)
  .post('/api/search', postSearch)
  .get('/api/suggestions', getSuggestions)
  .get('/api/seasonal', getSeasonal)
  .get('/api/substitutes/:id', getSubstitutes)
  .get('/api/catalog', getCatalog);

// ---------------------------------------------------------------- static ---

/**
 * Resolve a URL path to a file on disk, or null if it is not servable.
 *
 * Rejects anything that escapes ROOT after normalisation, which is the whole
 * defence against `GET /web/../../etc/passwd` style traversal.
 */
function resolveStatic(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // Malformed percent-encoding is never a legitimate request.
    return null;
  }

  // Backslashes are path separators on Windows but not in URLs, so anything
  // containing one is trying to be clever.
  if (decoded.includes('\\') || decoded.includes('\0')) return null;

  // Normalise BEFORE testing the whitelist.
  //
  // This ordering is the whole defence. Normalisation clamps at the root, so
  // "/web/../../package.json" collapses to "/package.json" — which fails the
  // whitelist. Testing the prefix first would see the literal "/web/" at the
  // front, accept it, and then serve a file from outside web/ entirely.
  let normalized = posix.normalize(decoded);
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;

  // Nothing legitimate survives normalisation still holding "..".
  if (normalized.split('/').includes('..')) return null;

  if (normalized.endsWith('/')) normalized += 'index.html';

  if (!PUBLIC_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return null;

  const target = join(ROOT, normalized);
  // Belt and braces: confirm the resolved path really is inside the project.
  if (target !== ROOT && !target.startsWith(ROOT + sep)) return null;

  return target;
}

async function serveStatic(req, res, pathname) {
  const filePath = resolveStatic(pathname);

  if (!filePath) {
    sendError(res, 404, 'Not found');
    return;
  }

  let info;
  try {
    info = await stat(filePath);
    if (info.isDirectory()) {
      sendError(res, 404, 'Not found');
      return;
    }
  } catch {
    sendError(res, 404, 'Not found');
    return;
  }

  const etag = `W/"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`;
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { etag });
    res.end();
    return;
  }

  const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';

  res.writeHead(200, {
    'content-type': type,
    'content-length': info.size,
    etag,
    // Revalidate every time: the app ships unbundled and unversioned, so a
    // stale cached module is far more costly than a conditional request.
    'cache-control': 'no-cache',
    'x-content-type-options': 'nosniff'
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  const stream = createReadStream(filePath);
  stream.on('error', () => {
    res.destroy();
  });
  stream.pipe(res);
}

// --------------------------------------------------------------- handler ---

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { pathname } = url;

  // The API is same-origin in normal use; CORS is opened up so the front end
  // can be hosted separately (static host + API host) if a deployment splits
  // them. There is no auth and no personal data behind it.
  res.setHeader('access-control-allow-origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('access-control-allow-headers', 'content-type, x-session-id, x-lang');
  res.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname.startsWith('/api/')) {
    const route = router.match(req.method, pathname);

    if (!route) {
      sendError(res, 404, `No route for ${req.method} ${pathname}`);
      return;
    }

    try {
      await route.handler(req, res, { url, params: route.params });
    } catch (error) {
      // A handler throwing is a bug, not a client problem — log it in full,
      // but never leak a stack trace to the caller.
      const status = error.status || 500;
      if (status >= 500) console.error(`[api] ${req.method} ${pathname} failed:`, error);
      if (!res.headersSent) sendError(res, status, status >= 500 ? 'Internal server error' : error.message);
    }

    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendError(res, 405, 'Method not allowed');
    return;
  }

  // Redirect the bare root rather than serving web/index.html from "/".
  //
  // The page imports its modules relatively (./app/main.js, ../../shared/...)
  // so that the exact same files work under a static host with no config. If
  // "/" served the HTML directly, those relative URLs would resolve against
  // "/" and miss the web/ directory entirely.
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(302, { location: '/web/' });
    res.end();
    return;
  }

  await serveStatic(req, res, pathname);
}

// ----------------------------------------------------------------- boot ----

const server = createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error('[server] unhandled error:', error);
    if (!res.headersSent) sendError(res, 500, 'Internal server error');
  });
});

async function start() {
  await store.load();

  server.listen(PORT, HOST, () => {
    console.log(`Voice Command Shopping Assistant`);
    console.log(`  listening on http://localhost:${PORT}`);
    console.log(`  storage:     ${store.isPersistent() ? 'file-backed' : 'memory only'}`);
  });
}

/** Flush pending writes before exiting so nothing is lost on a redeploy. */
async function shutdown(signal) {
  console.log(`\n[server] ${signal} received, shutting down`);

  server.close();

  try {
    await store.flushNow();
  } catch (error) {
    console.error('[server] failed to flush on shutdown:', error);
  }

  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((error) => {
  console.error('[server] failed to start:', error);
  process.exit(1);
});

export { server, handle };
