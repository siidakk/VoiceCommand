/**
 * Search qualifier extraction.
 *
 * Turns "find organic apples under 5 dollars from Washington" into
 *
 *   { query: 'apples', maxPrice: 5, tags: ['organic'], brand: 'Washington' }
 *
 * Each pattern removes the span it consumed, so whatever survives is the
 * product name. That ordering matters: price and brand phrases are stripped
 * first precisely so they can never leak into the product query and ruin the
 * catalog match.
 *
 * Prices are interpreted in the *spoken* currency and converted to the
 * catalog's rupee base by the caller (see engine/search.js), so "under 500
 * rupees" and "under 5 dollars" both work.
 */

import { ALL_BRANDS } from '../data/catalog.js';
import { normalize, escapeRegex } from './normalize.js';

/** Currency words, mapped to the ISO code they imply. */
const CURRENCY_WORDS = [
  [['dollar', 'dollars', 'buck', 'bucks', 'usd', 'डॉलर', 'dolar', 'dolares'], 'USD'],
  [['rupee', 'rupees', 'rs', 'inr', 'रुपये', 'रुपए', 'रुपया', 'रूपये'], 'INR'],
  [['euro', 'euros', 'eur', 'यूरो'], 'EUR'],
  [['pound', 'pounds', 'gbp'], 'GBP']
];

const CURRENCY_INDEX = new Map();
for (const [words, code] of CURRENCY_WORDS) {
  for (const word of words) CURRENCY_INDEX.set(word, code);
}

/**
 * Optional trailing currency word.
 *
 * Sorted longest-first: regex alternation is first-match-wins, so listing
 * "dollar" before "dollars" would match only the singular and strand a bare
 * "s" in the product query.
 */
const CUR = `(?:\\s*(${[...CURRENCY_INDEX.keys()]
  .sort((a, b) => b.length - a.length)
  .map(escapeRegex)
  .join('|')}))?`;

/**
 * Comparator patterns per language. Each entry is [regex, kind], where the
 * regex exposes `n` (and `m` for ranges) and optionally a currency group.
 */
const PRICE_PATTERNS = {
  en: [
    [new RegExp(`\\bbetween\\s+(?<n>\\d+(?:\\.\\d+)?)${CUR}\\s+and\\s+(?<m>\\d+(?:\\.\\d+)?)${CUR}`, 'iu'), 'range'],
    [new RegExp(`\\bfrom\\s+(?<n>\\d+(?:\\.\\d+)?)${CUR}\\s+to\\s+(?<m>\\d+(?:\\.\\d+)?)${CUR}`, 'iu'), 'range'],
    [new RegExp(`\\b(?:under|below|less\\s+than|cheaper\\s+than|up\\s+to|at\\s+most|no\\s+more\\s+than|within)\\s+(?<n>\\d+(?:\\.\\d+)?)${CUR}`, 'iu'), 'max'],
    [new RegExp(`\\b(?:over|above|more\\s+than|at\\s+least|starting\\s+at)\\s+(?<n>\\d+(?:\\.\\d+)?)${CUR}`, 'iu'), 'min'],
    [new RegExp(`\\b(?:around|about|approximately)\\s+(?<n>\\d+(?:\\.\\d+)?)${CUR}`, 'iu'), 'about']
  ],
  hi: [
    [new RegExp(`(?<n>\\d+(?:\\.\\d+)?)${CUR}\\s*(?:से|se)\\s*(?:कम|kam)`, 'iu'), 'max'],
    [new RegExp(`(?<n>\\d+(?:\\.\\d+)?)${CUR}\\s*(?:से|se)\\s*(?:ज्यादा|ज़्यादा|zyada|jyada)`, 'iu'), 'min'],
    [new RegExp(`(?<n>\\d+(?:\\.\\d+)?)${CUR}\\s*(?:और|aur)\\s*(?<m>\\d+(?:\\.\\d+)?)${CUR}\\s*(?:के बीच|ke beech)`, 'iu'), 'range']
  ],
  es: [
    [new RegExp(`\\bentre\\s+(?<n>\\d+(?:\\.\\d+)?)${CUR}\\s+y\\s+(?<m>\\d+(?:\\.\\d+)?)${CUR}`, 'iu'), 'range'],
    [new RegExp(`\\b(?:por\\s+)?(?:menos\\s+de|debajo\\s+de|hasta|maximo)\\s+(?<n>\\d+(?:\\.\\d+)?)${CUR}`, 'iu'), 'max'],
    [new RegExp(`\\b(?:mas\\s+de|encima\\s+de|minimo)\\s+(?<n>\\d+(?:\\.\\d+)?)${CUR}`, 'iu'), 'min']
  ],
  fr: [
    [new RegExp(`\\bentre\\s+(?<n>\\d+(?:\\.\\d+)?)${CUR}\\s+et\\s+(?<m>\\d+(?:\\.\\d+)?)${CUR}`, 'iu'), 'range'],
    [new RegExp(`\\b(?:moins\\s+de|en\\s+dessous\\s+de|jusqu\\s*a|maximum)\\s+(?<n>\\d+(?:\\.\\d+)?)${CUR}`, 'iu'), 'max'],
    [new RegExp(`\\b(?:plus\\s+de|au\\s+dessus\\s+de|minimum)\\s+(?<n>\\d+(?:\\.\\d+)?)${CUR}`, 'iu'), 'min']
  ]
};

