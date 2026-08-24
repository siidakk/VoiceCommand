/**
 * Smart suggestions.
 *
 * Answers the assignment's "It looks like you're running low on bread" with
 * five ranked signals, strongest first:
 *
 *   1. runningLow        a repurchase is due, based on this household's own cadence
 *   2. frequentlyBought  bought repeatedly, not on the list right now
 *   3. pairsWith         usually bought alongside something already on the list
 *   4. inSeason / onSale calendar and promotion driven
 *   5. staple            cold-start fallback for a brand new user
 *
 * The repurchase interval is *learned* where there is enough history — the
 * median gap between this user's own purchases — and only falls back to the
 * catalog's generic `cycleDays` when there is not. That is the difference
 * between "bread is usually bought weekly" and "you buy bread every 4 days".
 */

import { getProduct } from '../data/catalog.js';
import { seasonalPicks, isOnSale, discountFor, salePrice, isAvailable, currentMonth } from '../data/seasonal.js';
import { substitutesFor } from '../data/substitutes.js';

/**
 * Cold-start pairings: products commonly bought together.
 * Used until the user's own history is rich enough to derive co-occurrence.
 */
const AFFINITY = {
  bread: ['butter', 'jam', 'eggs', 'cheese'],
  brown_bread: ['butter', 'peanut_butter', 'eggs'],
  milk: ['cereal', 'coffee', 'tea', 'bread'],
  cereal: ['milk', 'banana'],
  oats: ['milk', 'honey', 'banana'],
  coffee: ['milk', 'sugar', 'cookies'],
  tea: ['milk', 'sugar', 'cookies'],
  pasta: ['canned_tomatoes', 'cheese', 'olive_oil', 'garlic'],
  rice: ['lentils', 'onion', 'cooking_oil'],
  eggs: ['bread', 'butter', 'bacon'],
  chicken: ['onion', 'garlic', 'ginger', 'cooking_oil'],
  chicken_breast: ['bell_pepper', 'olive_oil', 'lettuce'],
  ground_beef: ['buns', 'cheese', 'ketchup', 'onion'],
  tortilla: ['cheese', 'canned_beans', 'hot_sauce'],
  frozen_pizza: ['cola', 'ice_cream'],
  chips: ['cola', 'hot_sauce'],
  lettuce: ['tomato', 'cucumber', 'olive_oil'],
  tomato: ['onion', 'garlic', 'cucumber'],
  potato: ['onion', 'cooking_oil'],
  banana: ['milk', 'oats'],
  diapers: ['baby_wipes', 'baby_food'],
  dog_food: ['pet_treats'],
  cat_food: ['cat_litter', 'pet_treats'],
  toothbrush: ['toothpaste'],
  shampoo: ['conditioner'],
  detergent: ['dish_soap'],
  paneer: ['onion', 'tomato', 'cream'],
  lentils: ['rice', 'turmeric', 'cumin']
};

/** Staples suggested to a user with no history at all. */
const COLD_START = ['milk', 'bread', 'eggs', 'bananas', 'rice', 'onion', 'tomato', 'cooking_oil'];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days between two ISO timestamps. */
function daysBetween(fromIso, toDate) {
  return (toDate.getTime() - new Date(fromIso).getTime()) / DAY_MS;
}

/** Median of a numeric array. */
function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Per-product purchase statistics derived from history.
 *
 * @returns {Map<string, { count, lastAt, intervals: number[], learned: number|null }>}
 */
export function purchaseStats(history) {
  const byProduct = new Map();

  for (const entry of history) {
    const key = entry.productId || `text:${entry.name.toLowerCase()}`;
    if (!byProduct.has(key)) {
      byProduct.set(key, { productId: entry.productId, name: entry.name, dates: [] });
    }
    byProduct.get(key).dates.push(new Date(entry.at).getTime());
  }

  const stats = new Map();

  for (const [key, record] of byProduct) {
    const dates = record.dates.sort((a, b) => a - b);

    const intervals = [];
    for (let i = 1; i < dates.length; i += 1) {
      const gap = (dates[i] - dates[i - 1]) / DAY_MS;
      // Two purchases on the same trip are one event, not a 0-day cycle.
      if (gap >= 0.5) intervals.push(gap);
    }

    stats.set(key, {
      productId: record.productId,
      name: record.name,
      count: dates.length,
      lastAt: new Date(dates[dates.length - 1]).toISOString(),
      intervals,
      // Two gaps is the minimum that says anything about a rhythm.
      learned: intervals.length >= 2 ? median(intervals) : null
    });
  }

  return stats;
}

/**
 * Co-occurrence pairs derived from the user's own shopping trips.
 * Purchases within the same calendar day count as one trip.
 */
function learnedAffinity(history) {
  const trips = new Map();

  for (const entry of history) {
    if (!entry.productId) continue;
    const day = entry.at.slice(0, 10);
    if (!trips.has(day)) trips.set(day, new Set());
    trips.get(day).add(entry.productId);
  }

  const pairs = new Map();
  for (const products of trips.values()) {
    const list = [...products];
    for (const a of list) {
      for (const b of list) {
        if (a === b) continue;
        const key = `${a}|${b}`;
        pairs.set(key, (pairs.get(key) || 0) + 1);
      }
    }
  }

  return pairs;
}

