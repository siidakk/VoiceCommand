/**
 * Intent grammar.
 *
 * Rather than hand-writing regexes per language, intents are declared as
 * templates in a tiny DSL and compiled once at module load:
 *
 *   'add {x} to my list'   ->  /^add\s+(?<x>.+?)\s+to\s+my\s+list$/iu
 *   'change {x} to {n}'    ->  /^change\s+(?<x>.+?)\s+to\s+(?<n>\d+(\.\d+)?)$/iu
 *
 * Placeholders
 *   {x}  free-text payload (product name, search phrase)
 *   {n}  a number
 *
 * Disambiguation is by specificity: every template is sorted by how much
 * literal text it contains, longest first. That single rule is what makes
 * "i do not need milk" resolve to REMOVE rather than ADD, and "show me my
 * list" to READ_LIST rather than SEARCH, without any hand-tuned precedence.
 */

import { escapeRegex } from './normalize.js';

/** Every intent the assistant can act on. */
export const INTENTS = {
  ADD: 'add',
  REMOVE: 'remove',
  UPDATE_QTY: 'update_qty',
  MARK_BOUGHT: 'mark_bought',
  CLEAR: 'clear',
  READ_LIST: 'read_list',
  SEARCH: 'search',
  SUGGEST: 'suggest',
  SUBSTITUTE: 'substitute',
  UNDO: 'undo',
  HELP: 'help',
  UNKNOWN: 'unknown'
};

/**
 * Templates per language, written in normalised form — lowercase, accents
 * folded, contractions expanded — because that is what the grammar is matched
 * against. "añade" is therefore written "anade", "j'ai" as "j ai".
 */
