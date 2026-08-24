/**
 * Command executor.
 *
 * The single place where a parsed intent becomes a state change and a spoken
 * reply. Both runtimes call this — the browser for offline/local mode, the
 * server for the shared list — so the assistant behaves identically whether or
 * not the network is up.
 *
 * Contract: pure. Takes a state, returns a new state plus a response; never
 * mutates its arguments and never touches storage. Persistence is the caller's
 * job, which is what makes the whole thing trivially testable.
 */

import { INTENTS } from '../nlp/index.js';
import { t } from '../i18n/index.js';
import { isAvailable } from '../data/seasonal.js';
import { localizedName } from '../data/catalog.js';
import { unitLabel } from '../nlp/units.js';
import * as list from './list-manager.js';
import { search } from './search.js';
import { suggest, alternatives, seasonal } from './recommender.js';

/** Response kinds the UI switches on. */
export const RESULT = {
  ADDED: 'added',
  REMOVED: 'removed',
  UPDATED: 'updated',
  MARKED: 'marked',
  CLEARED: 'cleared',
  LIST: 'list',
  SEARCH: 'search',
  SUGGESTIONS: 'suggestions',
  SUBSTITUTES: 'substitutes',
  HELP: 'help',
  NOT_FOUND: 'not_found',
  UNKNOWN: 'unknown',
  NOOP: 'noop'
};

/**
 * Name to speak for an item.
 *
 * A stored item always keeps its canonical English name so the list stays
 * stable when the user switches language; only the spoken and rendered form
 * is translated. Free-text items have no translation and pass through as-is.
 */
function spokenName(item, lang) {
  return item.productId ? localizedName(item.productId, lang) : item.name;
}

/** Build a response envelope. */
function reply(kind, speak, data = {}, ok = true) {
  return { ok, kind, speak, data };
}

/**
 * Apply one parsed command.
 *
 * @param {object} state    current list state
 * @param {object} command  one entry from parse().commands
 * @param {object} [options]
 * @param {string} [options.lang='en']
 * @param {Date}   [options.now]
 * @returns {{ state: object, response: object }}
 */
export function applyCommand(state, command, options = {}) {
  const lang = options.lang || 'en';
  const now = options.now || new Date();

  switch (command.intent) {
    case INTENTS.ADD:
      return doAdd(state, command, lang, now);
    case INTENTS.REMOVE:
      return doRemove(state, command, lang, now);
    case INTENTS.UPDATE_QTY:
      return doUpdate(state, command, lang, now);
    case INTENTS.MARK_BOUGHT:
      return doMarkBought(state, command, lang, now);
    case INTENTS.CLEAR:
      return doClear(state, lang, now);
    case INTENTS.READ_LIST:
      return doReadList(state, lang);
    case INTENTS.SEARCH:
      return doSearch(state, command, lang);
    case INTENTS.SUGGEST:
      return doSuggest(state, lang, now);
    case INTENTS.SUBSTITUTE:
      return doSubstitute(state, command, lang);
    case INTENTS.HELP:
      return { state, response: reply(RESULT.HELP, t(lang, 'say.help')) };
    case INTENTS.UNDO:
      // Undo is a client concern: it owns the snapshot stack, because the
      // server has no notion of "the previous thing this user saw".
      return { state, response: reply(RESULT.NOOP, '', { undo: true }) };
    default:
      return {
        state,
        response: reply(
          RESULT.UNKNOWN,
          t(lang, 'say.notUnderstood'),
          {
            text: command.text,
            // Even an unparsed utterance usually has near-misses worth showing.
            alternatives: command.items?.[0]?.alternatives || []
          },
          false
        )
      };
  }
}

