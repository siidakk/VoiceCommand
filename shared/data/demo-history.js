/**
 * Sample purchase history.
 *
 * The repurchase predictor works from what the user has actually bought — which
 * means a brand-new user has nothing to predict from, and the single most
 * interesting feature in the app is invisible until they have shopped with it
 * for a fortnight. Nobody evaluating the project will do that.
 *
 * So a first-time list is seeded with a plausible five weeks of shopping. It is
 * disclosed in the interface and can be cleared in one tap; real purchases
 * (marking an item bought) append to the same history and take over naturally.
 *
 * The cadences below are chosen so that some items are due *now* and others are
 * clearly not, which is what makes the prediction legible rather than a list of
 * everything.
 */

/**
 * @typedef {object} DemoProduct
 * @property {string} id        catalog product id
 * @property {string} name      canonical name, stored on the history entry
 * @property {string} category
 * @property {number} everyDays how often this household rebuys it
 * @property {number} lastDaysAgo when it was last bought
 * @property {number} times     how many purchases to fabricate
 */

/** @type {DemoProduct[]} */
const PATTERN = [
  // Due now — these are what the "running low" alert should pick up.
  { id: 'bread', name: 'Bread', category: 'bakery', everyDays: 4, lastDaysAgo: 5, times: 5 },
  { id: 'milk', name: 'Milk', category: 'dairy', everyDays: 3, lastDaysAgo: 4, times: 6 },
  { id: 'eggs', name: 'Eggs', category: 'dairy', everyDays: 7, lastDaysAgo: 6, times: 4 },

  // Bought often, but not due yet — proves the prediction is a cadence and not
  // just "everything you have ever bought".
  { id: 'banana', name: 'Bananas', category: 'produce', everyDays: 5, lastDaysAgo: 1, times: 5 },
  { id: 'chicken', name: 'Chicken', category: 'meat', everyDays: 7, lastDaysAgo: 2, times: 3 },
  { id: 'yogurt', name: 'Yogurt', category: 'dairy', everyDays: 7, lastDaysAgo: 3, times: 3 },

  // Slow movers, one of which is due.
  { id: 'coffee', name: 'Coffee', category: 'pantry', everyDays: 30, lastDaysAgo: 27, times: 2 },
  { id: 'rice', name: 'Rice', category: 'pantry', everyDays: 45, lastDaysAgo: 12, times: 2 },
  { id: 'onion', name: 'Onions', category: 'produce', everyDays: 14, lastDaysAgo: 4, times: 3 }
];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Build the seeded history.
 *
 * @param {Date} [now] injectable clock, so tests are deterministic
 * @returns {{ productId, name, category, quantity, at }[]} oldest first
 */
export function buildDemoHistory(now = new Date()) {
  const entries = [];

  for (const product of PATTERN) {
    for (let n = 0; n < product.times; n += 1) {
      // Walk backwards from the last purchase, one cadence at a time.
      const daysAgo = product.lastDaysAgo + n * product.everyDays;

      entries.push({
        productId: product.id,
        name: product.name,
        category: product.category,
        quantity: 1,
        at: new Date(now.getTime() - daysAgo * DAY_MS).toISOString()
      });
    }
  }

  return entries.sort((a, b) => new Date(a.at) - new Date(b.at));
}

/** Product ids the sample history covers, for tests and the reset notice. */
export const DEMO_PRODUCT_IDS = PATTERN.map((p) => p.id);
