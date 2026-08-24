/**
 * HTTP API tests.
 *
 * Boots the real server on an ephemeral port with a throwaway data directory,
 * then drives it over real HTTP. No mocks: the value of these tests is that
 * they exercise the actual routing, body parsing, persistence and error paths
 * a deployed instance would use.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Chosen high to avoid colliding with a dev server on 3000. */
const PORT = 34871;
const BASE = `http://127.0.0.1:${PORT}`;

let dataDir;
let server;

/** Small fetch wrapper that always returns { status, body }. */
async function call(path, options = {}) {
  const { method = 'GET', body = null, session = 'test-session', lang = 'en', raw = null } = options;

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'x-session-id': session,
      'x-lang': lang,
      ...(body || raw ? { 'content-type': 'application/json' } : {})
    },
    body: raw !== null ? raw : body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }

  return { status: response.status, body: parsed, headers: response.headers };
}

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'vcsa-test-'));
  process.env.DATA_DIR = dataDir;
  process.env.PORT = String(PORT);

  // Importing the server starts it; wait for the port to accept connections.
  ({ server } = await import('../server/index.js'));

  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await fetch(`${BASE}/api/health`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  throw new Error('server did not start');
});

after(async () => {
  server?.close();
  await rm(dataDir, { recursive: true, force: true });
});

describe('health', () => {
  test('reports catalog and NLP diagnostics', async () => {
    const { status, body } = await call('/api/health');

    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.ok(body.catalog.products > 100);
    assert.ok(body.nlp.matcherIndex > 500);
    assert.deepEqual(body.languages.sort(), ['en', 'es', 'fr', 'hi']);
  });
});

describe('command endpoint', () => {
  test('adds items and returns the updated list', async () => {
    const { status, body } = await call('/api/command', {
      method: 'POST',
      body: { text: 'add two litres of milk and 3 apples', lang: 'en' },
      session: 'cmd-1'
    });

    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.changed, true);
    assert.equal(body.responses[0].kind, 'added');

    assert.deepEqual(
      body.list.items.map((item) => [item.productId, item.quantity]).sort(),
      [['apple', 3], ['milk', 2]]
    );
    assert.ok(body.list.totals.estimatedFormatted.startsWith('₹'));
  });

  test('keeps sessions isolated', async () => {
    await call('/api/command', { method: 'POST', body: { text: 'add bread' }, session: 'iso-a' });
    const other = await call('/api/list', { session: 'iso-b' });

    assert.equal(other.body.items.length, 0);
  });

  test('a search does not change the list or bump the version', async () => {
    await call('/api/command', { method: 'POST', body: { text: 'add milk' }, session: 'cmd-2' });
    const before = await call('/api/list', { session: 'cmd-2' });

    const search = await call('/api/command', {
      method: 'POST',
      body: { text: 'find toothpaste under 5 dollars' },
      session: 'cmd-2'
    });

    assert.equal(search.body.changed, false);
    assert.equal(search.body.responses[0].kind, 'search');
    assert.equal(search.body.list.version, before.body.version);
  });

  test('responds in the requested language', async () => {
    const { body } = await call('/api/command', {
      method: 'POST',
      body: { text: 'दो लीटर दूध जोड़ो', lang: 'hi' },
      session: 'cmd-hi',
      lang: 'hi'
    });

    assert.equal(body.lang, 'hi');
    assert.equal(body.responses[0].speak, 'दूध 2 लीटर जोड़ दिया');
    assert.ok(body.list.totals.estimatedFormatted.includes('₹'));
  });

  test('rejects an empty command', async () => {
    const { status, body } = await call('/api/command', { method: 'POST', body: { text: '   ' } });

    assert.equal(status, 400);
    assert.equal(body.ok, false);
  });

  test('rejects a malformed JSON body', async () => {
    const { status, body } = await call('/api/command', { method: 'POST', raw: '{not json' });

    assert.equal(status, 400);
    assert.equal(body.ok, false);
  });

  test('parse endpoint inspects without side effects', async () => {
    const before = await call('/api/list', { session: 'parse-only' });
    const { body } = await call('/api/parse', {
      method: 'POST',
      body: { text: 'add 3 apples' },
      session: 'parse-only'
    });
    const after = await call('/api/list', { session: 'parse-only' });

    assert.equal(body.commands[0].intent, 'add');
    assert.equal(after.body.version, before.body.version);
    assert.equal(after.body.items.length, 0);
  });
});

describe('list endpoints', () => {
  test('adds, updates and deletes a single item', async () => {
    const session = 'crud';

    const created = await call('/api/list/item', {
      method: 'POST',
      body: { productId: 'milk', name: 'Milk', quantity: 2 },
      session
    });
    assert.equal(created.status, 201);
    const itemId = created.body.item.id;

    const updated = await call(`/api/list/item/${itemId}`, {
      method: 'PUT',
      body: { quantity: 5, bought: true },
      session
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.items[0].quantity, 5);
    assert.equal(updated.body.items[0].bought, true);

    const deleted = await call(`/api/list/item/${itemId}`, { method: 'DELETE', session });
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.items.length, 0);
  });

  test('404s for an unknown item id', async () => {
    const { status } = await call('/api/list/item/does-not-exist', {
      method: 'DELETE',
      session: 'crud'
    });
    assert.equal(status, 404);
  });

  test('rejects an item with neither name nor productId', async () => {
    const { status } = await call('/api/list/item', { method: 'POST', body: { quantity: 2 } });
    assert.equal(status, 400);
  });

  test('PUT replaces the list and sanitises what it is given', async () => {
    const session = 'replace';

    const { status, body } = await call('/api/list', {
      method: 'PUT',
      body: {
        state: {
          items: [
            { name: 'Milk', productId: 'milk', quantity: 2, unit: 'l' },
            { name: '', quantity: 1 },
            null
          ]
        }
      },
      session
    });

    assert.equal(status, 200);
    // The empty-named entry and the null are dropped rather than stored.
    assert.equal(body.items.length, 1);
    assert.equal(body.items[0].name, 'Milk');
  });

  test('refuses a stale write instead of clobbering', async () => {
    const session = 'conflict';
    await call('/api/list/item', { method: 'POST', body: { productId: 'milk', name: 'Milk' }, session });

    const { status, body } = await call('/api/list', {
      method: 'PUT',
      body: { state: { items: [] }, expectedVersion: 999 },
      session
    });

    assert.equal(status, 409);
    assert.equal(body.ok, false);
  });

  test('DELETE clears the list', async () => {
    const session = 'clearme';
    await call('/api/command', { method: 'POST', body: { text: 'add milk and bread' }, session });

    const { status, body } = await call('/api/list', { method: 'DELETE', session });
    assert.equal(status, 200);
    assert.equal(body.items.length, 0);
  });
});