const TEMPLATES = {
  en: [
    // ---- update quantity (before add: "change milk to 3" is not an add) ----
    [INTENTS.UPDATE_QTY, 'change {x} to {n}'],
    [INTENTS.UPDATE_QTY, 'update {x} to {n}'],
    [INTENTS.UPDATE_QTY, 'set {x} to {n}'],
    [INTENTS.UPDATE_QTY, 'make {x} {n}'],
    [INTENTS.UPDATE_QTY, 'change the quantity of {x} to {n}'],
    [INTENTS.UPDATE_QTY, 'i need {n} of the {x}'],

    // ------------------------------------------------------------- remove ---
    [INTENTS.REMOVE, 'remove {x} from my list'],
    [INTENTS.REMOVE, 'remove {x} from the list'],
    [INTENTS.REMOVE, 'delete {x} from my list'],
    [INTENTS.REMOVE, 'take {x} off my list'],
    [INTENTS.REMOVE, 'take {x} off the list'],
    [INTENTS.REMOVE, 'get rid of {x}'],
    [INTENTS.REMOVE, 'i do not need {x}'],
    [INTENTS.REMOVE, 'we do not need {x}'],
    [INTENTS.REMOVE, 'do not need {x}'],
    [INTENTS.REMOVE, 'no more {x}'],
    [INTENTS.REMOVE, 'take off {x}'],
    [INTENTS.REMOVE, 'remove {x}'],
    [INTENTS.REMOVE, 'delete {x}'],
    [INTENTS.REMOVE, 'cancel {x}'],
    [INTENTS.REMOVE, 'erase {x}'],
    [INTENTS.REMOVE, 'drop {x}'],

    // -------------------------------------------------------- mark bought ---
    [INTENTS.MARK_BOUGHT, 'mark {x} as bought'],
    [INTENTS.MARK_BOUGHT, 'mark {x} as done'],
    [INTENTS.MARK_BOUGHT, 'mark {x} done'],
    [INTENTS.MARK_BOUGHT, 'check off {x}'],
    [INTENTS.MARK_BOUGHT, 'tick off {x}'],
    [INTENTS.MARK_BOUGHT, 'i have got {x}'],
    [INTENTS.MARK_BOUGHT, 'i already have {x}'],
    [INTENTS.MARK_BOUGHT, 'i bought {x}'],
    [INTENTS.MARK_BOUGHT, 'i got {x}'],

    // ------------------------------------------------------------- clear ----
    [INTENTS.CLEAR, 'clear my shopping list'],
    [INTENTS.CLEAR, 'clear the shopping list'],
    [INTENTS.CLEAR, 'clear everything'],
    [INTENTS.CLEAR, 'clear my list'],
    [INTENTS.CLEAR, 'clear the list'],
    [INTENTS.CLEAR, 'empty my list'],
    [INTENTS.CLEAR, 'empty the list'],
    [INTENTS.CLEAR, 'delete everything'],
    [INTENTS.CLEAR, 'remove everything'],
    [INTENTS.CLEAR, 'start a new list'],
    [INTENTS.CLEAR, 'start over'],
    [INTENTS.CLEAR, 'reset the list'],
    [INTENTS.CLEAR, 'clear list'],
    [INTENTS.CLEAR, 'new list'],

    // ---------------------------------------------------------- read list ---
    [INTENTS.READ_LIST, 'what is on my shopping list'],
    [INTENTS.READ_LIST, 'what is on my list'],
    [INTENTS.READ_LIST, 'what is on the list'],
    [INTENTS.READ_LIST, 'what do i have on my list'],
    [INTENTS.READ_LIST, 'how many items do i have'],
    [INTENTS.READ_LIST, 'show me my list'],
    [INTENTS.READ_LIST, 'read my list'],
    [INTENTS.READ_LIST, 'read the list'],
    [INTENTS.READ_LIST, 'show my list'],
    [INTENTS.READ_LIST, 'my list'],

    // ----------------------------------------------------------- suggest ----
    [INTENTS.SUGGEST, 'what should i buy'],
    [INTENTS.SUGGEST, 'what do i need'],
    [INTENTS.SUGGEST, 'what am i missing'],
    [INTENTS.SUGGEST, 'give me some suggestions'],
    [INTENTS.SUGGEST, 'give me suggestions'],
    [INTENTS.SUGGEST, 'any suggestions'],
    [INTENTS.SUGGEST, 'suggest something'],
    [INTENTS.SUGGEST, 'recommend something'],
    [INTENTS.SUGGEST, 'what is in season'],
    [INTENTS.SUGGEST, 'what is on sale'],
    [INTENTS.SUGGEST, 'suggestions'],

    // -------------------------------------------------------- substitute ----
    [INTENTS.SUBSTITUTE, 'what can i use instead of {x}'],
    [INTENTS.SUBSTITUTE, 'what can i have instead of {x}'],
    [INTENTS.SUBSTITUTE, 'something else instead of {x}'],
    [INTENTS.SUBSTITUTE, 'alternatives to {x}'],
    [INTENTS.SUBSTITUTE, 'alternative to {x}'],
    [INTENTS.SUBSTITUTE, 'substitute for {x}'],
    [INTENTS.SUBSTITUTE, 'instead of {x}'],
    [INTENTS.SUBSTITUTE, 'replace {x}'],
    [INTENTS.SUBSTITUTE, 'swap {x}'],

    // ------------------------------------------------------------ search ----
    [INTENTS.SEARCH, 'how much does {x} cost'],
    [INTENTS.SEARCH, 'do you have any {x}'],
    [INTENTS.SEARCH, 'search for {x}'],
    [INTENTS.SEARCH, 'look for {x}'],
    [INTENTS.SEARCH, 'do you have {x}'],
    [INTENTS.SEARCH, 'how much is {x}'],
    [INTENTS.SEARCH, 'the price of {x}'],
    [INTENTS.SEARCH, 'price of {x}'],
    [INTENTS.SEARCH, 'show me {x}'],
    [INTENTS.SEARCH, 'find me {x}'],
    [INTENTS.SEARCH, 'is there {x}'],
    [INTENTS.SEARCH, 'search {x}'],
    [INTENTS.SEARCH, 'find {x}'],

    // --------------------------------------------------------------- add ----
    [INTENTS.ADD, 'i would like to buy {x}'],
    [INTENTS.ADD, 'i want to buy {x}'],
    [INTENTS.ADD, 'do not forget {x}'],
    [INTENTS.ADD, 'i would like {x}'],
    [INTENTS.ADD, 'add {x} to my shopping list'],
    [INTENTS.ADD, 'add {x} to my list'],
    [INTENTS.ADD, 'add {x} to the list'],
    [INTENTS.ADD, 'put {x} on my list'],
    [INTENTS.ADD, 'put {x} on the list'],
    [INTENTS.ADD, 'we are out of {x}'],
    [INTENTS.ADD, 'i am out of {x}'],
    [INTENTS.ADD, 'running low on {x}'],
    [INTENTS.ADD, 'we are running low on {x}'],
    [INTENTS.ADD, 'i have run out of {x}'],
    [INTENTS.ADD, 'we need to get {x}'],
    [INTENTS.ADD, 'i need to get {x}'],
    [INTENTS.ADD, 'out of {x}'],
    [INTENTS.ADD, 'pick up {x}'],
    [INTENTS.ADD, 'throw in {x}'],
    [INTENTS.ADD, 'remember {x}'],
    [INTENTS.ADD, 'include {x}'],
    [INTENTS.ADD, 'i want {x}'],
    [INTENTS.ADD, 'we need {x}'],
    [INTENTS.ADD, 'i need {x}'],
    [INTENTS.ADD, 'add {x}'],
    [INTENTS.ADD, 'buy {x}'],
    [INTENTS.ADD, 'get {x}'],
    [INTENTS.ADD, 'grab {x}'],
    [INTENTS.ADD, 'need {x}'],

    // ---------------------------------------------------------- misc ---------
    [INTENTS.UNDO, 'undo that'],
    [INTENTS.UNDO, 'undo'],
    [INTENTS.UNDO, 'go back'],
    [INTENTS.UNDO, 'revert that'],
    [INTENTS.HELP, 'what can i say'],
    [INTENTS.HELP, 'how does this work'],
    [INTENTS.HELP, 'commands'],
    [INTENTS.HELP, 'help me'],
    [INTENTS.HELP, 'help']
  ],

  hi: [
    [INTENTS.UPDATE_QTY, '{x} {n} कर दो'],
    [INTENTS.UPDATE_QTY, '{x} ko {n} kar do'],

    [INTENTS.REMOVE, '{x} सूची से हटाओ'],
    [INTENTS.REMOVE, '{x} लिस्ट से हटाओ'],
    [INTENTS.REMOVE, '{x} हटा दो'],
    [INTENTS.REMOVE, '{x} निकाल दो'],
    [INTENTS.REMOVE, '{x} नहीं चाहिए'],
    [INTENTS.REMOVE, '{x} मत लो'],
    [INTENTS.REMOVE, '{x} हटाओ'],
    [INTENTS.REMOVE, '{x} निकालो'],
    [INTENTS.REMOVE, '{x} list se hatao'],
    [INTENTS.REMOVE, '{x} hata do'],
    [INTENTS.REMOVE, '{x} nahi chahiye'],
    [INTENTS.REMOVE, '{x} hatao'],
    [INTENTS.REMOVE, '{x} nikalo'],

    [INTENTS.CLEAR, 'पूरी सूची साफ़ करो'],
    [INTENTS.CLEAR, 'सूची साफ़ करो'],
    [INTENTS.CLEAR, 'लिस्ट साफ़ करो'],
    [INTENTS.CLEAR, 'सब कुछ हटा दो'],
    [INTENTS.CLEAR, 'सब हटा दो'],
    [INTENTS.CLEAR, 'नई सूची'],
    [INTENTS.CLEAR, 'list saaf karo'],
    [INTENTS.CLEAR, 'sab hata do'],

    [INTENTS.READ_LIST, 'मेरी सूची में क्या है'],
    [INTENTS.READ_LIST, 'लिस्ट में क्या है'],
    [INTENTS.READ_LIST, 'मेरी सूची पढ़ो'],
    [INTENTS.READ_LIST, 'मेरी लिस्ट दिखाओ'],
    [INTENTS.READ_LIST, 'सूची दिखाओ'],
    [INTENTS.READ_LIST, 'list mein kya hai'],
    [INTENTS.READ_LIST, 'meri list dikhao'],

    [INTENTS.SUGGEST, 'मुझे क्या खरीदना चाहिए'],
    [INTENTS.SUGGEST, 'क्या खरीदूं'],
    [INTENTS.SUGGEST, 'कुछ सुझाव दो'],
    [INTENTS.SUGGEST, 'सुझाव दो'],
    [INTENTS.SUGGEST, 'kya kharidun'],
    [INTENTS.SUGGEST, 'sujhav do'],

    [INTENTS.MARK_BOUGHT, '{x} खरीद लिया'],
    [INTENTS.MARK_BOUGHT, '{x} ले लिया'],
    [INTENTS.MARK_BOUGHT, '{x} kharid liya'],
    [INTENTS.MARK_BOUGHT, '{x} le liya'],

    [INTENTS.SUBSTITUTE, '{x} की जगह क्या ले सकते हैं'],
    [INTENTS.SUBSTITUTE, '{x} की जगह क्या'],
    [INTENTS.SUBSTITUTE, '{x} का विकल्प'],
    [INTENTS.SUBSTITUTE, '{x} ki jagah kya'],

    [INTENTS.SEARCH, '{x} की कीमत क्या है'],
    [INTENTS.SEARCH, '{x} कितने का है'],
    [INTENTS.SEARCH, '{x} ढूंढो'],
    [INTENTS.SEARCH, '{x} खोजो'],
    [INTENTS.SEARCH, '{x} dhundo'],
    [INTENTS.SEARCH, '{x} khojo'],

    [INTENTS.ADD, 'मुझे {x} चाहिए'],
    [INTENTS.ADD, '{x} सूची में डालो'],
    [INTENTS.ADD, '{x} लिस्ट में डालो'],
    [INTENTS.ADD, '{x} खरीदना है'],
    [INTENTS.ADD, '{x} लेना है'],
    [INTENTS.ADD, '{x} जोड़ दो'],
    [INTENTS.ADD, '{x} डाल दो'],
    [INTENTS.ADD, '{x} चाहिए'],
    [INTENTS.ADD, '{x} जोड़ो'],
    [INTENTS.ADD, '{x} डालो'],
    [INTENTS.ADD, '{x} ख़त्म हो गया'],
    [INTENTS.ADD, 'mujhe {x} chahiye'],
    [INTENTS.ADD, '{x} list mein dalo'],
    [INTENTS.ADD, '{x} kharidna hai'],
    [INTENTS.ADD, '{x} chahiye'],
    [INTENTS.ADD, '{x} jodo'],
    [INTENTS.ADD, '{x} dalo'],

    [INTENTS.UNDO, 'वापस'],
    [INTENTS.UNDO, 'wapas'],
    [INTENTS.HELP, 'मदद'],
    [INTENTS.HELP, 'madad']
  ],

  es: [
    [INTENTS.UPDATE_QTY, 'cambia {x} a {n}'],
    [INTENTS.UPDATE_QTY, 'pon {n} de {x}'],

    [INTENTS.REMOVE, 'quita {x} de mi lista'],
    [INTENTS.REMOVE, 'elimina {x} de la lista'],
    [INTENTS.REMOVE, 'ya no necesito {x}'],
    [INTENTS.REMOVE, 'ya no quiero {x}'],
    [INTENTS.REMOVE, 'eliminar {x}'],
    [INTENTS.REMOVE, 'elimina {x}'],
    [INTENTS.REMOVE, 'quitar {x}'],
    [INTENTS.REMOVE, 'borrar {x}'],
    [INTENTS.REMOVE, 'quita {x}'],
    [INTENTS.REMOVE, 'borra {x}'],
    [INTENTS.REMOVE, 'saca {x}'],

    [INTENTS.CLEAR, 'borra toda la lista'],
    [INTENTS.CLEAR, 'vacia la lista'],
    [INTENTS.CLEAR, 'borra la lista'],
    [INTENTS.CLEAR, 'limpia la lista'],
    [INTENTS.CLEAR, 'borrar todo'],
    [INTENTS.CLEAR, 'empezar de nuevo'],
    [INTENTS.CLEAR, 'lista nueva'],

    [INTENTS.READ_LIST, 'que hay en mi lista'],
    [INTENTS.READ_LIST, 'que tengo en la lista'],
    [INTENTS.READ_LIST, 'muestrame mi lista'],
    [INTENTS.READ_LIST, 'lee mi lista'],
    [INTENTS.READ_LIST, 'muestra mi lista'],
    [INTENTS.READ_LIST, 'mi lista'],

    [INTENTS.SUGGEST, 'que deberia comprar'],
    [INTENTS.SUGGEST, 'recomiendame algo'],
    [INTENTS.SUGGEST, 'que me falta'],
    [INTENTS.SUGGEST, 'dame sugerencias'],
    [INTENTS.SUGGEST, 'sugerencias'],

    [INTENTS.MARK_BOUGHT, 'marca {x} como comprado'],
    [INTENTS.MARK_BOUGHT, 'ya compre {x}'],
    [INTENTS.MARK_BOUGHT, 'ya tengo {x}'],

    [INTENTS.SUBSTITUTE, 'que puedo usar en lugar de {x}'],
    [INTENTS.SUBSTITUTE, 'alternativa a {x}'],
    [INTENTS.SUBSTITUTE, 'sustituto de {x}'],
    [INTENTS.SUBSTITUTE, 'en lugar de {x}'],
    [INTENTS.SUBSTITUTE, 'en vez de {x}'],

    [INTENTS.SEARCH, 'cuanto cuesta {x}'],
    [INTENTS.SEARCH, 'muestrame {x}'],
    [INTENTS.SEARCH, 'encuentra {x}'],
    [INTENTS.SEARCH, 'buscar {x}'],
    [INTENTS.SEARCH, 'busca {x}'],

    [INTENTS.ADD, 'quiero comprar {x}'],
    [INTENTS.ADD, 'pon {x} en la lista'],
    [INTENTS.ADD, 'agregar {x} a la lista'],
    [INTENTS.ADD, 'se nos acabo {x}'],
    [INTENTS.ADD, 'se me acabo {x}'],
    [INTENTS.ADD, 'hace falta {x}'],
    [INTENTS.ADD, 'me falta {x}'],
    [INTENTS.ADD, 'necesito {x}'],
    [INTENTS.ADD, 'anadir {x}'],
    [INTENTS.ADD, 'agregar {x}'],
    [INTENTS.ADD, 'comprar {x}'],
    [INTENTS.ADD, 'agrega {x}'],
    [INTENTS.ADD, 'anade {x}'],
    [INTENTS.ADD, 'quiero {x}'],
    [INTENTS.ADD, 'compra {x}'],

    [INTENTS.UNDO, 'deshacer'],
    [INTENTS.HELP, 'ayuda']
  ],

  fr: [
    [INTENTS.UPDATE_QTY, 'change {x} en {n}'],
    [INTENTS.UPDATE_QTY, 'mets {n} {x}'],

    [INTENTS.REMOVE, 'je n ai plus besoin de {x}'],
    [INTENTS.REMOVE, 'retire {x} de ma liste'],
    [INTENTS.REMOVE, 'supprime {x} de la liste'],
    [INTENTS.REMOVE, 'supprimer {x}'],
    [INTENTS.REMOVE, 'supprime {x}'],
    [INTENTS.REMOVE, 'retirer {x}'],
    [INTENTS.REMOVE, 'retire {x}'],
    [INTENTS.REMOVE, 'enleve {x}'],
    [INTENTS.REMOVE, 'efface {x}'],

    [INTENTS.CLEAR, 'vide toute la liste'],
    [INTENTS.CLEAR, 'efface la liste'],
    [INTENTS.CLEAR, 'vide la liste'],
    [INTENTS.CLEAR, 'supprime tout'],
    [INTENTS.CLEAR, 'nouvelle liste'],
    [INTENTS.CLEAR, 'recommencer'],

    [INTENTS.READ_LIST, 'qu est ce qu il y a sur ma liste'],
    [INTENTS.READ_LIST, 'qu y a t il sur ma liste'],
    [INTENTS.READ_LIST, 'montre moi ma liste'],
    [INTENTS.READ_LIST, 'montre ma liste'],
    [INTENTS.READ_LIST, 'lis ma liste'],
    [INTENTS.READ_LIST, 'ma liste'],

    [INTENTS.SUGGEST, 'que dois je acheter'],
    [INTENTS.SUGGEST, 'recommande moi quelque chose'],
    [INTENTS.SUGGEST, 'des suggestions'],
    [INTENTS.SUGGEST, 'suggestions'],

    [INTENTS.MARK_BOUGHT, 'marque {x} comme achete'],
    [INTENTS.MARK_BOUGHT, 'j ai deja {x}'],
    [INTENTS.MARK_BOUGHT, 'j ai achete {x}'],

    [INTENTS.SUBSTITUTE, 'qu est ce que je peux prendre a la place de {x}'],
    [INTENTS.SUBSTITUTE, 'a la place de {x}'],
    [INTENTS.SUBSTITUTE, 'alternative a {x}'],
    [INTENTS.SUBSTITUTE, 'remplacer {x}'],

    [INTENTS.SEARCH, 'combien coute {x}'],
    [INTENTS.SEARCH, 'montre moi {x}'],
    [INTENTS.SEARCH, 'chercher {x}'],
    [INTENTS.SEARCH, 'cherche {x}'],
    [INTENTS.SEARCH, 'trouver {x}'],
    [INTENTS.SEARCH, 'trouve {x}'],

    [INTENTS.ADD, 'j ai besoin de {x}'],
    [INTENTS.ADD, 'on a besoin de {x}'],
    [INTENTS.ADD, 'mets {x} sur la liste'],
    [INTENTS.ADD, 'ajoute {x} a la liste'],
    [INTENTS.ADD, 'il me faut {x}'],
    [INTENTS.ADD, 'je voudrais {x}'],
    [INTENTS.ADD, 'on n a plus de {x}'],
    [INTENTS.ADD, 'je veux {x}'],
    [INTENTS.ADD, 'ajouter {x}'],
    [INTENTS.ADD, 'acheter {x}'],
    [INTENTS.ADD, 'ajoute {x}'],
    [INTENTS.ADD, 'achete {x}'],
    [INTENTS.ADD, 'prends {x}'],

    [INTENTS.UNDO, 'annuler'],
    [INTENTS.HELP, 'aide']
  ]
};

