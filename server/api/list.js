/**
 * List endpoints.
 *
 *   GET    /api/list          read the current list
 *   PUT    /api/list          replace it (client push after an offline edit)
 *   DELETE /api/list          clear it
 *   POST   /api/list/item     add one item directly (used by suggestion chips)
 *   PATCH-ish routes are deliberately absent: voice edits go through
 *   /api/command so parsing lives in exactly one place.
 */

import { sendJson, sendError, readJsonBody, sessionIdFrom, langFrom } from '../router.js';
import * as store from '../store.js';
import * as list from '../../shared/engine/list-manager.js';
import { resolveLang, formatCurrency } from '../../shared/i18n/index.js';
import { categorize } from '../../shared/engine/categorizer.js';

/** Shape a state into the payload the client renders. */
export function listPayload(state, lang) {
  const totals = list.totals(state);

  return {
    ok: true,
    version: state.version,
    updatedAt: state.updatedAt,
    items: list.sortedByAisle(state),
    groups: list.groupByCategory(state),
    totals: {
      ...totals,
      estimatedFormatted: formatCurrency(totals.estimatedUsd, lang)
    },
    historyCount: state.history.length
  };
}

export async function getList(req, res, { url }) {
  const sessionId = sessionIdFrom(req, url);
  const lang = resolveLang(langFrom(req, url));
  sendJson(res, 200, listPayload(store.getState(sessionId), lang));
}

export async function putList(req, res, { url }) {
  const sessionId = sessionIdFrom(req, url);
  const lang = resolveLang(langFrom(req, url));
  const body = await readJsonBody(req);

  // hydrate() validates every field, so a malformed or hostile payload cannot
  // corrupt the stored state — it is normalised into a valid list instead.
  const incoming = list.hydrate(body.state || body);
  const current = store.getState(sessionId);

  // Last-writer-wins, except that a stale push is refused so a tab left open
  // overnight cannot silently overwrite newer edits from another device.
  if (body.expectedVersion !== undefined && body.expectedVersion !== current.version) {
    sendError(res, 409, 'Version conflict', {
      currentVersion: current.version,
      ...listPayload(current, lang)
    });
    return;
  }

  const merged = { ...incoming, version: current.version + 1, updatedAt: new Date().toISOString() };
  store.setState(sessionId, merged);
  sendJson(res, 200, listPayload(merged, lang));
}

export async function deleteList(req, res, { url }) {
  const sessionId = sessionIdFrom(req, url);
  const lang = resolveLang(langFrom(req, url));

  const { state } = list.clearList(store.getState(sessionId));
  store.setState(sessionId, state);

  sendJson(res, 200, listPayload(state, lang));
}

export async function addListItem(req, res, { url }) {
  const sessionId = sessionIdFrom(req, url);
  const lang = resolveLang(langFrom(req, url));
  const body = await readJsonBody(req);

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const productId = typeof body.productId === 'string' ? body.productId : null;

  if (!name && !productId) {
    sendError(res, 400, 'An item needs a name or a productId');
    return;
  }

  const { state, item } = list.addItem(store.getState(sessionId), {
    productId,
    name,
    quantity: Number(body.quantity) || 1,
    unit: typeof body.unit === 'string' ? body.unit : undefined,
    category: typeof body.category === 'string' ? body.category : categorize(name, productId)
  });

  store.setState(sessionId, state);
  sendJson(res, 201, { ...listPayload(state, lang), item });
}

export async function updateListItem(req, res, { url, params }) {
  const sessionId = sessionIdFrom(req, url);
  const lang = resolveLang(langFrom(req, url));
  const body = await readJsonBody(req);

  const state = store.getState(sessionId);
  const target = state.items.find((item) => item.id === params.id);

  if (!target) {
    sendError(res, 404, 'No such item');
    return;
  }

  let next = state;

  if (body.quantity !== undefined) {
    ({ state: next } = list.updateQuantity(next, { productId: target.productId, name: target.name }, Number(body.quantity)));
  }

  if (body.bought !== undefined) {
    ({ state: next } = list.markBought(next, { productId: target.productId, name: target.name }, Boolean(body.bought)));
  }

  store.setState(sessionId, next);
  sendJson(res, 200, listPayload(next, lang));
}

export async function deleteListItem(req, res, { url, params }) {
  const sessionId = sessionIdFrom(req, url);
  const lang = resolveLang(langFrom(req, url));

  const state = store.getState(sessionId);
  const target = state.items.find((item) => item.id === params.id);

  if (!target) {
    sendError(res, 404, 'No such item');
    return;
  }

  const { state: next } = list.removeItem(state, { productId: target.productId, name: target.name });
  store.setState(sessionId, next);
  sendJson(res, 200, listPayload(next, lang));
}