/**
 * Ranked suggestions for the current list.
 *
 * @param {object} state              list state ({ items, history })
 * @param {object} [options]
 * @param {Date}   [options.now]      injectable clock, so tests are deterministic
 * @param {number} [options.limit=8]
 * @param {number} [options.month]    override the seasonal month
 * @returns {Array<{
 *   id: string|null, name: string, category: string, reason: string,
 *   vars: object, price: number|null, salePrice: number|null,
 *   discount: number, score: number
 * }>}
 */
export function suggest(state, options = {}) {
  const now = options.now || new Date();
  const limit = options.limit ?? 8;
  const month = options.month ?? currentMonth(now);

  const history = state.history || [];
  const stats = purchaseStats(history);

  // Anything already on the list is not a suggestion.
  const onList = new Set(
    state.items.filter((item) => !item.bought).map((item) => item.productId).filter(Boolean)
  );
  const onListNames = new Set(
    state.items.filter((item) => !item.bought).map((item) => item.name.toLowerCase())
  );

  /** id -> best candidate so far */
  const candidates = new Map();

  const offer = (productId, reason, score, vars = {}) => {
    const product = getProduct(productId);
    if (!product) return;
    if (onList.has(productId) || onListNames.has(product.name.toLowerCase())) return;
    if (!isAvailable(productId)) return;

    const existing = candidates.get(productId);
    if (existing && existing.score >= score) return;

    candidates.set(productId, {
      id: product.id,
      name: product.name,
      category: product.category,
      reason,
      vars,
      price: product.price,
      salePrice: salePrice(product.id),
      discount: discountFor(product.id),
      score
    });
  };

  // ------------------------------------------------------------ 1. due -----
  for (const record of stats.values()) {
    if (!record.productId) continue;

    const product = getProduct(record.productId);
    if (!product) continue;

    const interval = record.learned || product.cycleDays;
    if (!interval) continue;

    const elapsed = daysBetween(record.lastAt, now);
    // 80% through the cycle is early enough to be useful, late enough to be right.
    const ratio = elapsed / interval;
    if (ratio < 0.8) continue;

    // Overdue items rank above merely-due ones, but the score is capped so a
    // long-forgotten purchase cannot dominate the whole panel.
    const score = 100 + Math.min(ratio, 3) * 10 + (record.learned ? 5 : 0);
    offer(record.productId, 'runningLow', score, {
      days: Math.round(interval),
      elapsed: Math.round(elapsed)
    });
  }

  // ------------------------------------------------------- 2. frequent -----
  for (const record of stats.values()) {
    if (!record.productId || record.count < 3) continue;
    offer(record.productId, 'frequentlyBought', 80 + Math.min(record.count, 10), {
      count: record.count
    });
  }

  // ---------------------------------------------------------- 3. pairs -----
  const learned = learnedAffinity(history);
  for (const item of state.items) {
    if (item.bought || !item.productId) continue;

    const partners = new Set(AFFINITY[item.productId] || []);
    for (const [key, count] of learned) {
      const [a, b] = key.split('|');
      if (a === item.productId && count >= 2) partners.add(b);
    }

    for (const partner of partners) {
      offer(partner, 'pairsWith', 60 + (learned.get(`${item.productId}|${partner}`) || 0), {
        item: item.name
      });
    }
  }

  // ------------------------------------------------- 4. season and sale -----
  for (const pick of seasonalPicks(month, 12)) {
    const base = pick.reason === 'inSeason' ? 50 : pick.reason === 'seasonalEvent' ? 45 : 40;
    offer(pick.id, pick.reason, base + pick.discount / 10, {
      percent: pick.discount,
      event: pick.event
    });
  }

  // ------------------------------------------------------ 5. cold start -----
  if (!history.length) {
    for (const id of COLD_START) offer(id, 'staple', 30);
  }

  return [...candidates.values()]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/**
 * Alternatives for a product, annotated with price and availability so the UI
 * can explain *why* it is offering each one.
 *
 * @param {string} productId
 * @param {object} [options]
 * @param {boolean} [options.onlyAvailable=true]
 */
export function alternatives(productId, options = {}) {
  const { onlyAvailable = true, limit = 3 } = options;

  const subs = substitutesFor(productId, onlyAvailable ? isAvailable : undefined, limit);
  const original = getProduct(productId);

  return subs.map(({ id, reason }) => {
    const product = getProduct(id);
    return {
      id,
      name: product.name,
      category: product.category,
      reason,
      price: product.price,
      salePrice: salePrice(id),
      discount: discountFor(id),
      onSale: isOnSale(id),
      available: isAvailable(id),
      cheaperThanOriginal: original ? product.price < original.price : false
    };
  });
}

/**
 * Items in season or discounted this month, for the dedicated panel.
 * Thin wrapper so the UI never imports the data layer directly.
 */
export function seasonal(options = {}) {
  const now = options.now || new Date();
  return seasonalPicks(options.month ?? currentMonth(now), options.limit ?? 8);
}

/** Products the user has bought before, most recent first. */
export function previouslyBought(state, limit = 10) {
  const stats = purchaseStats(state.history || []);

  return [...stats.values()]
    .filter((record) => record.productId && getProduct(record.productId))
    .sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt))
    .slice(0, limit)
    .map((record) => {
      const product = getProduct(record.productId);
      return {
        id: product.id,
        name: product.name,
        category: product.category,
        count: record.count,
        lastAt: record.lastAt,
        price: product.price
      };
    });
}

