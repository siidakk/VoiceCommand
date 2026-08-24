/**
 * Seasonality, promotions and stock availability.
 *
 * Covers two assignment requirements:
 *   - "Suggest items that are in season or on sale"
 *   - "Offer alternatives if a product is unavailable"
 *
 * In a production system PROMOTIONS and OUT_OF_STOCK would come from a
 * retailer feed. They are modelled here as a static snapshot with the same
 * shape a feed would return, so swapping in a live source is a one-file change
 * (see server/api/suggestions.js, which already reads them through functions
 * rather than touching the tables directly).
 */

import { CATALOG, getProduct } from './catalog.js';

/**
 * Current promotions: product id -> percentage off.
 * Kept deliberately small so "on sale" stays meaningful in the UI.
 */
export const PROMOTIONS = {
  bread: 15,
  eggs: 10,
  chicken_breast: 20,
  olive_oil: 25,
  detergent: 30,
  coffee: 15,
  toilet_paper: 20,
  pasta: 10,
  ice_cream: 25,
  cereal: 15,
  shampoo: 20,
  frozen_pizza: 30,
  orange_juice: 10,
  nuts: 15
};

/**
 * Items the store is currently out of. Drives the substitute prompt when a
 * user asks for something unavailable.
 */
export const OUT_OF_STOCK = new Set(['strawberry', 'salmon', 'avocado', 'baby_formula']);

/**
 * Festive / calendar events that shift what people buy, beyond raw crop
 * seasonality. `label` is an i18n key under `event.*`.
 */
export const SEASONAL_EVENTS = [
  { month: 1, label: 'newYear', items: ['oats', 'greek_yogurt', 'spinach', 'granola_bar'] },
  { month: 3, label: 'spring', items: ['spinach', 'strawberry', 'lettuce', 'cleaning_spray'] },
  { month: 6, label: 'summer', items: ['ice_cream', 'watermelon', 'sunscreen', 'coconut_water', 'sparkling_water'] },
  { month: 7, label: 'summer', items: ['ice_cream', 'mango', 'water', 'sunscreen'] },
  { month: 10, label: 'festive', items: ['ghee', 'nuts', 'chocolate', 'flour', 'sugar'] },
  { month: 11, label: 'festive', items: ['turkey', 'flour', 'sugar', 'butter', 'nuts'] },
  { month: 12, label: 'holidays', items: ['turkey', 'wine', 'chocolate', 'cake', 'cream'] }
];

/** Discount percentage for a product, or 0. */
export function discountFor(id) {
  return PROMOTIONS[id] || 0;
}

/** True when the product is currently discounted. */
export function isOnSale(id) {
  return discountFor(id) > 0;
}

/** True when the product can be bought right now. */
export function isAvailable(id) {
  return !OUT_OF_STOCK.has(id);
}

/** Price after any active promotion, rounded to cents. */
export function salePrice(id) {
  const product = getProduct(id);
  if (!product) return 0;
  const off = discountFor(id);
  if (!off) return product.price;
  return Math.round(product.price * (1 - off / 100) * 100) / 100;
}

/**
 * Items worth surfacing this month: in-season produce, event-driven staples
 * and anything currently discounted, ranked so seasonal+sale items lead.
 *
 * @param {number} month 1-12
 * @param {number} [limit=8]
 * @returns {{ id, name, category, reason, discount, price, salePrice, event }[]}
 */
export function seasonalPicks(month, limit = 8) {
  const eventItems = new Set(
    SEASONAL_EVENTS.filter((e) => e.month === month).flatMap((e) => e.items)
  );
  const eventLabel = (SEASONAL_EVENTS.find((e) => e.month === month) || {}).label || null;

  const scored = [];
  for (const product of CATALOG) {
    if (!isAvailable(product.id)) continue;

    const inSeason = product.season.includes(month);
    const onSale = isOnSale(product.id);
    const isEvent = eventItems.has(product.id);
    if (!inSeason && !onSale && !isEvent) continue;

    // Seasonal relevance outranks a plain discount; both together rank highest.
    let score = 0;
    if (inSeason) score += 3;
    if (isEvent) score += 2;
    if (onSale) score += 1 + discountFor(product.id) / 100;

    const reason = inSeason ? 'inSeason' : isEvent ? 'seasonalEvent' : 'onSale';

    scored.push({
      id: product.id,
      name: product.name,
      category: product.category,
      reason,
      event: isEvent ? eventLabel : null,
      discount: discountFor(product.id),
      price: product.price,
      salePrice: salePrice(product.id),
      score
    });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ score, ...rest }) => rest);
}

/** Current month as 1-12, injectable for deterministic tests. */
export function currentMonth(now = new Date()) {
  return now.getMonth() + 1;
}
