/**
 * Read-only endpoints: search, suggestions, substitutes, catalog metadata.
 *
 *   GET  /api/search?q=&max=&min=&brand=&tags=   structured search
 *   POST /api/search    { text, lang }           voice search: parse then run
 *   GET  /api/suggestions                        ranked smart suggestions
 *   GET  /api/seasonal                           in-season and on-sale picks
 *   GET  /api/substitutes/:id                    alternatives for a product
 *   GET  /api/catalog                            catalog metadata for the UI
 *   GET  /api/health                             liveness + diagnostics
 */

import { sendJson, sendError, readJsonBody, sessionIdFrom, langFrom } from '../router.js';
import * as store from '../store.js';
import { search as runSearch, byCategory } from '../../shared/engine/search.js';
import { suggest, alternatives, seasonal, previouslyBought } from '../../shared/engine/recommender.js';
import { parseFilters } from '../../shared/nlp/filters.js';
import { parse } from '../../shared/nlp/index.js';
import { normalize } from '../../shared/nlp/normalize.js';
import { digitizeNumbers } from '../../shared/nlp/numbers.js';
import { INDEX_SIZE } from '../../shared/nlp/matcher.js';
import { RULE_COUNTS } from '../../shared/nlp/grammar.js';
import { CATALOG, ALL_BRANDS, ALL_TAGS, getProduct } from '../../shared/data/catalog.js';
import { CATEGORIES } from '../../shared/data/categories.js';
import { LANGUAGES, resolveLang, formatCurrency } from '../../shared/i18n/index.js';

/** Attach a formatted price string to anything carrying a base-currency amount. */
function withPrices(rows, lang) {
  return rows.map((row) => ({
    ...row,
    priceFormatted: row.price === undefined || row.price === null ? null : formatCurrency(row.price, lang),
    salePriceFormatted:
      row.salePrice === undefined || row.salePrice === null ? null : formatCurrency(row.salePrice, lang)
  }));
}

export async function getSearch(req, res, { url }) {
  const lang = resolveLang(langFrom(req, url));
  const q = url.searchParams.get('q') || '';

  // Either a free-text query that still needs qualifier parsing, or explicit
  // structured parameters from the UI's filter controls.
  const filters = q
    ? parseFilters(digitizeNumbers(normalize(q), lang), lang)
    : {
        query: '',
        minPrice: null,
        maxPrice: null,
        currency: null,
        brand: null,
        tags: [],
        size: null,
        applied: []
      };

  const min = url.searchParams.get('min');
  const max = url.searchParams.get('max');
  const brand = url.searchParams.get('brand');
  const tags = url.searchParams.get('tags');
  const category = url.searchParams.get('category');

  if (min !== null && min !== '') filters.minPrice = Number(min);
  if (max !== null && max !== '') filters.maxPrice = Number(max);
  if (brand) filters.brand = brand;
  if (tags) filters.tags = tags.split(',').map((t) => t.trim()).filter(Boolean);
  if (category) filters.query = filters.query || category;

  const limit = Math.min(Number(url.searchParams.get('limit')) || 12, 50);
  const outcome = runSearch(filters, { lang, limit });

  sendJson(res, 200, { ok: true, ...outcome, results: withPrices(outcome.results, lang), filters });
}

export async function postSearch(req, res, { url }) {
  const body = await readJsonBody(req);
  const lang = resolveLang(body.lang || langFrom(req, url));
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 500) : '';

  if (!text) {
    sendError(res, 400, 'A search needs some text');
    return;
  }

  // Run the full pipeline so "find toothpaste under five dollars" works
  // exactly as it does by voice, spelled-out number and all.
  const parsed = parse(text, { lang });
  const command = parsed.commands.find((c) => c.filters) || null;

  const filters =
    command?.filters || parseFilters(digitizeNumbers(normalize(text), parsed.lang), parsed.lang);

  const limit = Math.min(Number(body.limit) || 12, 50);
  const outcome = runSearch(filters, { lang: parsed.lang, limit });

  sendJson(res, 200, {
    ok: true,
    heard: text,
    lang: parsed.lang,
    ...outcome,
    results: withPrices(outcome.results, parsed.lang),
    filters
  });
}

export async function getSuggestions(req, res, { url }) {
  const sessionId = sessionIdFrom(req, url);
  const lang = resolveLang(langFrom(req, url));
  const state = store.getState(sessionId);

  const limit = Math.min(Number(url.searchParams.get('limit')) || 8, 30);
  const monthParam = Number(url.searchParams.get('month'));
  const month = Number.isInteger(monthParam) && monthParam >= 1 && monthParam <= 12 ? monthParam : undefined;

  sendJson(res, 200, {
    ok: true,
    suggestions: withPrices(suggest(state, { limit, month }), lang),
    seasonal: withPrices(seasonal({ limit: 6, month }), lang),
    history: withPrices(previouslyBought(state, 8), lang)
  });
}

export async function getSeasonal(req, res, { url }) {
  const lang = resolveLang(langFrom(req, url));
  const monthParam = Number(url.searchParams.get('month'));
  const month = Number.isInteger(monthParam) && monthParam >= 1 && monthParam <= 12 ? monthParam : undefined;

  sendJson(res, 200, {
    ok: true,
    seasonal: withPrices(seasonal({ limit: Math.min(Number(url.searchParams.get('limit')) || 8, 30), month }), lang)
  });
}

export async function getSubstitutes(req, res, { url, params }) {
  const lang = resolveLang(langFrom(req, url));

  if (!getProduct(params.id)) {
    sendError(res, 404, 'No such product');
    return;
  }

  sendJson(res, 200, {
    ok: true,
    of: params.id,
    options: withPrices(alternatives(params.id, { limit: 4 }), lang)
  });
}

export async function getCatalog(req, res, { url }) {
  const lang = resolveLang(langFrom(req, url));
  const category = url.searchParams.get('category');

  if (category) {
    sendJson(res, 200, { ok: true, category, products: withPrices(byCategory(category), lang) });
    return;
  }

  // The full catalog is sent trimmed: the client only needs enough to render
  // chips and offline-match names, not every field.
  sendJson(res, 200, {
    ok: true,
    categories: CATEGORIES,
    languages: LANGUAGES,
    brands: ALL_BRANDS,
    tags: ALL_TAGS,
    products: CATALOG.map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      unit: product.unit,
      price: product.price,
      priceFormatted: formatCurrency(product.price, lang)
    }))
  });
}

export async function getHealth(req, res) {
  sendJson(res, 200, {
    ok: true,
    status: 'healthy',
    uptimeSeconds: Math.round(process.uptime()),
    node: process.version,
    persistent: store.isPersistent(),
    sessions: store.sessionCount(),
    catalog: { products: CATALOG.length, brands: ALL_BRANDS.length, tags: ALL_TAGS.length },
    nlp: { matcherIndex: INDEX_SIZE, grammarRules: RULE_COUNTS },
    languages: LANGUAGES.map((l) => l.code)
  });
}
