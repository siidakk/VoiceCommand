/**
 * Spoken number parsing.
 *
 * Recognisers transcribe quantities inconsistently — "2", "two", "a couple of",
 * "दो", "media docena". This module turns any of those into a number so
 * "add two litres of milk" and "add 2 litres of milk" behave identically.
 *
 * Compound English numerals ("twenty five") are handled by accumulating
 * adjacent tokens; other languages use direct lookup, which covers every
 * quantity a shopper realistically speaks.
 */

/** Base numerals per language. Keys are already normalised (lowercase, folded). */
const WORDS = {
  en: {
    zero: 0, a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
    seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
    fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
    nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
    seventy: 70, eighty: 80, ninety: 90, hundred: 100,
    // Spoken shorthands
    single: 1, couple: 2, pair: 2, few: 3, several: 3, half: 0.5, dozen: 12
  },
  hi: {
    // Devanagari
    'शून्य': 0, 'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5,
    'छह': 6, 'छः': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10, 'ग्यारह': 11,
    'बारह': 12, 'तेरह': 13, 'चौदह': 14, 'पंद्रह': 15, 'सोलह': 16, 'सत्रह': 17,
    'अठारह': 18, 'उन्नीस': 19, 'बीस': 20, 'तीस': 30, 'चालीस': 40, 'पचास': 50,
    'सौ': 100, 'आधा': 0.5, 'आधी': 0.5, 'दर्जन': 12, 'कुछ': 3,
    // Romanised (common in en-IN transcripts of Hinglish)
    ek: 1, do: 2, teen: 3, char: 4, chaar: 4, panch: 5, paanch: 5, chhe: 6,
    chah: 6, saat: 7, aath: 8, nau: 9, das: 10, barah: 12, bees: 20,
    aadha: 0.5, aadhi: 0.5, darjan: 12
  },
  es: {
    cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
    seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
    trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
    dieciocho: 18, diecinueve: 19, veinte: 20, treinta: 30, cuarenta: 40,
    cincuenta: 50, cien: 100, medio: 0.5, media: 0.5, docena: 12,
    par: 2, unos: 3, algunas: 3, algunos: 3
  },
  fr: {
    zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6,
    sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13,
    quatorze: 14, quinze: 15, seize: 16, vingt: 20, trente: 30, quarante: 40,
    cinquante: 50, cent: 100, demi: 0.5, demie: 0.5, douzaine: 12,
    paire: 2, quelques: 3
  }
};

/**
 * Multiword phrases resolved before single-token lookup, written as plain
 * strings and compiled below.
 *
 * They are NOT written as /\bfoo\b/ literals on purpose: JavaScript's \b is
 * defined against the ASCII \w class, so "\bआधा" can never match at the start
 * of a string — every Devanagari phrase would silently fall through to
 * single-token lookup and "आधा दर्जन" would become "0.5 12" instead of "6".
 */
const PHRASE_SOURCE = {
  en: [
    ['half a dozen', '6'],
    ['half dozen', '6'],
    ['a dozen', '12'],
    ['two dozen', '24'],
    ['a couple of', '2'],
    ['a couple', '2'],
    ['a few', '3'],
    ['a pair of', '2'],
    ['one and a half', '1.5'],
    ['two and a half', '2.5'],
    ['half a', '0.5']
  ],
  hi: [
    ['आधा दर्जन', '6'],
    ['एक दर्जन', '12'],
    ['डेढ़', '1.5'],
    ['ढाई', '2.5'],
    ['aadha darjan', '6'],
    ['ek darjan', '12'],
    ['dedh', '1.5']
  ],
  es: [
    ['media docena', '6'],
    ['una docena', '12'],
    ['un par de', '2'],
    ['un par', '2'],
    ['medio kilo', '0.5 kilo'],
    ['uno y medio', '1.5']
  ],
  fr: [
    ['une demi douzaine', '6'],
    ['une demi-douzaine', '6'],
    ['une douzaine', '12'],
    ['une paire de', '2'],
    ['un demi kilo', '0.5 kilo'],
    ['un demi-kilo', '0.5 kilo'],
    ['un et demi', '1.5']
  ]
};