/** "by Amul" / "from Colgate" / "de Amul" — an explicit brand marker. */
const BRAND_PATTERNS = {
  en: /\b(?:by|from|brand)\s+(?<b>[\p{L}\p{M}'&-]+(?:\s+[\p{L}\p{M}'&-]+)?)/iu,
  hi: /(?<b>[\p{L}\p{M}'&-]+)\s*(?:ब्रांड|brand)/iu,
  es: /\b(?:de\s+la\s+marca|marca)\s+(?<b>[\p{L}\p{M}'&-]+)/iu,
  fr: /\b(?:de\s+la\s+marque|marque)\s+(?<b>[\p{L}\p{M}'&-]+)/iu
};

/** Pack size: "1 litre", "500 grams", "6 pack". */
const SIZE_PATTERN =
  /\b(?<v>\d+(?:\.\d+)?)\s*(?<u>ml|l|litre|litres|liter|liters|g|gm|gram|grams|kg|kilo|kilos|kilogram|kilograms|oz|lb|pcs|pack|pieces)\b/iu;

/**
 * Attribute words that map to catalog tags.
 * Spoken form -> canonical tag, so "sugar free" and "sugarfree" both land on
 * the "sugar-free" tag actually stored on products.
 */
const TAG_SYNONYMS = {
  organic: 'organic',
  bio: 'organic',
  organico: 'organic',
  biologique: 'organic',
  'जैविक': 'organic',
  'gluten free': 'gluten-free',
  glutenfree: 'gluten-free',
  'sin gluten': 'gluten-free',
  'sans gluten': 'gluten-free',
  'sugar free': 'sugar-free',
  sugarfree: 'sugar-free',
  'sin azucar': 'sugar-free',
  'sans sucre': 'sugar-free',
  'no added sugar': 'no added sugar',
  vegan: 'vegan',
  vegano: 'vegan',
  vegetalien: 'vegan',
  'dairy free': 'dairy-free',
  'lactose free': 'dairy-free',
  'sin lactosa': 'dairy-free',
  'sans lactose': 'dairy-free',
  fresh: 'fresh',
  fresco: 'fresh',
  frais: 'fresh',
  'ताज़ा': 'fresh',
  frozen: 'frozen',
  congelado: 'frozen',
  surgele: 'frozen',
  'whole wheat': 'whole wheat',
  wholemeal: 'whole wheat',
  integral: 'whole wheat',
  complet: 'whole wheat',
  'high protein': 'high protein',
  'high fibre': 'high fibre',
  'high fiber': 'high fibre',
  unsalted: 'unsalted',
  salted: 'salted',
  diet: 'zero sugar',
  'zero sugar': 'zero sugar',
  skimmed: 'skimmed',
  'low fat': 'skimmed',
  spicy: 'spicy',
  picante: 'spicy',
  boneless: 'boneless',
  antibacterial: 'antibacterial',
  whitening: 'whitening',
  sensitive: 'sensitive'
};

/** Longest tag phrases first so "sugar free" beats a bare "sugar". */
const TAG_PHRASES = Object.keys(TAG_SYNONYMS).sort((a, b) => b.length - a.length);

/** Lowercased brand lookup, longest first for multi-word brands. */
const BRAND_INDEX = new Map(ALL_BRANDS.map((b) => [normalize(b), b]));
const BRAND_PHRASES = [...BRAND_INDEX.keys()].sort((a, b) => b.length - a.length);

/** Cut a matched span out of the text. */
function cut(text, match) {
  return `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse search qualifiers out of a phrase.
 *
 * @param {string} phrase normalised, number-digitised search payload
 * @param {string} lang
 * @returns {{
 *   query: string, minPrice: number|null, maxPrice: number|null,
 *   currency: string|null, brand: string|null, tags: string[],
 *   size: string|null, applied: string[]
 * }}
 */
export function parseFilters(phrase, lang = 'en') {
  let text = normalize(phrase);

  const result = {
    query: '',
    minPrice: null,
    maxPrice: null,
    currency: null,
    brand: null,
    tags: [],
    size: null,
    applied: []
  };

  // ------------------------------------------------------------- price ----
  const pricePatterns = [...(PRICE_PATTERNS[lang] || []), ...PRICE_PATTERNS.en];
  for (const [pattern, kind] of pricePatterns) {
    const found = pattern.exec(text);
    if (!found) continue;

    const groups = found.groups || {};
    const low = Number(groups.n);
    const high = groups.m !== undefined ? Number(groups.m) : null;

    // The currency word may sit on either side of a range.
    const spoken = found.slice(1).find((g) => g && CURRENCY_INDEX.has(g.toLowerCase()));
    if (spoken) result.currency = CURRENCY_INDEX.get(spoken.toLowerCase());

    if (kind === 'range' && high !== null) {
      result.minPrice = Math.min(low, high);
      result.maxPrice = Math.max(low, high);
      result.applied.push('price-range');
    } else if (kind === 'max') {
      result.maxPrice = low;
      result.applied.push('price-max');
    } else if (kind === 'min') {
      result.minPrice = low;
      result.applied.push('price-min');
    } else if (kind === 'about') {
      // "around 5" reads as a soft band rather than a hard ceiling.
      result.minPrice = Math.round(low * 0.8 * 100) / 100;
      result.maxPrice = Math.round(low * 1.2 * 100) / 100;
      result.applied.push('price-about');
    }

    text = cut(text, found);
    break;
  }

  // ------------------------------------------------------------- brand ----
  const brandPattern = BRAND_PATTERNS[lang] || BRAND_PATTERNS.en;
  const brandMarked = brandPattern.exec(text);
  if (brandMarked && brandMarked.groups.b) {
    const spoken = normalize(brandMarked.groups.b);
    // Only trust an explicit marker if it names a brand we actually stock;
    // otherwise "from the bakery" would be read as a brand.
    const known = BRAND_PHRASES.find((b) => spoken === b || spoken.startsWith(`${b} `));
    if (known) {
      result.brand = BRAND_INDEX.get(known);
      result.applied.push('brand');
      text = cut(text, brandMarked);
    }
  }

  if (!result.brand) {
    // Bare brand name, no marker: "find Colgate toothpaste".
    for (const phraseKey of BRAND_PHRASES) {
      const pattern = new RegExp(`(?<![\\p{L}\\p{M}])${escapeRegex(phraseKey)}(?![\\p{L}\\p{M}])`, 'iu');
      const found = pattern.exec(text);
      if (!found) continue;
      result.brand = BRAND_INDEX.get(phraseKey);
      result.applied.push('brand');
      text = cut(text, found);
      break;
    }
  }

  // -------------------------------------------------------------- tags ----
  for (const phraseKey of TAG_PHRASES) {
    const pattern = new RegExp(`(?<![\\p{L}\\p{M}])${escapeRegex(phraseKey)}(?![\\p{L}\\p{M}])`, 'iu');
    const found = pattern.exec(text);
    if (!found) continue;

    const tag = TAG_SYNONYMS[phraseKey];
    if (!result.tags.includes(tag)) result.tags.push(tag);
    text = cut(text, found);
  }
  if (result.tags.length) result.applied.push('tags');

  // -------------------------------------------------------------- size ----
  const sizeFound = SIZE_PATTERN.exec(text);
  if (sizeFound) {
    result.size = `${sizeFound.groups.v} ${sizeFound.groups.u}`;
    result.applied.push('size');
    text = cut(text, sizeFound);
  }

  // Leftover connective words that only made sense with a removed qualifier.
  text = text
    .replace(/(?<![\p{L}\p{M}])(?:for|in|with|of|de|du|des|the|a|an|me|some|any)(?![\p{L}\p{M}])/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  result.query = text;
  return result;
}

