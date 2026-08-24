/**
 * Text normalisation — the first stage of the NLP pipeline.
 *
 * Speech recognisers return wildly inconsistent text: trailing punctuation,
 * contractions, filler words, smart quotes, and digits in the local numeral
 * system. Everything downstream (grammar matching, product lookup) assumes a
 * single clean shape, and this module is what guarantees it.
 *
 * Diacritics are folded for Latin scripts so "plátano" matches "platano", but
 * Devanagari is left intact — decomposing it would destroy the vowel signs
 * that distinguish words.
 */

/** Contractions the recogniser emits that the grammar would otherwise miss. */
const CONTRACTIONS = [
  [/\bi'?d like to\b/g, 'i would like to'],
  [/\bi'?d like\b/g, 'i would like'],
  [/\bi'?ve got\b/g, 'i have got'],
  [/\bi'?ve\b/g, 'i have'],
  [/\bi'?m\b/g, 'i am'],
  [/\blet'?s\b/g, 'let us'],
  [/\bwe'?re\b/g, 'we are'],
  [/\bdon'?t\b/g, 'do not'],
  [/\bdoesn'?t\b/g, 'does not'],
  [/\bwon'?t\b/g, 'will not'],
  [/\bcan'?t\b/g, 'can not'],
  [/\bwanna\b/g, 'want to'],
  [/\bgonna\b/g, 'going to'],
  [/\bgotta\b/g, 'got to'],
  [/\bgimme\b/g, 'give me'],
  [/\bpls\b/g, 'please'],
  [/\bplz\b/g, 'please']
];

/**
 * Discourse fillers that carry no meaning. Removed only as whole words, and
 * only after intent matching would have seen them — see stripFillers().
 */
const FILLERS = {
  en: ['um', 'uh', 'er', 'hmm', 'like', 'well', 'okay', 'ok', 'so', 'just', 'please', 'kindly', 'actually', 'basically'],
  hi: ['अरे', 'यार', 'ज़रा', 'जरा', 'please', 'plz', 'बस'],
  es: ['eh', 'este', 'pues', 'bueno', 'vale', 'porfa', 'por favor'],
  fr: ['euh', 'ben', 'bon', 'alors', 'donc', 'quoi', 's\'il te plaît', 's\'il vous plaît']
};

/** Devanagari and Arabic-Indic digits mapped to ASCII. */
const DIGIT_MAP = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
};

/** Convert any supported numeral system to ASCII digits. */
function asciiDigits(text) {
  return text.replace(/[०-९٠-٩]/g, (d) => DIGIT_MAP[d] || d);
}

/**
 * Fold Latin diacritics to their base letters, leaving non-Latin scripts alone.
 *
 * NFD splits "á" into "a" + combining acute; we then drop the combining marks
 * only where the base character is Latin, so Devanagari matras survive.
 */
function foldDiacritics(text) {
  return text
    .normalize('NFD')
    .replace(/([A-Za-z])[̀-ͯ]+/g, '$1')
    .normalize('NFC');
}

/**
 * Canonical form used for matching: lowercase, ASCII digits, folded accents,
 * expanded contractions, no punctuation, single-spaced.
 *
 * @param {string} text raw transcript
 * @returns {string}
 */
export function normalize(text) {
  if (typeof text !== 'string') return '';

  let out = text.toLowerCase().trim();

  // Smart punctuation the recogniser and mobile keyboards both produce.
  out = out.replace(/[‘’‛]/g, "'").replace(/[“”]/g, '"');

  out = asciiDigits(out);
  out = foldDiacritics(out);

  for (const [pattern, replacement] of CONTRACTIONS) {
    out = out.replace(pattern, replacement);
  }

  // Keep digits, letters of any script, combining marks, spaces, decimal
  // points between digits, and hyphens (which join compounds like
  // "sugar-free").
  //
  // \p{M} is not optional: Devanagari vowel signs are marks rather than
  // letters, so omitting it silently strips "दूध" down to "द ध".
  out = out.replace(/(\d)[.,](\d)/g, '$1<DOT>$2');
  out = out.replace(/[^\p{L}\p{M}\p{N}\s<>-]+/gu, ' ');
  out = out.replace(/<DOT>/g, '.');

  // Currency and percent symbols were stripped above; the grammar reads the
  // spoken words ("dollars", "rupees") instead, so nothing is lost.
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Remove filler words. Applied after intent detection so a filler can never
 * swallow a keyword, but before product matching so "um, milk" still matches.
 *
 * @param {string} text  already normalised text
 * @param {string} lang  language code
 */
export function stripFillers(text, lang = 'en') {
  const words = FILLERS[lang] || FILLERS.en;
  let out = text;
  for (const word of words) {
    out = out.replace(new RegExp(`(^|\\s)${escapeRegex(word)}(?=\\s|$)`, 'gu'), '$1');
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Escape a literal string for safe use inside a RegExp. */
export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Split a compound utterance into independent clauses.
 *
 * "add milk and remove bread" has to become two commands, but "add salt and
 * pepper" must not — so we only split on a conjunction when the text that
 * follows starts with its own action verb.
 *
 * @param {string} text            normalised text
 * @param {string[]} actionVerbs   verbs that legitimately start a new command
 * @returns {string[]}
 */
export function splitClauses(text, actionVerbs = []) {
  if (!actionVerbs.length) return [text];

  const verbs = actionVerbs.map(escapeRegex).join('|');
  // Split before a conjunction (or sentence break) that is followed by a verb.
  const pattern = new RegExp(`\\s*(?:,|;|\\band\\b|\\bthen\\b|\\balso\\b)\\s+(?=(?:${verbs})\\b)`, 'giu');

  return text
    .split(pattern)
    .map((clause) => clause.trim())
    .filter(Boolean);
}
