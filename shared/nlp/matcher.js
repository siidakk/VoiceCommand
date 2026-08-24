/**
 * Product matching.
 *
 * Speech recognition is lossy: "oat milk" comes back as "oatmilk", "paneer" as
 * "panir", "cereal" as "serial". Exact lookup would reject all three, so this
 * module scores a spoken phrase against every known name, synonym and
 * translation and returns the best candidate with a confidence value.
 *
 * The UI uses that confidence to decide between acting silently, asking
 * "did you mean…?", and falling back to a free-text item — which is why the
 * score is returned rather than swallowed.
 */

import { CATALOG } from '../data/catalog.js';
import { normalize, escapeRegex } from './normalize.js';

/** Words that carry no product meaning and would dilute token overlap. */
const STOPWORDS = new Set([
  // English
  'a', 'an', 'the', 'of', 'some', 'my', 'to', 'for', 'me', 'i', 'we', 'please',
  'list', 'shopping', 'cart', 'basket', 'more', 'another', 'that', 'this',
  // Hindi (Devanagari + romanised)
  'का', 'की', 'के', 'को', 'में', 'से', 'और', 'मेरी', 'मेरे', 'कुछ', 'थोड़ा',
  'ka', 'ki', 'ke', 'ko', 'mein', 'se', 'aur', 'meri', 'mere', 'thoda',
  // Spanish
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'mi', 'mis', 'y',
  // French
  'du', 'des', 'le', 'les', 'un', 'une', 'mon', 'ma', 'mes', 'et', 'd', 'l'
]);

/**
 * Reduce an English token to a crude stem so "apples" matches "apple".
 *
 * Deliberately shallow — a real stemmer is a dependency, and over-stemming
 * ("gas" -> "ga") causes worse errors than under-stemming in a 136-item
 * catalog. Only safe, high-frequency plural forms are handled.
 */
export function singularize(token) {
  if (token.length <= 3) return token;
  if (/[^aeiou]ies$/.test(token)) return `${token.slice(0, -3)}y`;
  if (/(ches|shes|sses|xes|zes)$/.test(token)) return token.slice(0, -2);
  if (/[^s]s$/.test(token) && !/(ss|us|is)$/.test(token)) return token.slice(0, -1);
  return token;
}

/** Normalise, drop stopwords, singularize. Returns the surviving tokens. */
export function contentTokens(phrase) {
  return normalize(phrase)
    .split(' ')
    .filter((token) => token && !STOPWORDS.has(token))
    .map(singularize)
    .filter(Boolean);
}

/** Canonical comparable key for a phrase. */
function keyOf(phrase) {
  return contentTokens(phrase).join(' ');
}

/**
 * Levenshtein distance with an early bail-out.
 *
 * Returns `max + 1` as soon as the best possible result exceeds `max`, which
 * keeps the full-catalog scan cheap enough to run on every keystroke.
 */
export function levenshtein(a, b, max = Infinity) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let rowBest = current[0];

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      if (current[j] < rowBest) rowBest = current[j];
    }

    if (rowBest > max) return max + 1;
    [previous, current] = [current, previous];
  }

  return previous[b.length];
}

/** Similarity in 0..1 derived from edit distance. */
function editSimilarity(a, b) {
  const longest = Math.max(a.length, b.length);
  if (!longest) return 0;
  const distance = levenshtein(a, b, Math.ceil(longest * 0.4));
  return 1 - distance / longest;
}

/** Overlap of two token sets, weighted toward covering the spoken phrase. */
function tokenOverlap(spoken, candidate) {
  if (!spoken.length || !candidate.length) return 0;

  const candidateSet = new Set(candidate);
  let hits = 0;
  for (const token of spoken) {
    if (candidateSet.has(token)) {
      hits += 1;
      continue;
    }
    // Near-miss tokens still count, at a discount.
    if (candidate.some((c) => c.length > 3 && token.length > 3 && editSimilarity(token, c) > 0.8)) {
      hits += 0.6;
    }
  }

  const coverage = hits / spoken.length;
  const precision = hits / candidate.length;
  // Coverage matters more: "milk" should match "Milk" strongly even though the
  // candidate has extra words in other entries.
  return coverage * 0.7 + precision * 0.3;
}

/**
 * Search index built once at module load.
 * Each entry is one spoken form pointing back at its product.
 */
