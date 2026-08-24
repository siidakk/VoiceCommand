/**
 * Shopping list state.
 *
 * Every operation is pure: it takes a state and returns a new one, never
 * mutating the input. That is what lets the client keep an undo stack by
 * simply holding on to previous references, and lets the server apply the same
 * operations to persisted state without a second implementation.
 *
 * State shape
 *   {
 *     items:   Item[]           current list
 *     history: HistoryEntry[]   what was bought and when, drives the recommender
 *     version: number           bumped on every change, used for conflict checks
 *     updatedAt: ISO string
 *   }
 *
 * Item
 *   { id, productId|null, variantId|null, brand|null, size|null, unitPrice|null,
 *     name, category, quantity, unit, bought, addedAt, updatedAt, note }
 *
 * `variantId` records which brand-and-size the shopper actually chose, and
 * `unitPrice` freezes what it cost. Without those, a list holding "Colgate
 * 150 ml" would be silently priced as though it were the cheapest tube.
 */

import { getProduct, getVariant, variantLabel } from '../data/catalog.js';
import { aisleOf } from '../data/categories.js';
import { categorize } from './categorizer.js';
import { matchProducts, contentTokens } from '../nlp/matcher.js';

/**
 * Collision-resistant id that works in both runtimes.
 * crypto.randomUUID exists in browsers and Node 19+; the fallback covers
 * older Node and non-secure contexts without pulling in a uuid dependency.
 */