function doAdd(state, command, lang, now) {
  if (!command.items.length) {
    return { state, response: reply(RESULT.UNKNOWN, t(lang, 'say.notUnderstood'), {}, false) };
  }

  let next = state;
  const added = [];
  const unconfident = [];
  const unavailable = [];

  for (const item of command.items) {
    const result = list.addItem(
      next,
      {
        productId: item.productId,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit
      },
      now
    );

    if (!result.item) continue;
    next = result.state;
    added.push({ ...result.item, merged: result.merged });

    // A shaky match is still added — losing the item would be worse — but the
    // near-misses ride along so the UI can offer a one-tap correction.
    if (!item.confident && item.alternatives.length) {
      unconfident.push({
        itemId: result.item.id,
        // What actually got added, so the UI does not offer the user a
        // "did you mean X?" correction for the X it just added.
        productId: item.productId,
        spoken: item.spoken,
        alternatives: item.alternatives
      });
    }

    if (item.productId && !isAvailable(item.productId)) {
      unavailable.push({
        itemId: result.item.id,
        itemProductId: item.productId,
        name: result.item.name,
        substitutes: alternatives(item.productId, { limit: 2 })
      });
    }
  }

  if (!added.length) {
    return { state, response: reply(RESULT.UNKNOWN, t(lang, 'say.notUnderstood'), {}, false) };
  }

  // Speak the single-item case precisely and the multi-item case briefly.
  let speak;
  if (added.length === 1) {
    const item = added[0];
    const showUnit = item.quantity > 1 || item.unit !== 'pcs';
    speak = showUnit
      ? t(lang, 'say.added', {
          qty: item.quantity,
          unit: unitLabel(item.unit, item.quantity, lang),
          item: spokenName(item, lang)
        })
      : t(lang, 'say.addedSimple', { item: spokenName(item, lang) });
  } else {
    speak = t(lang, 'say.addedSimple', {
      item: added.map((i) => spokenName(i, lang)).join(', ')
    });
  }

  // An out-of-stock item is the one case worth interrupting the confirmation for.
  if (unavailable.length === 1 && unavailable[0].substitutes.length) {
    speak = `${speak}. ${t(lang, 'say.outOfStock', {
      item: localizedName(unavailable[0].itemProductId, lang) || unavailable[0].name,
      alt: localizedName(unavailable[0].substitutes[0].id, lang)
    })}`;
  }

  return {
    state: next,
    response: reply(RESULT.ADDED, speak, { added, unconfident, unavailable })
  };
}

function doRemove(state, command, lang, now) {
  if (!command.items.length) {
    return { state, response: reply(RESULT.UNKNOWN, t(lang, 'say.notUnderstood'), {}, false) };
  }

  let next = state;
  const removed = [];
  const missing = [];

  for (const item of command.items) {
    const result = list.removeItem(next, { productId: item.productId, name: item.name }, now);
    if (result.removed) {
      next = result.state;
      removed.push(result.removed);
    } else {
      missing.push(item.name);
    }
  }

  if (!removed.length) {
    return {
      state,
      response: reply(
        RESULT.NOT_FOUND,
        t(lang, 'say.notFound', { item: missing.join(', ') }),
        { missing },
        false
      )
    };
  }

  return {
    state: next,
    response: reply(
      RESULT.REMOVED,
      t(lang, 'say.removed', { item: removed.map((i) => spokenName(i, lang)).join(', ') }),
      { removed, missing }
    )
  };
}

function doUpdate(state, command, lang, now) {
  const [item] = command.items;
  if (!item) {
    return { state, response: reply(RESULT.UNKNOWN, t(lang, 'say.notUnderstood'), {}, false) };
  }

  const quantity = command.quantity ?? item.quantity;
  const result = list.updateQuantity(state, { productId: item.productId, name: item.name }, quantity, now);

  if (!result.item) {
    return {
      state,
      response: reply(RESULT.NOT_FOUND, t(lang, 'say.notFound', { item: item.name }), { missing: [item.name] }, false)
    };
  }

  if (result.removed) {
    return {
      state: result.state,
      response: reply(RESULT.REMOVED, t(lang, 'say.removed', { item: spokenName(result.item, lang) }), {
        removed: [result.item]
      })
    };
  }

  return {
    state: result.state,
    response: reply(
      RESULT.UPDATED,
      t(lang, 'say.updated', { item: spokenName(result.item, lang), qty: quantity }),
      { item: result.item }
    )
  };
}

function doMarkBought(state, command, lang, now) {
  const [item] = command.items;
  if (!item) {
    return { state, response: reply(RESULT.UNKNOWN, t(lang, 'say.notUnderstood'), {}, false) };
  }

  const result = list.markBought(state, { productId: item.productId, name: item.name }, true, now);

  if (!result.item) {
    return {
      state,
      response: reply(RESULT.NOT_FOUND, t(lang, 'say.notFound', { item: item.name }), { missing: [item.name] }, false)
    };
  }

  return {
    state: result.state,
    response: reply(RESULT.MARKED, t(lang, 'say.marked', { item: spokenName(result.item, lang) }), {
      item: result.item
    })
  };
}

function doClear(state, lang, now) {
  const result = list.clearList(state, now);
  return {
    state: result.state,
    response: reply(RESULT.CLEARED, t(lang, 'say.cleared'), { cleared: result.cleared })
  };
}

/**
 * Read the list back.
 *
 * Speaks the actual items, not just a count. "You have 4 items" is useless to
 * someone shopping with the phone in their pocket, which is exactly the
 * voice-only case this has to serve — so the reply enumerates what is still to
 * be picked up, and stays quiet about what is already in the cart.
 */
