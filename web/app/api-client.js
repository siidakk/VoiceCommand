/**
 * Server API client.
 *
 * The server is optional. When it is reachable the list syncs across devices;
 * when it is not — static hosting, a dropped connection, a cold-starting free
 * tier — the app runs every command locally against the same shared/ modules
 * and keeps working. This module's job is to make that distinction cheap to
 * detect and never to hang the UI while finding out.
 *
 * Every request is time-boxed with AbortController: a request that never
 * resolves would leave the mic button stuck in "processing", which is a worse
 * failure than simply working offline.
 */

const DEFAULT_TIMEOUT_MS = 6000;

/** A slow first request is normal on a cold-starting free host. */
const PROBE_TIMEOUT_MS = 3500;

const SESSION_KEY = 'vcsa.sessionId';

/** Stable per-browser id so a list survives a reload. */
export function getSessionId() {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        globalThis.crypto?.randomUUID?.() ||
        `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // Private mode with storage disabled: fall back to a per-tab id.
    return `ephemeral_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export class ApiClient {
  /**
   * @param {object} [options]
   * @param {string} [options.baseUrl='']  same origin by default
   */
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl ?? '').replace(/\/$/, '');
    this.sessionId = getSessionId();
    this.lang = 'en';

    /** null until probed, then true/false. */
    this.online = null;
  }

  setLanguage(lang) {
    this.lang = lang;
  }

  /** Perform a request, translating failures into a uniform shape. */
  async request(path, options = {}) {
    const { method = 'GET', body = null, timeout = DEFAULT_TIMEOUT_MS } = options;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          accept: 'application/json',
          'x-session-id': this.sessionId,
          'x-lang': this.lang,
          ...(body ? { 'content-type': 'application/json' } : {})
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      const text = await response.text();
      let payload = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        // A non-JSON body from a proxy or error page.
        payload = { ok: false, error: text.slice(0, 200) };
      }

      if (!response.ok) {
        // A 4xx means the server is up and rejected us — still "online".
        this.online = true;
        throw new ApiError(payload?.error || `Request failed (${response.status})`, response.status, payload);
      }

      this.online = true;
      return payload;
    } catch (error) {
      if (error instanceof ApiError) throw error;

      // AbortError, TypeError (DNS/CORS/offline) — the server is unreachable.
      this.online = false;
      throw new ApiError(
        error.name === 'AbortError' ? 'Request timed out' : 'Server unreachable',
        0,
        null
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Is there a server behind this page?
   * Never throws — the answer is the return value, not an exception.
   */
  async probe() {
    try {
      const health = await this.request('/api/health', { timeout: PROBE_TIMEOUT_MS });
      this.online = true;
      return { online: true, health };
    } catch {
      this.online = false;
      return { online: false, health: null };
    }
  }

  // ----------------------------------------------------------------- list --

  getList() {
    return this.request('/api/list');
  }

  putList(state, expectedVersion) {
    return this.request('/api/list', {
      method: 'PUT',
      body: { state, expectedVersion }
    });
  }

  clearList() {
    return this.request('/api/list', { method: 'DELETE' });
  }

  addItem(item) {
    return this.request('/api/list/item', { method: 'POST', body: item });
  }

  updateItem(id, patch) {
    return this.request(`/api/list/item/${encodeURIComponent(id)}`, { method: 'PUT', body: patch });
  }

  deleteItem(id) {
    return this.request(`/api/list/item/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  // -------------------------------------------------------------- command --

  command(text, lang, confidence) {
    return this.request('/api/command', {
      method: 'POST',
      body: { text, lang, confidence }
    });
  }

  // ------------------------------------------------------------ discovery --

  suggestions() {
    return this.request('/api/suggestions');
  }

  search(text) {
    return this.request('/api/search', { method: 'POST', body: { text, lang: this.lang } });
  }

  substitutes(productId) {
    return this.request(`/api/substitutes/${encodeURIComponent(productId)}`);
  }
}