/**
 * Compile one template into an anchored regex with named capture groups.
 *
 * Literal whitespace becomes \s+ so extra pauses in the transcript ("add   two
 * apples") still match, and the whole pattern is anchored so a template can
 * never match a fragment in the middle of an unrelated sentence.
 */
function compileTemplate(template) {
  const source = template
    .trim()
    .split(/\s+/)
    .map((token) => {
      if (token === '{x}') return '(?<x>.+?)';
      if (token === '{n}') return '(?<n>\\d+(?:\\.\\d+)?)';
      return escapeRegex(token);
    })
    // Words may be joined by a hyphen as well as a space. French inverts and
    // hyphenates its questions ("que dois-je acheter"), and normalisation
    // keeps hyphens because they are meaningful inside compounds like
    // "sugar-free" — so the separator has to accept both.
    .join('[\\s-]+');

  return new RegExp(`^\\s*${source}\\s*$`, 'iu');
}

/** Literal (non-placeholder) character count — the specificity score. */
function specificity(template) {
  return template.replace(/\{[xn]\}/g, '').replace(/\s+/g, '').length;
}

/**
 * Compiled rules per language, most specific first.
 * Built once at module load; matching is then a linear scan of ~90 regexes,
 * which is microseconds and needs no caching.
 */
const RULES = Object.fromEntries(
  Object.entries(TEMPLATES).map(([lang, entries]) => [
    lang,
    entries
      .map(([intent, template]) => ({
        intent,
        template,
        weight: specificity(template),
        re: compileTemplate(template)
      }))
      .sort((a, b) => b.weight - a.weight)
  ])
);

