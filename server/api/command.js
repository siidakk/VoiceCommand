/**
 * Voice/text command endpoint.
 *
 *   POST /api/command   { text, lang }  ->  parsed intent, new list, spoken reply
 *
 * This is the server-side twin of what the browser does locally. Keeping both
 * paths on the same shared/ modules is what guarantees an offline command and
 * an online one produce the same result — the endpoint adds persistence and
 * nothing else.
 *
 *   POST /api/parse     { text, lang }  ->  parse only, no state change
 *
 * The parse-only route exists for the debug panel and the test suite; it makes
 * the NLP inspectable without side effects.
 */

import { sendJson, sendError, readJsonBody, sessionIdFrom, langFrom } from '../router.js';
import * as store from '../store.js';
import { parse } from '../../shared/nlp/index.js';
import { applyAll } from '../../shared/engine/executor.js';
import { resolveLang } from '../../shared/i18n/index.js';
import { listPayload } from './list.js';

/** Longest utterance we will parse. Recognisers never produce more than this. */
const MAX_TEXT = 500;

function readText(body) {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) {
    const error = new Error('A command needs some text');
    error.status = 400;
    throw error;
  }
  return text.slice(0, MAX_TEXT);
}

export async function postCommand(req, res, { url }) {
  const sessionId = sessionIdFrom(req, url);
  const body = await readJsonBody(req);

  let text;
  try {
    text = readText(body);
  } catch (error) {
    sendError(res, 400, error.message);
    return;
  }

  const lang = resolveLang(body.lang || langFrom(req, url));
  const confidence = Number.isFinite(body.confidence) ? body.confidence : 1;

  const parsed = parse(text, { lang, confidence });
  const before = store.getState(sessionId);
  const { state, responses } = applyAll(before, parsed, { lang });

  // Only touch the store when something actually changed — a search or a
  // "what's on my list" should not bump the version or trigger a disk write.
  const changed = state !== before;
  if (changed) store.setState(sessionId, state);

  sendJson(res, 200, {
    ok: responses.every((r) => r.ok),
    heard: text,
    lang: parsed.lang,
    confidence,
    commands: parsed.commands.map((command) => ({
      intent: command.intent,
      implied: command.implied,
      items: command.items.map((item) => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        confident: item.confident,
        score: item.score,
        alternatives: item.alternatives
      })),
      filters: command.filters
    })),
    responses,
    changed,
    list: listPayload(state, lang)
  });
}

export async function postParse(req, res, { url }) {
  const body = await readJsonBody(req);

  let text;
  try {
    text = readText(body);
  } catch (error) {
    sendError(res, 400, error.message);
    return;
  }

  const lang = resolveLang(body.lang || langFrom(req, url));
  sendJson(res, 200, { ok: true, ...parse(text, { lang }) });
}