const INDEX = [];

for (const product of CATALOG) {
  const add = (phrase, source, lang) => {
    const key = keyOf(phrase);
    if (!key) return;
    INDEX.push({ key, tokens: key.split(' '), product, source, lang });
  };

  add(product.name, 'name', 'en');
  add(product.id.replace(/_/g, ' '), 'id', 'en');
  for (const synonym of product.syn) add(synonym, 'syn', 'en');
  for (const [lang, forms] of Object.entries(product.alias)) {
    for (const form of forms) add(form, 'alias', lang);
  }
}

/** Exact-key fast path. */
const EXACT = new Map();
for (const entry of INDEX) {
  if (!EXACT.has(entry.key)) EXACT.set(entry.key, entry);
}

/**
 * Score how well a spoken phrase matches one index entry.
 * @returns {number} 0..1
 */
function scoreEntry(spokenKey, spokenTokens, entry) {
  if (spokenKey === entry.key) return 1;

  // Recognisers frequently drop the space inside a compound name, returning
  // "oatmilk", "icecream", "peanutbutter". Those are the same words, not a
  // fuzzy resemblance, so they score just below an exact hit.
  if (spokenKey.replace(/ /g, '') === entry.key.replace(/ /g, '')) return 0.97;

  // Whole-word containment in either direction: "organic apples" vs "apples".
  const contains =
    new RegExp(`(^|\\s)${escapeRegex(entry.key)}($|\\s)`).test(spokenKey) ||
    new RegExp(`(^|\\s)${escapeRegex(spokenKey)}($|\\s)`).test(entry.key);

  if (contains) {
    // Penalise large length gaps so "milk" does not beat "almond milk" when
    // the user actually said "almond milk".
    const ratio =
      Math.min(spokenTokens.length, entry.tokens.length) /
      Math.max(spokenTokens.length, entry.tokens.length);
    return 0.82 + 0.15 * ratio;
  }

  const overlap = tokenOverlap(spokenTokens, entry.tokens);
  const edit = editSimilarity(spokenKey, entry.key);

  return Math.max(overlap * 0.95, edit * 0.9);
}

/**
 * Best catalog matches for a spoken phrase.
 *
 * @param {string} phrase        raw or normalised spoken product name
 * @param {object} [options]
 * @param {string} [options.lang='en']    biases same-language aliases upward
 * @param {number} [options.limit=5]
 * @param {number} [options.threshold=0.55] minimum score to return at all
 * @returns {{ product: object, score: number, source: string }[]} ranked, best first
 */
export function matchProducts(phrase, options = {}) {
  const { lang = 'en', limit = 5, threshold = 0.55 } = options;

  const spokenKey = keyOf(phrase);
  if (!spokenKey) return [];

  const exact = EXACT.get(spokenKey);
  if (exact) {
    return [{ product: exact.product, score: 1, source: exact.source }];
  }

  const spokenTokens = spokenKey.split(' ');
  const best = new Map();

  for (const entry of INDEX) {
    let score = scoreEntry(spokenKey, spokenTokens, entry);
    if (score < threshold) continue;

    // A translation in the language actually being spoken is more trustworthy
    // than a coincidental resemblance to an English synonym.
    if (entry.lang === lang && entry.source === 'alias') score = Math.min(1, score + 0.05);

    const previous = best.get(entry.product.id);
    if (!previous || score > previous.score) {
      best.set(entry.product.id, { product: entry.product, score, source: entry.source });
    }
  }

  return [...best.values()]
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
    .slice(0, limit);
}

/**
 * Single best match, or null.
 *
 * @returns {{ product, score, source, confident: boolean } | null}
 *          `confident` is true when the match is safe to act on without asking.
 */
export function matchProduct(phrase, options = {}) {
  const results = matchProducts(phrase, { ...options, limit: 2 });
  if (!results.length) return null;

  const [best, runnerUp] = results;

  // Confident when the score is high AND clearly ahead of the alternative;
  // a near-tie is exactly the case where "did you mean?" earns its place.
  const margin = runnerUp ? best.score - runnerUp.score : 1;
  const confident = best.score >= 0.8 && (margin >= 0.08 || best.score >= 0.95);

  return { ...best, confident };
}

/** Index size, exposed for the diagnostics endpoint and tests. */
export const INDEX_SIZE = INDEX.length;