/**
 * First matching rule for an utterance.
 *
 * @param {string} text normalised utterance
 * @param {string} lang language code
 * @returns {{ intent: string, payload: string|null, quantity: number|null,
 *             template: string, specificity: number } | null}
 */
export function matchIntent(text, lang = 'en') {
  // Try the spoken language first, then English.
  //
  // The fallback is not padding: code-switching is the norm for many users —
  // an hi-IN recogniser routinely returns "find shampoo under 500 rupees" —
  // and English templates are pure ASCII literals, so they cannot accidentally
  // fire on Devanagari text.
  const chains = lang === 'en' ? [RULES.en] : [RULES[lang] || RULES.en, RULES.en];

  for (const rules of chains) {
    for (const rule of rules) {
      const found = rule.re.exec(text);
      if (!found) continue;

      const groups = found.groups || {};
      return {
        intent: rule.intent,
        payload: groups.x ? groups.x.trim() : null,
        quantity: groups.n !== undefined ? Number(groups.n) : null,
        template: rule.template,
        specificity: rule.weight
      };
    }
  }

  return null;
}

/**
 * Leading verbs that legitimately begin a new command, used by splitClauses to
 * decide whether "and" joins two commands or two product names.
 */
export const ACTION_VERBS = {
  en: ['add', 'remove', 'delete', 'buy', 'get', 'find', 'search', 'i need', 'we need',
    'i want', 'put', 'take', 'clear', 'show', 'read', 'mark', 'check', 'grab', 'pick'],
  hi: ['जोड़ो', 'हटाओ', 'डालो', 'ढूंढो', 'निकालो', 'jodo', 'hatao', 'dalo'],
  es: ['anade', 'agrega', 'quita', 'elimina', 'borra', 'busca', 'compra', 'necesito', 'pon'],
  fr: ['ajoute', 'retire', 'supprime', 'enleve', 'cherche', 'trouve', 'achete', 'mets']
};

/** Number of compiled rules per language, for the diagnostics endpoint. */
export const RULE_COUNTS = Object.fromEntries(
  Object.entries(RULES).map(([lang, rules]) => [lang, rules.length])
);