/** Escape a literal for RegExp use (kept local so numbers.js stays standalone). */
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compile a phrase with Unicode-aware word boundaries: the match may not be
 * preceded or followed by another letter, mark or digit, in any script.
 */
function phraseRegex(phrase) {
  return new RegExp(
    `(?<![\\p{L}\\p{M}\\p{N}])${escapeRegex(phrase)}(?![\\p{L}\\p{M}\\p{N}])`,
    'gu'
  );
}

/** Longest phrases first, so "a couple of" wins over "a couple". */
const PHRASES = Object.fromEntries(
  Object.entries(PHRASE_SOURCE).map(([lang, pairs]) => [
    lang,
    [...pairs]
      .sort((a, b) => b[0].length - a[0].length)
      .map(([phrase, replacement]) => [phraseRegex(phrase), replacement])
  ])
);

/** English tens that combine with a following unit ("twenty five"). */
const EN_TENS = new Set(['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']);

/**
 * Numeric value of a single token, or null.
 *
 * Falls back to the English table because recognisers frequently emit English
 * numerals inside otherwise non-English speech.
 */
export function wordToNumber(token, lang = 'en') {
  if (token === '') return null;

  // Plain digits, including decimals.
  if (/^\d+(\.\d+)?$/.test(token)) return Number(token);

  const table = WORDS[lang] || WORDS.en;
  if (Object.prototype.hasOwnProperty.call(table, token)) return table[token];
  if (lang !== 'en' && Object.prototype.hasOwnProperty.call(WORDS.en, token)) return WORDS.en[token];

  return null;
}

/** Replace multiword numeric phrases with digits. */
export function expandNumberPhrases(text, lang = 'en') {
  let out = text;
  for (const [pattern, replacement] of PHRASES[lang] || []) {
    out = out.replace(pattern, replacement);
  }
  // English phrases are worth trying everywhere, for the same mixed-language
  // reason wordToNumber falls back to English.
  if (lang !== 'en') {
    for (const [pattern, replacement] of PHRASES.en) out = out.replace(pattern, replacement);
  }
  return out;
}

/**
 * Rewrite every spoken numeral in `text` as digits.
 *
 * "add twenty five apples"  -> "add 25 apples"
 * "दो लीटर दूध"             -> "2 लीटर दूध"
 *
 * @param {string} text normalised text
 * @param {string} lang language code
 * @returns {string}
 */
export function digitizeNumbers(text, lang = 'en') {
  const expanded = expandNumberPhrases(text, lang);
  const tokens = expanded.split(' ');
  const out = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const value = wordToNumber(token, lang);

    if (value === null) {
      out.push(token);
      continue;
    }

    // "twenty five" -> 25. Only tens followed by a 1-9 unit combine; "twenty
    // twenty" is not a number a shopper means.
    if (EN_TENS.has(token)) {
      const next = wordToNumber(tokens[i + 1], lang);
      if (next !== null && next >= 1 && next <= 9 && Number.isInteger(next)) {
        out.push(String(value + next));
        i += 1;
        continue;
      }
    }

    // "two hundred" -> 200.
    const following = tokens[i + 1];
    if (following && wordToNumber(following, lang) === 100 && value >= 1 && value <= 99) {
      out.push(String(value * 100));
      i += 1;
      continue;
    }

    out.push(String(value));
  }

  return out.join(' ');
}

/**
 * First quantity mentioned in the text, with the span it occupied so the
 * caller can cut it out before matching a product name.
 *
 * @returns {{ value: number, index: number, length: number } | null}
 */
export function extractQuantity(text, lang = 'en') {
  const digitized = digitizeNumbers(text, lang);
  const match = digitized.match(/(?:^|\s)(\d+(?:\.\d+)?)(?=\s|$)/);
  if (!match) return null;

  const value = Number(match[1]);
  // A "quantity" of zero is almost always a misrecognition, not an intent.
  if (!Number.isFinite(value) || value <= 0) return null;

  return {
    value,
    index: match.index + (match[0].length - match[1].length),
    length: match[1].length,
    text: digitized
  };
}