function doReadList(state, lang) {
  const summary = list.totals(state);
  const groups = list.groupByCategory(state);

  if (!summary.total) {
    return {
      state,
      response: reply(RESULT.LIST, t(lang, 'say.listEmpty'), { groups, totals: summary })
    };
  }

  const outstanding = list.sortedByAisle(state).filter((item) => !item.bought);

  // "2 Milk" reads badly; "2 litres of Milk" is what a person would say.
  const spoken = outstanding.map((item) => {
    const name = spokenName(item, lang);
    if (item.quantity <= 1) return name;
    return `${item.quantity} ${unitLabel(item.unit, item.quantity, lang)} ${name}`.replace(/\s+/g, ' ');
  });

  // Announcing "3 items" and then naming two of them sounds like a bug. When
  // some are already in the cart, say the total and then what is left.
  let speak;
  if (!spoken.length) {
    speak = t(lang, 'say.listSummary', { count: summary.total });
  } else if (summary.bought) {
    speak = `${t(lang, 'say.listSummary', { count: summary.total })}. ${t(lang, 'say.listRemaining', {
      items: spoken.join(', ')
    })}`;
  } else {
    speak = t(lang, 'say.listReadout', { count: summary.total, items: spoken.join(', ') });
  }

  return {
    state,
    response: reply(RESULT.LIST, speak, { groups, totals: summary, outstanding: spoken })
  };
}

function doSearch(state, command, lang) {
  const filters = command.filters || {};
  const outcome = search(filters, { lang });
  const query = filters.query || '';

  const speak =
    outcome.total === 0
      ? t(lang, 'say.searchNone', { query })
      : outcome.total === 1
        ? t(lang, 'say.searchResultsOne', { query })
        : t(lang, 'say.searchResults', { count: outcome.total, query });

  return {
    state,
    response: reply(RESULT.SEARCH, speak, { ...outcome, query, filters }, outcome.total > 0)
  };
}

function doSuggest(state, lang, now) {
  const suggestions = suggest(state, { now, limit: 8 });
  const inSeason = seasonal({ now, limit: 6 });
  const lowStock = runningLow(state, lang, { now });

  // Lead with the repurchase prediction when there is one. It is the most
  // useful thing the assistant knows, and it is the behaviour the brief names
  // directly — "It looks like you're running low on bread".
  let speak;
  if (lowStock) {
    speak = lowStock.message;
    const rest = suggestions
      .filter((entry) => !lowStock.ids.includes(entry.id))
      .slice(0, 2)
      .map((entry) => localizedName(entry.id, lang));
    if (rest.length) speak = `${speak}. ${rest.join(', ')}`;
  } else if (suggestions.length) {
    speak = suggestions
      .slice(0, 3)
      .map((entry) => localizedName(entry.id, lang))
      .join(', ');
  } else {
    speak = t(lang, 'panel.noSuggestions');
  }

  return {
    state,
    response: reply(RESULT.SUGGESTIONS, speak, { suggestions, seasonal: inSeason, runningLow: lowStock })
  };
}

/**
 * The "running low" alert, or null.
 *
 * Split out from doSuggest because the UI shows it proactively rather than
 * waiting to be asked — a prediction the user has to request is not much of a
 * prediction.
 *
 * @returns {{ ids: string[], items: {id,name}[], message: string } | null}
 */
export function runningLow(state, lang = 'en', options = {}) {
  const due = suggest(state, { now: options.now, limit: 12 }).filter(
    (entry) => entry.reason === 'runningLow'
  );

  if (!due.length) return null;

  const items = due.map((entry) => ({ id: entry.id, name: localizedName(entry.id, lang) }));
  const [first] = items;

  const message =
    items.length === 1
      ? t(lang, 'alert.runningLow', { item: first.name })
      : t(lang, 'alert.runningLowMore', { item: first.name, count: items.length - 1 });

  return { ids: items.map((entry) => entry.id), items, message };
}

function doSubstitute(state, command, lang) {
  const [item] = command.items;
  if (!item || !item.productId) {
    return {
      state,
      response: reply(RESULT.NOT_FOUND, t(lang, 'say.notFound', { item: item ? item.name : '' }), {}, false)
    };
  }

  const options = alternatives(item.productId, { limit: 3 });

  const speak = options.length
    ? t(lang, 'say.substitute', {
        item: localizedName(item.productId, lang),
        alt: localizedName(options[0].id, lang)
      })
    : t(lang, 'say.searchNone', { query: item.name });

  return {
    state,
    response: reply(RESULT.SUBSTITUTES, speak, { of: item.name, ofId: item.productId, options }, options.length > 0)
  };
}

/**
 * Apply every command in a parsed utterance, threading state through.
 *
 * @returns {{ state, responses: object[] }}
 */
export function applyAll(state, parsed, options = {}) {
  let next = state;
  const responses = [];

  for (const command of parsed.commands) {
    const result = applyCommand(next, command, { ...options, lang: options.lang || parsed.lang });
    next = result.state;
    responses.push(result.response);
  }

  return { state: next, responses };
}
