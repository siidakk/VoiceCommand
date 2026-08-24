/**
 * A very small HTTP router and the request/response helpers the API handlers
 * share.
 *
 * Express would be one line of config, but the submission guidelines ask for
 * minimal dependencies, and routing a handful of endpoints is genuinely a
 * dozen lines of native code. Supports `:param` segments, which is all the API
 * surface needs.
 */

/** Maximum accepted request body. Guards against a client streaming forever. */
const MAX_BODY_BYTES = 256 * 1024;

export class Router {
  constructor() {
    /** @type {{ method: string, segments: string[], handler: Function }[]} */
    this.routes = [];
  }

  /** Register a route. `path` may contain :params. */
  add(method, path, handler) {
    this.routes.push({
      method: method.toUpperCase(),
      segments: path.split('/').filter(Boolean),
      handler
    });
    return this;
  }

  get(path, handler) {
    return this.add('GET', path, handler);
  }

  post(path, handler) {
    return this.add('POST', path, handler);
  }

  put(path, handler) {
    return this.add('PUT', path, handler);
  }

  delete(path, handler) {
    return this.add('DELETE', path, handler);
  }

  /**
   * Find a handler for a request.
   * @returns {{ handler: Function, params: object } | null}
   */
  match(method, pathname) {
    const parts = pathname.split('/').filter(Boolean);

    for (const route of this.routes) {
      if (route.method !== method.toUpperCase()) continue;
      if (route.segments.length !== parts.length) continue;

      const params = {};
      let matched = true;

      for (let i = 0; i < route.segments.length; i += 1) {
        const segment = route.segments[i];
        if (segment.startsWith(':')) {
          params[segment.slice(1)] = decodeURIComponent(parts[i]);
        } else if (segment !== parts[i]) {
          matched = false;
          break;
        }
      }

      if (matched) return { handler: route.handler, params };
    }

    return null;
  }
}

/** Send a JSON response. */
export function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store'
  });
  res.end(body);
}

/**
 * Send an error in the shape the client expects.
 *
 * `ok: false` is applied *after* `extra` on purpose: callers pass whole
 * payloads as extra (a 409 includes the current list so the client can merge),
 * and those payloads carry their own `ok: true`, which would otherwise
 * overwrite the error flag and make a failure look like a success.
 */
export function sendError(res, status, message, extra = {}) {
  sendJson(res, status, { error: message, ...extra, ok: false });
}

/**
 * Read and parse a JSON request body.
 *
 * Rejects oversized bodies as they stream rather than after buffering, so a
 * hostile client cannot exhaust memory before the size check runs.
 *
 * @returns {Promise<object>} parsed body, or {} for an empty one
 * @throws {Error} with `.status` set for a bad or oversized body
 */
export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;

    const fail = (status, message) => {
      if (settled) return;
      settled = true;
      const error = new Error(message);
      error.status = status;
      req.destroy();
      reject(error);
    };

    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        fail(413, 'Request body too large');
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (settled) return;
      settled = true;

      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }

      try {
        const parsed = JSON.parse(raw);
        resolve(parsed && typeof parsed === 'object' ? parsed : {});
      } catch {
        const error = new Error('Invalid JSON body');
        error.status = 400;
        reject(error);
      }
    });

    req.on('error', (error) => fail(400, error.message));
  });
}

/**
 * Session identity.
 *
 * The client generates an id and stores it locally; there are no accounts in
 * this project, so this identifies a browser, not a person. Untrusted input,
 * therefore constrained to a safe character set and length before it is ever
 * used as a map key.
 */
export function sessionIdFrom(req, url) {
  const raw = req.headers['x-session-id'] || url.searchParams.get('session') || '';
  const cleaned = String(raw).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  return cleaned || 'default';
}

/** Language from header or query, validated by the caller's i18n resolver. */
export function langFrom(req, url) {
  return String(req.headers['x-lang'] || url.searchParams.get('lang') || 'en').slice(0, 16);
}
