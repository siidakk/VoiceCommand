/**
 * Voice-activated catalog search.
 *
 * Consumes the structured filters produced by nlp/filters.js and returns
 * ranked products. Handles the assignment's "find toothpaste under $5" and
 * "find me organic apples" alongside brand and pack-size refinements.
 *
 * Spoken prices are converted into the catalog's rupee base before comparison,
 * so "under 500 rupees" and "under 5 dollars" are both meaningful and neither
 * silently compares rupees against dollars.
 */

import { CATALOG } from '../data/catalog.js';
import { matchProducts } from '../nlp/matcher.js';
import { normalize } from '../nlp/normalize.js';
import { isOnSale, discountFor, salePrice, isAvailable } from '../data/seasonal.js';
import { toBaseCurrency, currencyFor } from '../i18n/index.js';
import { alternatives } from './recommender.js';

/** A product's effective price — what the shopper would actually pay. */
function effectivePrice(product) {
  return salePrice(product.id);
}

/** Does this product carry every requested tag? */
function hasTags(product, tags) {
  if (!tags.length) return false;
  const owned = product.tags.map((t) => normalize(t));
  return tags.every((tag) => owned.includes(normalize(tag)));
}

/** Does the product list a matching brand? */
function hasBrand(product, brand) {
  const wanted = normalize(brand);
  return product.brands.some((b) => {
    const candidate = normalize(b);
    return candidate === wanted || candidate.includes(wanted) || wanted.includes(candidate);
  });
}

/** Does the product come in something close to the requested size? */
function hasSize(product, size) {
  const wanted = normalize(size).replace(/\s+/g, '');
  return product.sizes.some((s) => normalize(s).replace(/\s+/g, '') === wanted);
}

/**
 * Run a search.
 *
 * @param {object} filters  output of nlp/filters.js parseFilters
 * @param {object} [options]
 * @param {string} [options.lang='en']  used to interpret an unqualified price
 * @param {number} [options.limit=12]
 * @param {boolean} [options.includeUnavailable=true] keep out-of-stock hits so
 *        the UI can offer substitutes rather than pretending nothing matched
 * @returns {{
 *   results: object[], total: number, appliedFilters: string[],
 *   priceRange: { min: number|null, max: number|null }  in base currency
 * }}
 */
export function search(filters, options = {}) {
  const { lang = 'en', limit = 12, includeUnavailable = true } = options;
  const {
    query = '',
    minPrice = null,
    maxPrice = null,
    currency = null,
    brand = null,
    tags = [],
    size = null,
    applied = []
  } = filters || {};

  // A spoken amount with no currency word is in the user's own currency.
  const spokenCurrency = currency || currencyFor(lang);
  const minBase = minPrice === null ? null : toBaseCurrency(minPrice, lang, spokenCurrency);
  const maxBase = maxPrice === null ? null : toBaseCurrency(maxPrice, lang, spokenCurrency);

  // ---------------------------------------------------------- candidates ---
  /** product id -> best relevance seen */
  const pool = new Map();
  const consider = (product, relevance) => {
    const existing = pool.get(product.id);
    if (!existing || relevance > existing.relevance) pool.set(product.id, { product, relevance });
  };

  if (query) {
    // Slightly looser than the add-to-list path — browsing wants recall,
    // adding wants precision — but not so loose that a category word like
    // "dairy" fuzzy-matches half the catalog.
    for (const { product, score } of matchProducts(query, {
      lang,
      limit: CATALOG.length,
      threshold: 0.55
    })) {
      consider(product, score);
    }

    // A query naming a category or an attribute ("show me dairy", "find me
    // frozen") matches no product name at all, so those are searched directly
    // rather than left to fuzzy resemblance.
    const key = normalize(query);
    for (const product of CATALOG) {
      if (normalize(product.category).includes(key)) consider(product, 0.85);
      else if (product.tags.some((tag) => normalize(tag) === key)) consider(product, 0.8);
    }
  } else {
    for (const product of CATALOG) consider(product, 0.3);
  }

  const candidates = [...pool.values()];

  // ------------------------------------------------------------- filters ---
  const applyFilters = (activeTags) => {
    const matched = [];

    for (const { product, relevance } of candidates) {
      if (brand && !hasBrand(product, brand)) continue;
      if (activeTags.length && !hasTags(product, activeTags)) continue;
      if (size && !hasSize(product, size)) continue;

      const price = effectivePrice(product);
      if (minBase !== null && price < minBase) continue;
      if (maxBase !== null && price > maxBase) continue;

      const available = isAvailable(product.id);
      if (!available && !includeUnavailable) continue;

      // Relevance dominates, with a nudge toward things the shopper can
      // actually buy today and a small bonus for an active discount.
      let score = relevance * 100;
      if (!available) score -= 25;
      if (isOnSale(product.id)) score += 4;
      if (brand) score += 5;

      matched.push({
        id: product.id,
        name: product.name,
        category: product.category,
        unit: product.unit,
        price: product.price,
        salePrice: price,
        discount: discountFor(product.id),
        onSale: isOnSale(product.id),
        available,
        brands: product.brands,
        sizes: product.sizes,
        tags: product.tags,
        relevance: Number(relevance.toFixed(3)),
        score,
        // Only compute substitutes where they are actually needed.
        substitutes: available ? [] : alternatives(product.id, { limit: 2 })
      });
    }

    return matched;
  };

  let results = applyFilters(tags);
  let relaxed = [];

  // "gluten free bread" when nothing is tagged gluten-free: returning the
  // bread and saying the attribute was dropped is more useful than an empty
  // screen, provided the UI says so — hence `relaxedFilters` in the response.
  if (!results.length && tags.length) {
    const fallback = applyFilters([]);
    if (fallback.length) {
      results = fallback;
      relaxed = ['tags'];
    }
  }

  results.sort((a, b) => b.score - a.score || a.salePrice - b.salePrice);

  return {
    results: results.slice(0, limit).map(({ score, ...rest }) => rest),
    total: results.length,
    appliedFilters: applied.filter((f) => !(relaxed.includes('tags') && f === 'tags')),
    relaxedFilters: relaxed,
    requestedTags: tags,
    priceRange: {
      min: minBase === null ? null : Math.round(minBase),
      max: maxBase === null ? null : Math.round(maxBase)
    }
  };
}

/**
 * Products in a category, for the browse-by-aisle view.
 */
export function byCategory(categoryId, limit = 50) {
  return CATALOG.filter((product) => product.category === categoryId)
    .slice(0, limit)
    .map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      salePrice: salePrice(product.id),
      discount: discountFor(product.id),
      available: isAvailable(product.id)
    }));
}
