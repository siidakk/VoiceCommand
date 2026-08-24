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
 * Static conversion rates from the catalog's USD base.
 *
 * Deliberately not a live FX call: the assignment asks for a shopping
 * assistant, not a currency tracker, and a hard-coded table keeps the project
 * dependency-free and deterministic in tests. Swap for a rates API if the
 * numbers ever need to be real.
 */
const USD_RATES = { USD: 1, INR: 83, EUR: 0.92 };

const CURRENCY_LOCALE = { USD: 'en-US', INR: 'en-IN', EUR: 'de-DE' };

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

/** Currency code a language defaults to. */
export function currencyFor(lang) {
  return LOCALES[resolveLang(lang)].currency;
}

/**
 * Render a USD amount in the language's currency.
 *
 * @param {number} usd    amount in catalog base currency
 * @param {string} lang   language code
 * @param {string} [currency] override the language default
 */
export function formatCurrency(usd, lang, currency) {
  const code = currency || currencyFor(lang);
  const rate = USD_RATES[code] ?? 1;
  const value = usd * rate;
  // Whole rupees read better than paise for grocery prices.
  const digits = code === 'INR' ? 0 : 2;

  try {
    return new Intl.NumberFormat(CURRENCY_LOCALE[code] || 'en-US', {
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

/** Convert a spoken amount in the user's currency back to catalog USD. */
export function toUsd(amount, lang, currency) {
  const code = currency || currencyFor(lang);
  const rate = USD_RATES[code] ?? 1;
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
