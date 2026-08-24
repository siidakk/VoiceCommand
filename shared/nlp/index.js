/**
 * NLP pipeline entry point.
 *
 * One utterance in, a list of executable commands out:
 *
 *   "add two litres of milk and remove bread"
 *     -> [ { intent: 'add',    items: [{ product: Milk, quantity: 2, unit: 'l' }] },
 *          { intent: 'remove', items: [{ product: Bread }] } ]
 *
 * Stages, in order:
 *   1. normalise            strip punctuation, fold accents, expand contractions
 *   2. digitise numbers     "twenty five" -> "25"
 *   3. split clauses        one utterance may hold several commands
 *   4. match intent         template grammar
 *   5. extract quantity/unit
 *   6. match products       fuzzy catalog lookup, multi-item aware
 *
 * Every stage is pure and separately testable, which is why the whole thing
 * runs unchanged in the browser and in Node.
 */

import { normalize, stripFillers, splitClauses } from './normalize.js';
import { digitizeNumbers, extractQuantity } from './numbers.js';
import { extractUnit, removeUnit } from './units.js';
import { matchIntent, INTENTS, ACTION_VERBS } from './grammar.js';
import { matchProduct, matchProducts } from './matcher.js';
import { parseFilters } from './filters.js';

export { INTENTS } from './grammar.js';

/** Conjunctions that separate several products inside one command. */
const ITEM_SEPARATORS = {
  en: /\s*(?:,|\band\b|\bplus\b|\balong with\b)\s*/giu,
  hi: /\s*(?:,|और|aur)\s*/giu,
  es: /\s*(?:,|\by\b|\be\b|\bademas de\b)\s*/giu,
  fr: /\s*(?:,|\bet\b|\bainsi que\b)\s*/giu
};

/** Intents that operate on products and therefore need item extraction. */
const ITEM_INTENTS = new Set([
  INTENTS.ADD,
  INTENTS.REMOVE,
  INTENTS.MARK_BOUGHT,
  INTENTS.UPDATE_QTY,
  INTENTS.SUBSTITUTE
]);

/**
 * Guess the language from the script actually used.
 *
 * The recogniser is configured with a language, but users switch mid-session
 * and mobile keyboards do not care. Devanagari in an "English" transcript is
 * unambiguous, so it is worth honouring; Latin-script languages are left to
 * the explicit setting because they are not separable by script alone.
 */
export function detectScript(text) {
  if (/[ऀ-ॿ]/.test(text)) return 'hi';
  return null;
}

/** Title-case a free-text item so custom entries look deliberate in the UI. */
function titleCase(text) {
  return text.replace(/(^|\s)(\p{L})/gu, (_, space, letter) => space + letter.toUpperCase());
}

/**
 * Resolve one product phrase into an item descriptor.
 *
 * An unmatched phrase is NOT an error: the user is allowed to add anything,
 * so it becomes a free-text item in the "other" category. `product` being null
 * is how the rest of the app tells the two apart.
 */
function resolveItem(phrase, lang, defaults = {}) {
  const cleaned = phrase.trim();
  if (!cleaned) return null;

  const match = matchProduct(cleaned, { lang });

  if (match && match.confident) {
    return {
      product: match.product,
      productId: match.product.id,
      name: match.product.name,
      category: match.product.category,
      unit: defaults.unit || match.product.unit,
      quantity: defaults.quantity ?? 1,
      score: match.score,
      confident: true,
      spoken: cleaned,
      alternatives: []
    };
  }

  // Below the confidence bar: surface the near-misses so the UI can ask
  // "did you mean…?" instead of guessing wrong.
  const alternatives = matchProducts(cleaned, { lang, limit: 3 }).map((m) => ({
    id: m.product.id,
    name: m.product.name,
    score: Number(m.score.toFixed(3))
  }));

  return {
    product: match ? match.product : null,
    productId: match ? match.product.id : null,
    name: match ? match.product.name : titleCase(cleaned),
    category: match ? match.product.category : 'other',
    unit: defaults.unit || (match ? match.product.unit : 'pcs'),
    quantity: defaults.quantity ?? 1,
    score: match ? match.score : 0,
    confident: false,
    spoken: cleaned,
    alternatives
  };
}

