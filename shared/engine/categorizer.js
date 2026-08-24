/**
 * Automatic categorisation.
 *
 * Catalog products carry their own category, so the interesting case is the
 * free-text item — someone says "add rice paper" and we still want it filed
 * somewhere better than "Other".
 *
 * Two passes: a keyword table, then a nearest-neighbour vote among the closest
 * catalog matches. The second pass is what catches items the keyword table was
 * never written for, because a product the matcher considers similar is
 * usually in the right aisle even when it is not the right product.
 */

import { getProduct } from '../data/catalog.js';
import { matchProducts, contentTokens } from '../nlp/matcher.js';

/**
 * Keyword hints per category, checked as whole words against the item name.
 * Ordered most-specific category first: a "frozen pizza" should land in frozen,
 * not pantry, so `frozen` is consulted before the broader food aisles.
 */
const KEYWORDS = [
  ['frozen', ['frozen', 'ice', 'popsicle', 'sorbet', 'gelato']],
  ['baby', ['baby', 'infant', 'diaper', 'nappy', 'nappies', 'formula', 'toddler', 'pacifier']],
  ['pet', ['dog', 'cat', 'puppy', 'kitten', 'pet', 'litter', 'kibble', 'birdseed']],
  ['personal_care', ['shampoo', 'soap', 'toothpaste', 'toothbrush', 'razor', 'deodorant',
    'lotion', 'cream', 'sunscreen', 'perfume', 'floss', 'shaving', 'conditioner',
    'moisturiser', 'moisturizer', 'wipes', 'sanitizer', 'tissue', 'cotton', 'bandage']],
  ['household', ['detergent', 'cleaner', 'bleach', 'sponge', 'broom', 'mop', 'bin',
    'garbage', 'trash', 'foil', 'wrap', 'battery', 'bulb', 'candle', 'matches',
    'towel', 'napkin', 'dishwasher', 'laundry', 'fabric']],
  ['beverages', ['juice', 'soda', 'cola', 'water', 'drink', 'beer', 'wine', 'whisky',
    'vodka', 'lemonade', 'smoothie', 'squash', 'cordial', 'tonic']],
  ['bakery', ['bread', 'bun', 'roll', 'bagel', 'croissant', 'cake', 'muffin', 'pastry',
    'donut', 'doughnut', 'baguette', 'pita', 'naan', 'roti', 'tortilla', 'brioche']],
  ['dairy', ['milk', 'cheese', 'butter', 'yogurt', 'yoghurt', 'cream', 'egg', 'eggs',
    'paneer', 'ghee', 'curd', 'custard', 'margarine']],
  ['meat', ['chicken', 'beef', 'pork', 'lamb', 'mutton', 'bacon', 'sausage', 'ham',
    'turkey', 'steak', 'mince', 'salami', 'meat']],
  ['seafood', ['fish', 'salmon', 'tuna', 'prawn', 'shrimp', 'crab', 'lobster',
    'squid', 'sardine', 'mackerel', 'cod', 'seafood']],
  ['produce', ['apple', 'banana', 'orange', 'tomato', 'potato', 'onion', 'lettuce',
    'spinach', 'carrot', 'fruit', 'vegetable', 'veggies', 'salad', 'herb', 'berry',
    'berries', 'melon', 'grape', 'mango', 'lemon', 'lime', 'garlic', 'ginger',
    'cucumber', 'pepper', 'chilli', 'chili', 'mushroom', 'cabbage', 'celery']],
  ['breakfast', ['cereal', 'oat', 'oats', 'granola', 'muesli', 'pancake', 'waffle',
    'syrup', 'honey', 'jam', 'marmalade', 'porridge']],
  ['snacks', ['chips', 'crisps', 'biscuit', 'cookie', 'chocolate', 'candy', 'sweets',
    'popcorn', 'nuts', 'almond', 'cashew', 'pretzel', 'cracker', 'wafer', 'snack']],
  ['condiments', ['sauce', 'ketchup', 'mayo', 'mayonnaise', 'mustard', 'vinegar',
    'dressing', 'pickle', 'chutney', 'relish', 'salsa', 'marinade']],
  ['pantry', ['rice', 'pasta', 'flour', 'sugar', 'salt', 'oil', 'spice', 'lentil',
    'dal', 'bean', 'noodle', 'tea', 'coffee', 'canned', 'tinned', 'stock', 'broth',
    'yeast', 'baking', 'masala', 'powder', 'seeds', 'grain', 'quinoa', 'couscous']]
];

/**
 * Categories whose keywords override word position: an item mentioning "baby"
 * or "dog" belongs to that aisle no matter what the head noun is.
 */
const STRONG_CATEGORIES = new Set(['baby', 'pet']);

/** Flat lookup built once: keyword -> category. */
const KEYWORD_INDEX = new Map();
for (const [category, words] of KEYWORDS) {
  for (const word of words) {
    if (!KEYWORD_INDEX.has(word)) KEYWORD_INDEX.set(word, category);
  }
}

/**
 * Best category for an item.
 *
 * @param {string} name         item name as it will be displayed
 * @param {string|null} [productId]  catalog id, when the item is a known product
 * @returns {string} a category id, never null — falls back to 'other'
 */
export function categorize(name, productId = null) {
  // A known product already knows where it belongs.
  if (productId) {
    const product = getProduct(productId);
    if (product) return product.category;
  }

  const tokens = contentTokens(name || '');
  if (!tokens.length) return 'other';

  // Pass 0: strong qualifiers. "dog" and "baby" decide the aisle wherever they
  // appear — dog biscuits are shelved with pet food, not with biscuits — so
  // they are checked before the positional rule below.
  for (const token of tokens) {
    const category = KEYWORD_INDEX.get(token);
    if (category && STRONG_CATEGORIES.has(category)) return category;
  }

  // Pass 1: direct keyword hit. Later tokens win because the head noun of an
  // English item name tends to come last ("almond milk" -> dairy).
  let keywordHit = null;
  for (const token of tokens) {
    const category = KEYWORD_INDEX.get(token);
    if (category) keywordHit = category;
  }
  if (keywordHit) return keywordHit;

  // Pass 2: vote among the nearest catalog products. The threshold is
  // deliberately strict — a weak fuzzy match files genuinely unknown items in
  // an arbitrary aisle, which is worse than admitting we do not know.
  const neighbours = matchProducts(name, { limit: 3, threshold: 0.62 });
  if (neighbours.length) {
    const votes = new Map();
    for (const { product, score } of neighbours) {
      votes.set(product.category, (votes.get(product.category) || 0) + score);
    }
    const [best] = [...votes.entries()].sort((a, b) => b[1] - a[1]);
    if (best) return best[0];
  }

  return 'other';
}