describe('discovery endpoints', () => {
  test('GET /api/search applies query parameters', async () => {
    const { body } = await call('/api/search?q=toothpaste%20under%20200%20rupees');

    assert.equal(body.ok, true);
    assert.equal(body.total, 1);
    assert.equal(body.results[0].id, 'toothpaste');
    assert.ok(body.results[0].priceFormatted.startsWith('₹'));
  });

  test('GET /api/search honours explicit filters', async () => {
    // Explicit filter values are in the catalog's base currency, rupees.
    const { body } = await call('/api/search?q=milk&max=100');
    assert.ok(body.results.length > 0);
    assert.ok(body.results.every((result) => result.salePrice <= 100));
  });

  test('POST /api/search parses a spoken phrase', async () => {
    const { body } = await call('/api/search', {
      method: 'POST',
      body: { text: 'find me organic apples', lang: 'en' }
    });

    assert.equal(body.total, 1);
    assert.equal(body.results[0].id, 'apple');
  });

  test('suggestions reflect the session list', async () => {
    const session = 'sugg';
    await call('/api/command', { method: 'POST', body: { text: 'add pasta' }, session });

    const { body } = await call('/api/suggestions', { session });

    assert.equal(body.ok, true);
    assert.ok(body.suggestions.length > 0);
    assert.ok(body.suggestions.some((entry) => entry.reason === 'pairsWith'));
    // Nothing already on the list should be suggested back.
    assert.ok(!body.suggestions.some((entry) => entry.id === 'pasta'));
  });

  test('seasonal accepts a month override', async () => {
    const { body } = await call('/api/seasonal?month=12&limit=5');
    assert.ok(body.seasonal.length > 0);
    assert.ok(body.seasonal.length <= 5);
  });

  test('substitutes returns ranked alternatives', async () => {
    const { status, body } = await call('/api/substitutes/milk');

    assert.equal(status, 200);
    assert.equal(body.options[0].id, 'almond_milk');
    assert.ok(body.options[0].priceFormatted);
  });

  test('substitutes 404s for an unknown product', async () => {
    const { status } = await call('/api/substitutes/not-a-product');
    assert.equal(status, 404);
  });

  test('catalog exposes products, categories and languages', async () => {
    const { body } = await call('/api/catalog');

    assert.ok(body.products.length > 100);
    assert.ok(body.categories.length > 10);
    assert.equal(body.languages.length, 4);
  });
});

describe('static files and routing', () => {
  test('the root redirects to the app', async () => {
    const response = await fetch(`${BASE}/`, { redirect: 'manual' });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/web/');
  });

  test('serves the app and its modules', async () => {
    const page = await fetch(`${BASE}/web/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);

    const module = await fetch(`${BASE}/shared/nlp/index.js`);
    assert.equal(module.status, 200);
    assert.match(module.headers.get('content-type'), /javascript/);
  });

  test('honours a conditional request', async () => {
    const first = await fetch(`${BASE}/web/styles/app.css`);
    const etag = first.headers.get('etag');
    assert.ok(etag);

    const second = await fetch(`${BASE}/web/styles/app.css`, { headers: { 'if-none-match': etag } });
    assert.equal(second.status, 304);
  });

  test('refuses to serve outside the public directories', async () => {
    // Server source and the data file must not be reachable over HTTP.
    assert.equal((await fetch(`${BASE}/server/store.js`)).status, 404);
    assert.equal((await fetch(`${BASE}/package.json`)).status, 404);
    assert.equal((await fetch(`${BASE}/web/../server/index.js`)).status, 404);
    assert.equal((await fetch(`${BASE}/web/..%2f..%2fpackage.json`)).status, 404);
  });

  test('unknown API routes 404 rather than falling through to static', async () => {
    const { status, body } = await call('/api/nope');
    assert.equal(status, 404);
    assert.equal(body.ok, false);
  });

  test('rejects a non-GET request for a static path', async () => {
    const response = await fetch(`${BASE}/web/`, { method: 'POST' });
    assert.equal(response.status, 405);
  });

  test('answers a CORS preflight', async () => {
    const response = await fetch(`${BASE}/api/list`, { method: 'OPTIONS' });
    assert.equal(response.status, 204);
    assert.ok(response.headers.get('access-control-allow-methods').includes('POST'));
  });
});

describe('persistence', () => {
  test('a list survives across requests', async () => {
    const session = 'persist';
    await call('/api/command', { method: 'POST', body: { text: 'add 4 bananas' }, session });

    const { body } = await call('/api/list', { session });
    assert.equal(body.items[0].productId, 'banana');
    assert.equal(body.items[0].quantity, 4);
  });
});
