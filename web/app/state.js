/**
 * Client state.
 *
 * Holds the list, the undo stack, user settings and the latest panel data, and
 * is the single place that decides *where* a command runs:
 *
 *   server reachable  ->  POST /api/command, list comes back authoritative
 *   server absent     ->  parse + execute locally against the same shared/
 *                         modules the server would have used
 *
 * Because both paths call into shared/engine/executor.js, an offline command
 * and an online one produce the same list and the same spoken reply. Offline
 * is a degraded *deployment*, not a degraded *feature set* — the only thing
 * lost is cross-device sync.
 *
 * localStorage is written on every change regardless of mode, so a reload
 * never loses the list even if the server was down when it was built.
 */

import { parse } from '../../shared/nlp/index.js';
import { applyAll } from '../../shared/engine/executor.js';
import * as listManager from '../../shared/engine/list-manager.js';
import { suggest, seasonal, alternatives, previouslyBought } from '../../shared/engine/recommender.js';
import { search as searchCatalog } from '../../shared/engine/search.js';
import { parseFilters } from '../../shared/nlp/filters.js';
import { normalize } from '../../shared/nlp/normalize.js';
import { digitizeNumbers } from '../../shared/nlp/numbers.js';
import { resolveLang, speechTag, formatCurrency } from '../../shared/i18n/index.js';
import { getProduct } from '../../shared/data/catalog.js';

const STORAGE_KEY = 'vcsa.list';
const SETTINGS_KEY = 'vcsa.settings';

/** How many states the undo stack keeps. */
const UNDO_DEPTH = 20;

/** Read JSON from localStorage, tolerating absence and corruption. */
function readStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled — the app still works for this
    // session, so this is not worth interrupting the user over.
  }
}

export class Store {
  /** @param {import('./api-client.js').ApiClient} api */
  constructor(api) {
    this.api = api;

    const settings = readStored(SETTINGS_KEY, {});
    this.settings = {
      lang: resolveLang(settings.lang || navigator.language || 'en'),
      speakReplies: settings.speakReplies ?? true,
      continuous: settings.continuous ?? false
    };

    this.list = listManager.hydrate(readStored(STORAGE_KEY, null));

    /** Previous list states, newest last. */
    this.undoStack = [];

    /** Latest data for the side panels. */
    this.panels = {
      active: 'suggestions',
      suggestions: [],
      seasonal: [],
      history: [],
      search: null,
      substitutes: null
    };

    /** Transient UI state the renderer reads. */
    this.ui = {
      busy: false,
      syncing: false,
      lastResponses: [],
      lastHeard: '',
      lastConfidence: null,
      /** Item ids to flash on next render. */
      flash: new Set(),
      error: null
    };

    this.listeners = new Set();
  }