/**
 * Split a payload into individual product phrases.
 * "milk and eggs" -> ["milk", "eggs"], but "salt and pepper" is only split
 * because both halves resolve to products — see parseItems.
 */
function splitItems(payload, lang) {
  const separator = ITEM_SEPARATORS[lang] || ITEM_SEPARATORS.en;
  return payload
    .split(separator)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Extract every item in a payload, each with its own quantity and unit.
 *
 * "2 litres of milk and 3 apples" yields two items with distinct quantities,
 * because the quantity is parsed per fragment rather than once per command.
 */
function parseItems(payload, lang) {
  const fragments = splitItems(payload, lang);
  const items = [];

  for (const fragment of fragments) {
    let text = fragment;

    const quantityHit = extractQuantity(text, lang);
    const quantity = quantityHit ? quantityHit.value : 1;
    if (quantityHit) text = quantityHit.text;

    const unitHit = extractUnit(text);
    if (unitHit) text = removeUnit(text, unitHit);

    // Drop the quantity digits now that they are captured.
    if (quantityHit) {
      text = text.replace(/(?<![\p{L}\p{M}\d])\d+(?:\.\d+)?(?![\p{L}\p{M}\d])/u, ' ').replace(/\s+/g, ' ').trim();
    }

    const item = resolveItem(text, lang, {
      quantity,
      unit: unitHit ? unitHit.unit : null
    });

    if (item) items.push(item);
  }

  return items;
}

/**
 * Parse a transcript into zero or more executable commands.
 *
 * @param {string} transcript          raw text from the recogniser or textbox
 * @param {object} [options]
 * @param {string} [options.lang='en'] language the recogniser was set to
 * @param {number} [options.confidence=1] recogniser confidence, passed through
 * @returns {{
 *   raw: string, normalized: string, lang: string, confidence: number,
 *   commands: object[]
 * }}
 */
export function parse(transcript, options = {}) {
  const { confidence = 1 } = options;
  const raw = typeof transcript === 'string' ? transcript : '';

  // Honour the script actually spoken over the configured language.
  const requested = options.lang || 'en';
  const lang = detectScript(raw) || requested;

  const normalized = normalize(raw);
  const result = { raw, normalized, lang, confidence, commands: [] };

  if (!normalized) return result;

  const digitized = digitizeNumbers(normalized, lang);
  const clauses = splitClauses(digitized, ACTION_VERBS[lang] || ACTION_VERBS.en);

  for (const clause of clauses) {
    result.commands.push(parseClause(clause, lang));
  }

  return result;
}

/** Parse a single clause into one command. */
function parseClause(clause, lang) {
  const match = matchIntent(clause, lang);

  // No grammar hit. A bare product name is the single most common way people
  // talk to a list ("milk"), so try that before giving up.
  if (!match) {
    const bare = stripFillers(clause, lang);
    const item = bare ? resolveItem(bare, lang) : null;

    if (item && item.confident) {
      return {
        intent: INTENTS.ADD,
        text: clause,
        items: [item],
        filters: null,
        quantity: null,
        implied: true
      };
    }

    return {
      intent: INTENTS.UNKNOWN,
      text: clause,
      items: item ? [item] : [],
      filters: null,
      quantity: null,
      implied: false
    };
  }

  const command = {
    intent: match.intent,
    text: clause,
    items: [],
    filters: null,
    quantity: match.quantity,
    implied: false
  };

  if (match.intent === INTENTS.SEARCH) {
    const payload = stripFillers(match.payload || '', lang);
    command.filters = parseFilters(payload, lang);
    return command;
  }

  if (ITEM_INTENTS.has(match.intent) && match.payload) {
    const payload = stripFillers(match.payload, lang);
    command.items = parseItems(payload, lang);

    // "change milk to 3": the number belongs to the command, not the item.
    if (match.intent === INTENTS.UPDATE_QTY && match.quantity !== null) {
      for (const item of command.items) item.quantity = match.quantity;
    }
  }

  return command;
}

/**
 * Convenience wrapper for the common single-command case.
 * @returns {object|null} the first command, or null for an empty utterance
 */
export function parseOne(transcript, options = {}) {
  const { commands } = parse(transcript, options);
  return commands.length ? commands[0] : null;
}