export function newId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `i_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** A fresh, empty list. */
export function createState() {
  return {
    items: [],
    history: [],
    version: 0,
    updatedAt: new Date(0).toISOString()
  };
}

/** Shallow-clone a state with a bumped version and timestamp. */
function bump(state, changes, now) {
  return {
    ...state,
    ...changes,
    version: state.version + 1,
    updatedAt: (now || new Date()).toISOString()
  };
}

/**
 * Locate items in the list.
 *
 * Matching is layered so the obvious case stays exact and only genuinely
 * ambiguous input falls through to fuzzy comparison:
 *   1. same catalog product id
 *   2. identical normalised name
 *   3. fuzzy name match, for free-text items typed slightly differently
 *
 * @returns {Item[]} every match, best first
 */
export function findItems(state, query) {
  const { productId = null, name = '' } = query || {};

  if (productId) {
    const byId = state.items.filter((item) => item.productId === productId);
    if (byId.length) return byId;
  }

  const key = contentTokens(name).join(' ');
  if (!key) return [];

  const exact = state.items.filter((item) => contentTokens(item.name).join(' ') === key);
  if (exact.length) return exact;

  // The spoken phrase may name a product whose display name differs from what
  // is stored ("coke" vs "Cola"), so resolve it through the catalog too.
  const resolved = matchProducts(name, { limit: 1 });
  if (resolved.length) {
    const viaCatalog = state.items.filter((item) => item.productId === resolved[0].product.id);
    if (viaCatalog.length) return viaCatalog;
  }

  return state.items.filter((item) => {
    const itemKey = contentTokens(item.name).join(' ');
    return itemKey.includes(key) || key.includes(itemKey);
  });
}

/** First match, or null. */
export function findItem(state, query) {
  const [first] = findItems(state, query);
  return first || null;
}

/**
 * Add an item, merging into an existing unbought entry for the same product.
 *
 * Merging is the behaviour people expect: saying "add milk" twice should leave
 * one line with quantity 2, not two identical lines. A bought item is left
 * alone so re-adding after shopping starts a fresh entry.
 *
 * @returns {{ state, item, merged: boolean }}
 */
export function addItem(state, spec, now = new Date()) {
  const timestamp = now.toISOString();
  const productId = spec.productId || null;
  const product = productId ? getProduct(productId) : null;

  const name = spec.name || (product ? product.name : '').trim();
  if (!name) return { state, item: null, merged: false };

  const quantity = Number.isFinite(spec.quantity) && spec.quantity > 0 ? spec.quantity : 1;
  const unit = spec.unit || (product ? product.unit : 'pcs');
  const category = spec.category || categorize(name, productId);

  // A specific brand-and-size, when the shopper picked one from search.
  const variant = spec.variantId ? getVariant(spec.variantId) : null;
  const variantId = variant ? variant.id : null;
  const unitPrice = variant ? variant.price : product ? product.price : null;

  const existing = state.items.find(
    (item) =>
      !item.bought &&
      item.unit === unit &&
      // Two different variants of one product are two different things to buy,
      // so they stay as separate lines rather than merging into a wrong price.
      (item.variantId || null) === variantId &&
      (productId ? item.productId === productId : contentTokens(item.name).join(' ') === contentTokens(name).join(' '))
  );

  if (existing) {
    const items = state.items.map((item) =>
      item.id === existing.id
        ? { ...item, quantity: item.quantity + quantity, updatedAt: timestamp }
        : item
    );
    const merged = items.find((item) => item.id === existing.id);
    return { state: bump(state, { items }, now), item: merged, merged: true };
  }

  const item = {
    id: newId(),
    productId,
    variantId,
    brand: variant ? variant.brand : null,
    size: variant ? variant.size : null,
    unitPrice,
    name,
    category,
    quantity,
    unit,
    bought: false,
    addedAt: timestamp,
    updatedAt: timestamp,
    note: spec.note || ''
  };

  return { state: bump(state, { items: [...state.items, item] }, now), item, merged: false };
}

/**
 * Remove an item.
 * @returns {{ state, removed: Item|null }}
 */
export function removeItem(state, query, now = new Date()) {
  const target = findItem(state, query);
  if (!target) return { state, removed: null };

  const items = state.items.filter((item) => item.id !== target.id);
  return { state: bump(state, { items }, now), removed: target };
}

/**
 * Set an item's quantity. A quantity of zero removes it, which is what "make
 * it zero" plainly means.
 *
 * @returns {{ state, item: Item|null, removed: boolean }}
 */
export function updateQuantity(state, query, quantity, now = new Date()) {
  const target = findItem(state, query);
  if (!target) return { state, item: null, removed: false };

  if (!Number.isFinite(quantity) || quantity <= 0) {
    const { state: next, removed } = removeItem(state, { productId: target.productId, name: target.name }, now);
    return { state: next, item: removed, removed: true };
  }

  const timestamp = now.toISOString();
  const items = state.items.map((item) =>
    item.id === target.id ? { ...item, quantity, updatedAt: timestamp } : item
  );

  return { state: bump(state, { items }, now), item: items.find((i) => i.id === target.id), removed: false };
}

/**
 * Mark an item bought (or un-bought), recording a history entry that the
 * recommender later uses to predict repurchases.
 *
 * @returns {{ state, item: Item|null }}
 */
export function markBought(state, query, bought = true, now = new Date()) {
  const target = findItem(state, query);
  if (!target) return { state, item: null };

  const timestamp = now.toISOString();
  const items = state.items.map((item) =>
    item.id === target.id ? { ...item, bought, updatedAt: timestamp } : item
  );

  const history = bought
    ? [
        ...state.history,
        {
          productId: target.productId,
          name: target.name,
          category: target.category,
          quantity: target.quantity,
          at: timestamp
        }
      ]
    : state.history;

  return { state: bump(state, { items, history }, now), item: items.find((i) => i.id === target.id) };
}

/** Flip an item's bought flag. */
export function toggleBought(state, query, now = new Date()) {
  const target = findItem(state, query);
  if (!target) return { state, item: null };
  return markBought(state, query, !target.bought, now);
}

/**
 * Empty the list. History is deliberately preserved — it is what makes the
 * suggestions good, and "clear my list" means the list, not the memory.
 */
export function clearList(state, now = new Date()) {
  const cleared = state.items.length;
  return { state: bump(state, { items: [] }, now), cleared };
}

/** Items in supermarket walking order, unbought first within each aisle. */
export function sortedByAisle(state) {
  return [...state.items].sort((a, b) => {
    if (a.bought !== b.bought) return a.bought ? 1 : -1;
    const aisleDiff = aisleOf(a.category) - aisleOf(b.category);
    if (aisleDiff) return aisleDiff;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Items grouped into categories, ready to render as sections.
 * @returns {{ category: string, items: Item[] }[]}
 */
export function groupByCategory(state) {
  const groups = new Map();

  for (const item of sortedByAisle(state)) {
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category).push(item);
  }

  return [...groups.entries()]
    .map(([category, items]) => ({ category, items }))
    .sort((a, b) => aisleOf(a.category) - aisleOf(b.category));
}

/**
 * What one unit of a list item costs, or null when nothing knows.
 *
 * Prefers the frozen variant price, then the live catalog price. A free-text
 * item has neither and contributes nothing to the estimate rather than a zero
 * that would understate the total.
 */
export function lineUnitPrice(item) {
  if (Number.isFinite(item.unitPrice)) return item.unitPrice;
  const product = item.productId ? getProduct(item.productId) : null;
  return product ? product.price : null;
}

/** "Colgate · 150 ml", or an empty string when no variant was chosen. */
export function itemVariantLabel(item) {
  if (!item.variantId) return '';
  return variantLabel({ brand: item.brand, size: item.size });
}

/**
 * Count and estimated cost.
 * Free-text items have no catalog price and simply contribute nothing to the
 * estimate rather than blocking it.
 *
 * @returns {{ total: number, bought: number, remaining: number,
 *             estimated: number, priced: number, unpriced: number }}
 *          `estimated` is in the catalog's base currency (INR).
 */
export function totals(state) {
  let estimated = 0;
  let priced = 0;
  let unpriced = 0;
  let bought = 0;

  for (const item of state.items) {
    if (item.bought) bought += 1;

    // The chosen variant's price wins over the product's headline price.
    const unitPrice = lineUnitPrice(item);
    if (unitPrice !== null) {
      estimated += unitPrice * item.quantity;
      priced += 1;
    } else {
      unpriced += 1;
    }
  }

  return {
    total: state.items.length,
    bought,
    remaining: state.items.length - bought,
    estimated: Math.round(estimated * 100) / 100,
    priced,
    unpriced
  };
}

/**
 * Normalise arbitrary persisted data back into a valid state.
 *
 * Anything read from localStorage or a JSON file is untrusted — it may come
 * from an older version of the app or a hand-edited file — so every field is
 * checked rather than spread in blindly.
 */
export function hydrate(raw) {
  const base = createState();
  if (!raw || typeof raw !== 'object') return base;

  const items = Array.isArray(raw.items)
    ? raw.items
        .filter((item) => item && typeof item.name === 'string' && item.name.trim())
        .map((item) => ({
          id: typeof item.id === 'string' && item.id ? item.id : newId(),
          productId: typeof item.productId === 'string' ? item.productId : null,
          variantId: typeof item.variantId === 'string' && getVariant(item.variantId) ? item.variantId : null,
          brand: typeof item.brand === 'string' ? item.brand : null,
          size: typeof item.size === 'string' ? item.size : null,
          unitPrice: Number.isFinite(item.unitPrice) && item.unitPrice >= 0 ? item.unitPrice : null,
          name: item.name.trim(),
          category: typeof item.category === 'string' ? item.category : categorize(item.name, item.productId),
          quantity: Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1,
          unit: typeof item.unit === 'string' && item.unit ? item.unit : 'pcs',
          bought: Boolean(item.bought),
          addedAt: typeof item.addedAt === 'string' ? item.addedAt : base.updatedAt,
          updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : base.updatedAt,
          note: typeof item.note === 'string' ? item.note : ''
        }))
    : [];

  const history = Array.isArray(raw.history)
    ? raw.history
        .filter((entry) => entry && typeof entry.at === 'string')
        .map((entry) => ({
          productId: typeof entry.productId === 'string' ? entry.productId : null,
          name: typeof entry.name === 'string' ? entry.name : '',
          category: typeof entry.category === 'string' ? entry.category : 'other',
          quantity: Number.isFinite(entry.quantity) && entry.quantity > 0 ? entry.quantity : 1,
          at: entry.at
        }))
    : [];

  return {
    items,
    history,
    version: Number.isFinite(raw.version) && raw.version >= 0 ? raw.version : 0,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : base.updatedAt
  };
}