  // ------------------------------------------------------------ plumbing --

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this);
      } catch (error) {
        console.error('[store] subscriber threw:', error);
      }
    }
  }

  get lang() {
    return this.settings.lang;
  }

  get speechTag() {
    return speechTag(this.settings.lang);
  }

  /** Format a USD amount in the active language's currency. */
  money(usd) {
    return formatCurrency(usd, this.settings.lang);
  }

  /**
   * Line total for a list row, or null for a free-text item the catalog has
   * no price for. Returning null rather than 0 lets the row omit the price
   * entirely instead of claiming the item is free.
   */
  moneyForItem(item) {
    if (!item.productId) return null;
    const product = getProduct(item.productId);
    if (!product) return null;
    return this.money(product.price * item.quantity);
  }

  persist() {
    writeStored(STORAGE_KEY, this.list);
  }

  persistSettings() {
    writeStored(SETTINGS_KEY, this.settings);
  }

  // ------------------------------------------------------------ settings --

  setLanguage(lang) {
    this.settings.lang = resolveLang(lang);
    this.api.setLanguage(this.settings.lang);
    this.persistSettings();
    this.notify();
    // Suggestion copy is language-specific, so refresh it.
    this.refreshPanels();
  }

  setSpeakReplies(enabled) {
    this.settings.speakReplies = Boolean(enabled);
    this.persistSettings();
    this.notify();
  }

  setContinuous(enabled) {
    this.settings.continuous = Boolean(enabled);
    this.persistSettings();
    this.notify();
  }

  setActivePanel(name) {
    this.panels.active = name;
    this.notify();
  }

  setError(error) {
    this.ui.error = error;
    this.notify();
  }

  clearError() {
    if (!this.ui.error) return;
    this.ui.error = null;
    this.notify();
  }

  // ---------------------------------------------------------------- undo --

  pushUndo() {
    this.undoStack.push(this.list);
    if (this.undoStack.length > UNDO_DEPTH) this.undoStack.shift();
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  async undo() {
    const previous = this.undoStack.pop();
    if (!previous) return false;

    this.list = previous;
    this.persist();
    this.notify();

    await this.pushToServer();
    this.refreshPanels();
    return true;
  }

  // -------------------------------------------------------------- syncing --

  /**
   * Adopt a list payload returned by the server.
   * The server is authoritative when it is reachable, because another device
   * may have changed the list since this tab last looked.
   */
  adoptServerList(payload) {
    if (!payload || !Array.isArray(payload.items)) return;

    this.list = listManager.hydrate({
      items: payload.items,
      history: this.list.history,
      version: payload.version,
      updatedAt: payload.updatedAt
    });

    this.persist();
  }

  /** Push local state to the server, ignoring failure (we stay offline-capable). */
  async pushToServer() {
    if (this.api.online === false) return;

    this.ui.syncing = true;
    this.notify();

    try {
      const payload = await this.api.putList(this.list, undefined);
      this.adoptServerList(payload);
    } catch {
      // Offline: localStorage already holds the truth.
    } finally {
      this.ui.syncing = false;
      this.notify();
    }
  }

  /** Initial load: probe the server and adopt its list if it has one. */
  async bootstrap() {
    const { online } = await this.api.probe();

    if (online) {
      try {
        const payload = await this.api.getList();

        // A brand-new session on the server, but a list already in this
        // browser, means we should push rather than pull — otherwise a
        // returning user's list would be silently replaced by an empty one.
        if (!payload.items.length && this.list.items.length) {
          await this.pushToServer();
        } else {
          this.adoptServerList(payload);
        }
      } catch {
        // Fall through to whatever localStorage gave us.
      }
    }

    this.notify();
    this.refreshPanels();
    return online;
  }

  // ------------------------------------------------------------- commands --

  /**
   * Run a spoken or typed command.
   *
   * @param {string} text
   * @param {object} [options]
   * @param {number|null} [options.confidence]
   * @returns {Promise<object[]>} the responses produced
   */
  async dispatch(text, options = {}) {
    const phrase = String(text || '').trim();
    if (!phrase) return [];

    this.ui.busy = true;
    this.ui.lastHeard = phrase;
    this.ui.lastConfidence = options.confidence ?? null;
    this.ui.error = null;
    this.notify();

    try {
      const responses = this.api.online === false
        ? await this.dispatchLocal(phrase, options)
        : await this.dispatchRemote(phrase, options);

      this.ui.lastResponses = responses;
      return responses;
    } finally {
      this.ui.busy = false;
      this.notify();
      this.refreshPanels();
    }
  }

  /** Execute against the server. Falls back to local on any transport error. */
  async dispatchRemote(text, options) {
    try {
      const payload = await this.api.command(text, this.settings.lang, options.confidence ?? 1);

      if (payload.changed) this.pushUndo();
      this.adoptServerList(payload.list);
      this.markFlash(payload.responses);
      this.applyClientSideResponses(payload.responses);

      return payload.responses;
    } catch (error) {
      // Transport failure (status 0) means the server vanished mid-session;
      // silently continue offline rather than losing the command.
      if (error.status === 0) {
        this.api.online = false;
        this.notify();
        return this.dispatchLocal(text, options);
      }
      throw error;
    }
  }

  /** Execute entirely in the browser. */
  async dispatchLocal(text, options) {
    const parsed = parse(text, { lang: this.settings.lang, confidence: options.confidence ?? 1 });
    const before = this.list;
    const { state, responses } = applyAll(before, parsed, { lang: this.settings.lang });

    if (state !== before) {
      this.pushUndo();
      this.list = state;
      this.persist();
    }

    this.markFlash(responses);
    this.applyClientSideResponses(responses);
    return responses;
  }

  /**
   * Handle the parts of a response that only exist client-side: undo requests
   * and populating the search / substitutes panels.
   */
  applyClientSideResponses(responses) {
    for (const response of responses) {
      if (response.data?.undo) {
        // The executor cannot undo; it just reports that undo was asked for.
        this.undo();
        continue;
      }

      if (response.kind === 'search') {
        this.panels.search = response.data;
        this.panels.active = 'search';
      }

      if (response.kind === 'substitutes') {
        this.panels.substitutes = response.data;
        this.panels.active = 'suggestions';
      }
    }
  }

  /** Remember which rows changed so the renderer can flash them. */
  markFlash(responses) {
    this.ui.flash = new Set();

    for (const response of responses) {
      for (const item of response.data?.added || []) this.ui.flash.add(item.id);
      if (response.data?.item?.id) this.ui.flash.add(response.data.item.id);
    }
  }

  // ---------------------------------------------------------- direct edits --

  /** Add an item without going through the parser (suggestion chips). */
  async addProduct({ productId, name, quantity = 1, unit }) {
    this.pushUndo();

    const { state, item } = listManager.addItem(this.list, { productId, name, quantity, unit });
    this.list = state;
    this.persist();

    if (item) this.ui.flash = new Set([item.id]);
    this.notify();

    await this.pushToServer();
    this.refreshPanels();
    return item;
  }

  async setQuantity(itemId, quantity) {
    const target = this.list.items.find((item) => item.id === itemId);
    if (!target) return;

    this.pushUndo();
    const { state } = listManager.updateQuantity(
      this.list,
      { productId: target.productId, name: target.name },
      quantity
    );

    this.list = state;
    this.persist();
    this.notify();

    await this.pushToServer();
    this.refreshPanels();
  }

  async toggleBought(itemId) {
    const target = this.list.items.find((item) => item.id === itemId);
    if (!target) return;

    this.pushUndo();
    const { state } = listManager.toggleBought(this.list, {
      productId: target.productId,
      name: target.name
    });

    this.list = state;
    this.persist();
    this.notify();

    await this.pushToServer();
    this.refreshPanels();
  }

  async removeItem(itemId) {
    const target = this.list.items.find((item) => item.id === itemId);
    if (!target) return;

    this.pushUndo();
    const { state } = listManager.removeItem(this.list, {
      productId: target.productId,
      name: target.name
    });

    this.list = state;
    this.persist();
    this.notify();

    await this.pushToServer();
    this.refreshPanels();
  }

  async clearList() {
    this.pushUndo();
    const { state } = listManager.clearList(this.list);

    this.list = state;
    this.persist();
    this.notify();

    await this.pushToServer();
    this.refreshPanels();
  }

  // -------------------------------------------------------------- panels --

  /**
   * Recompute suggestion panels.
   *
   * Always computed locally even when online: the inputs (the list and its
   * history) are already here, so a network round trip would add latency
   * without adding information.
   */
  refreshPanels() {
    this.panels.suggestions = suggest(this.list, { limit: 8 });
    this.panels.seasonal = seasonal({ limit: 8 });
    this.panels.history = previouslyBought(this.list, 8);
    this.notify();
  }

  /** Run a search without speaking, used by the search box and chips. */
  runSearch(text) {
    const filters = parseFilters(
      digitizeNumbers(normalize(text), this.settings.lang),
      this.settings.lang
    );

    this.panels.search = {
      ...searchCatalog(filters, { lang: this.settings.lang }),
      query: filters.query,
      filters
    };
    this.panels.active = 'search';
    this.notify();
  }

  /** Load alternatives for a product into the suggestions panel. */
  showSubstitutes(productId, name) {
    this.panels.substitutes = {
      of: name,
      ofId: productId,
      options: alternatives(productId, { limit: 4 })
    };
    this.panels.active = 'suggestions';
    this.notify();
  }

  dismissSubstitutes() {
    this.panels.substitutes = null;
    this.notify();
  }

  // --------------------------------------------------------------- totals --

  get totals() {
    return listManager.totals(this.list);
  }

  get groups() {
    return listManager.groupByCategory(this.list);
  }
}
