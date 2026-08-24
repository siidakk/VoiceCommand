/**
 * Translation registry and formatting helpers.
 *
 * Loaded identically by the browser and by Node, so a spoken reply generated
 * server-side reads the same as one generated offline in the client.
 */

import en from './en.js';
import hi from './hi.js';
import es from './es.js';
import fr from './fr.js';

/** All supported locales, in the order they appear in the language picker. */
export const LOCALES = { en, hi, es, fr };

export const LANGUAGES = Object.values(LOCALES).map((l) => ({
  code: l.code,
  speech: l.speech,
  name: l.name,
  nativeName: l.nativeName,
  currency: l.currency
}));

export const DEFAULT_LANG = 'en';

/**
 * The catalog's base and display currency.
 *
 * Every price in shared/data/catalog.js is a US dollar amount, and every locale
 * displays dollars. The display currency deliberately does not follow the
 * interface language: switching to Français changes the words, not the shop, so
 * a French-speaking shopper still sees the prices the store actually charges.
 */
export const BASE_CURRENCY = 'USD';

/**
 * Static conversion rates *from* the USD base.
 *
 * Deliberately not a live FX call: the assignment asks for a shopping
 * assistant, not a currency tracker, and a hard-coded table keeps the project
 * dependency-free and deterministic in tests. Swap for a rates API if the
 * numbers ever need to be real.
 *
 * These exist so a spoken price in another currency ("under 500 rupees") can be
 * compared against a dollar catalog — not so the UI can re-denominate itself.
 */
const RATES_FROM_BASE = { USD: 1, INR: 83, EUR: 0.92, GBP: 0.79 };

const CURRENCY_LOCALE = { USD: 'en-US', INR: 'en-IN', EUR: 'de-DE', GBP: 'en-GB' };

/** Currencies rendered without minor units, because the coins are noise. */
const WHOLE_UNIT_CURRENCIES = new Set(['INR']);

/** Normalise anything to a supported language code. */
export function resolveLang(lang) {
  if (!lang) return DEFAULT_LANG;
  const base = String(lang).toLowerCase().split(/[-_]/)[0];
  return LOCALES[base] ? base : DEFAULT_LANG;
}

/**
 * Translate `key`, filling {placeholders} from `vars`.
 *
 * Falls back to English, then to the key itself, so a missing translation
 * degrades to readable English rather than blank UI.
 */
export function t(lang, key, vars = {}) {
  const locale = LOCALES[resolveLang(lang)];
  const template = locale.strings[key] ?? en.strings[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  );
}

/** Bind a language once and get a plain `t(key, vars)` back. */
export function translator(lang) {
  const code = resolveLang(lang);
  const fn = (key, vars) => t(code, key, vars);
  fn.lang = code;
  fn.locale = LOCALES[code];
  return fn;
}

/**
 * Currency a language displays prices in.
 *
 * Every locale returns the base currency today, because all four describe the
 * same shop. The indirection is kept rather than hard-coding USD at the call
 * sites so that adding a locale with its own storefront stays a one-line change
 * in that locale file.
 */
export function currencyFor(lang) {
  return LOCALES[resolveLang(lang)].currency || BASE_CURRENCY;
}

/**
 * Render a catalog amount as money.
 *
 * @param {number} amount     price in the base currency (USD)
 * @param {string} lang       language code, used for digit grouping
 * @param {string} [currency] render in this currency instead of the locale's
 */
export function formatCurrency(amount, lang, currency) {
  const code = currency || currencyFor(lang);
  const rate = RATES_FROM_BASE[code] ?? 1;
  const value = amount * rate;
  const digits = WHOLE_UNIT_CURRENCIES.has(code) ? 0 : 2;

  try {
    return new Intl.NumberFormat(CURRENCY_LOCALE[code] || 'en-IN', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(value);
  } catch {
    // Intl is present everywhere we target, but never let formatting throw
    // inside a render path.
    return `${code} ${value.toFixed(digits)}`;
  }
}

/**
 * Convert a spoken amount into the catalog's base currency.
 *
 * This is what makes "find shampoo under 500 rupees" comparable against a
 * dollar-denominated catalog instead of silently comparing different units.
 *
 * @param {number} amount     the number the user said
 * @param {string} lang       language code, for the assumed currency
 * @param {string} [currency] currency the user actually named, if any
 */
export function toBaseCurrency(amount, lang, currency) {
  const code = currency || currencyFor(lang);
  const rate = RATES_FROM_BASE[code] ?? 1;
  return amount / rate;
}

/** BCP-47 tag for the Web Speech API. */
export function speechTag(lang) {
  return LOCALES[resolveLang(lang)].speech;
}

/** Localised category label. */
export function categoryLabel(lang, categoryId) {
  return t(lang, `category.${categoryId}`);
}

/**
 * Pluralised item count, using the dedicated singular string where a locale
 * has one.
 */
export function itemCount(lang, count) {
  return count === 1 ? t(lang, 'list.itemsOne') : t(lang, 'list.items', { count });
}
