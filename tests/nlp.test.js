/**
 * NLP pipeline tests.
 *
 * Uses Node's built-in test runner and assert — no test framework dependency,
 * consistent with the rest of the project.
 *
 *   npm test
 *
 * The cases here are the ones that actually broke during development, kept as
 * regressions: Devanagari surviving normalisation, `\b` not working on
 * non-Latin scripts, "salt and pepper" resolving to the spice, and a stray "s"
 * left behind by a currency word.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { normalize, stripFillers, splitClauses } from '../shared/nlp/normalize.js';
import { digitizeNumbers, extractQuantity, wordToNumber } from '../shared/nlp/numbers.js';
import { extractUnit, removeUnit, unitLabel } from '../shared/nlp/units.js';
import { matchIntent, INTENTS, ACTION_VERBS } from '../shared/nlp/grammar.js';
import { matchProduct, matchProducts, levenshtein, singularize } from '../shared/nlp/matcher.js';
import { parseFilters } from '../shared/nlp/filters.js';
import { parse, parseOne, detectScript } from '../shared/nlp/index.js';

describe('normalize', () => {
  test('lowercases, strips punctuation and collapses whitespace', () => {
    assert.equal(normalize('  Add   2 Bottles of Water!!  '), 'add 2 bottles of water');
  });

  test('expands contractions the grammar depends on', () => {
    assert.equal(normalize("I'd like to buy bananas."), 'i would like to buy bananas');
    assert.equal(normalize("I'm out of milk"), 'i am out of milk');
  });

  test('folds Latin diacritics', () => {
    assert.equal(normalize('Añade plátanos'), 'anade platanos');
    assert.equal(normalize('épinards'), 'epinards');
  });

  test('preserves Devanagari vowel signs', () => {
    // Regression: \p{M} was missing from the allowed character class, which
    // silently reduced "दूध" to "द ध" and broke all Hindi matching.
    assert.equal(normalize('दो लीटर दूध जोड़ो'), 'दो लीटर दूध जोड़ो');
    assert.equal(normalize('मुझे ब्रेड चाहिए'), 'मुझे ब्रेड चाहिए');
  });

  test('converts Devanagari digits to ASCII', () => {
    assert.equal(normalize('३ सेब'), '3 सेब');
  });

  test('keeps decimal points inside numbers', () => {
    assert.equal(normalize('add $4.50 milk'), 'add 4.50 milk');
  });

  test('handles non-string input without throwing', () => {
    assert.equal(normalize(null), '');
    assert.equal(normalize(undefined), '');
    assert.equal(normalize(42), '');
  });
});

describe('stripFillers', () => {
  test('removes discourse fillers only as whole words', () => {
    assert.equal(stripFillers('um well just add milk please', 'en'), 'add milk');
  });

  test('does not eat words that merely contain a filler', () => {
    // "so" inside "soap" must survive.
    assert.equal(stripFillers('soap', 'en'), 'soap');
  });
});

describe('splitClauses', () => {
  const verbs = ACTION_VERBS.en;

  test('splits on a conjunction followed by a verb', () => {
    assert.deepEqual(splitClauses('add milk and remove bread', verbs), ['add milk', 'remove bread']);
  });

  test('does not split a conjunction joining two product names', () => {
    assert.deepEqual(splitClauses('add salt and pepper', verbs), ['add salt and pepper']);
  });

  test('splits on "then"', () => {
    assert.deepEqual(splitClauses('add milk then find toothpaste', verbs), [
      'add milk',
      'find toothpaste'
    ]);
  });
});

describe('numbers', () => {
  test('parses digits and English number words', () => {
    assert.equal(wordToNumber('7'), 7);
    assert.equal(wordToNumber('seven'), 7);
    assert.equal(wordToNumber('nonsense'), null);
  });

  test('composes English tens', () => {
    assert.equal(digitizeNumbers('add twenty five apples'), 'add 25 apples');
    assert.equal(digitizeNumbers('two hundred grams of cheese'), '200 grams of cheese');
  });

  test('resolves multiword quantity phrases', () => {
    assert.equal(digitizeNumbers('half a dozen bananas'), '6 bananas');
    assert.equal(digitizeNumbers('a couple of waters'), '2 waters');
    assert.equal(digitizeNumbers('one and a half kilos of rice'), '1.5 kilos of rice');
  });

  test('resolves Devanagari quantity phrases', () => {
    // Regression: JavaScript's \b is ASCII-only, so /\bआधा दर्जन\b/ could never
    // match and "आधा दर्जन" came out as "0.5 12" instead of "6".
    assert.equal(digitizeNumbers(normalize('आधा दर्जन अंडे'), 'hi'), '6 अंडे');
    assert.equal(digitizeNumbers(normalize('डेढ़ किलो चावल'), 'hi'), '1.5 किलो चावल');
    assert.equal(digitizeNumbers(normalize('दो लीटर दूध'), 'hi'), '2 लीटर दूध');
  });

  test('parses Spanish and French numerals', () => {
    assert.equal(digitizeNumbers(normalize('media docena de huevos'), 'es'), '6 de huevos');
    assert.equal(digitizeNumbers(normalize('une douzaine oeufs'), 'fr'), '12 oeufs');
  });

  test('extractQuantity ignores zero and missing quantities', () => {
    assert.equal(extractQuantity('add apples'), null);
    assert.equal(extractQuantity('add 0 apples'), null);
    assert.equal(extractQuantity('add 3 apples').value, 3);
  });
});

describe('units', () => {
  test('recognises measures and containers', () => {
    assert.equal(extractUnit('2 litres of milk').unit, 'l');
    assert.equal(extractUnit('2 litres of milk').kind, 'measure');
    assert.equal(extractUnit('3 bottles of water').unit, 'bottle');
    assert.equal(extractUnit('3 bottles of water').kind, 'container');
  });

  test('does not mistake an adjective for a unit', () => {
    // "canned tomatoes" contains "can" but is not a quantity of cans.
    assert.equal(extractUnit('add canned tomatoes'), null);
  });

  test('removes the unit and its preposition from the phrase', () => {
    const text = 'add 2 bottles of water';
    assert.equal(removeUnit(text, extractUnit(text)), 'add 2 water');
  });

  test('pluralises English and translates other languages', () => {
    assert.equal(unitLabel('loaf', 2, 'en'), 'loaves');
    assert.equal(unitLabel('loaf', 1, 'en'), 'loaf');
    assert.equal(unitLabel('l', 2, 'hi'), 'लीटर');
    assert.equal(unitLabel('loaf', 1, 'es'), 'barra');
    assert.equal(unitLabel('loaf', 3, 'es'), 'barras');
  });
});

describe('grammar', () => {
  const intentOf = (text, lang = 'en') => (matchIntent(normalize(text), lang) || {}).intent;

  test('recognises the core English intents', () => {
    assert.equal(intentOf('add milk'), INTENTS.ADD);
    assert.equal(intentOf('I need apples'), INTENTS.ADD);
    assert.equal(intentOf('I want to buy bananas'), INTENTS.ADD);
    assert.equal(intentOf('remove milk from my list'), INTENTS.REMOVE);
    assert.equal(intentOf('clear my list'), INTENTS.CLEAR);
    assert.equal(intentOf('what is on my list'), INTENTS.READ_LIST);
    assert.equal(intentOf('find toothpaste'), INTENTS.SEARCH);
    assert.equal(intentOf('what should i buy'), INTENTS.SUGGEST);
    assert.equal(intentOf('undo'), INTENTS.UNDO);
    assert.equal(intentOf('help'), INTENTS.HELP);
  });

  test('specificity beats keyword order', () => {
    // "i do not need X" contains "need X" but must not be an add.
    assert.equal(intentOf('i do not need bread'), INTENTS.REMOVE);
    // "show me my list" contains "show me X" but must not be a search.
    assert.equal(intentOf('show me my list'), INTENTS.READ_LIST);
    assert.equal(intentOf('show me apples'), INTENTS.SEARCH);
  });

  test('captures the quantity in an update', () => {
    const match = matchIntent(normalize('change milk to 3'), 'en');
    assert.equal(match.intent, INTENTS.UPDATE_QTY);
    assert.equal(match.quantity, 3);
    assert.equal(match.payload, 'milk');
  });

  test('recognises intents in every supported language', () => {
    assert.equal(intentOf('दूध जोड़ो', 'hi'), INTENTS.ADD);
    assert.equal(intentOf('दूध हटाओ', 'hi'), INTENTS.REMOVE);
    assert.equal(intentOf('anade leche', 'es'), INTENTS.ADD);
    assert.equal(intentOf('quita la leche', 'es'), INTENTS.REMOVE);
    assert.equal(intentOf('ajoute du lait', 'fr'), INTENTS.ADD);
    assert.equal(intentOf('retire le lait', 'fr'), INTENTS.REMOVE);
  });

  test('falls back to English rules for code-switched speech', () => {
    // hi-IN recognisers routinely return English words.
    assert.equal(intentOf('find shampoo', 'hi'), INTENTS.SEARCH);
  });
});

describe('matcher', () => {
  test('levenshtein basics and early exit', () => {
    assert.equal(levenshtein('milk', 'milk'), 0);
    assert.equal(levenshtein('milk', 'silk'), 1);
    assert.ok(levenshtein('abc', 'xyzxyz', 2) > 2);
  });

  test('singularize handles common plurals without over-stemming', () => {
    assert.equal(singularize('apples'), 'apple');
    assert.equal(singularize('berries'), 'berry');
    assert.equal(singularize('boxes'), 'box');
    assert.equal(singularize('gas'), 'gas');
  });

  test('matches exact names, synonyms and plurals', () => {
    assert.equal(matchProduct('milk').product.id, 'milk');
    assert.equal(matchProduct('apples').product.id, 'apple');
    assert.equal(matchProduct('coke').product.id, 'cola');
    assert.equal(matchProduct('washing powder').product.id, 'detergent');
  });

  test('matches compound names the recogniser ran together', () => {
    assert.equal(matchProduct('oatmilk').product.id, 'oat_milk');
    assert.equal(matchProduct('icecream').product.id, 'ice_cream');
    assert.ok(matchProduct('peanutbutter').confident);
  });

  test('matches translated names', () => {
    assert.equal(matchProduct('दूध', { lang: 'hi' }).product.id, 'milk');
    assert.equal(matchProduct('leche', { lang: 'es' }).product.id, 'milk');
    assert.equal(matchProduct('lait', { lang: 'fr' }).product.id, 'milk');
  });

  test('"pepper" resolves to the spice, not the vegetable', () => {
    // Regression: "peppers" singularises to "pepper", which used to give Bell
    // Peppers priority and made "salt and pepper" wrong.
    assert.equal(matchProduct('pepper').product.id, 'black_pepper');
    assert.equal(matchProduct('bell peppers').product.id, 'bell_pepper');
    assert.equal(matchProduct('capsicum').product.id, 'bell_pepper');
  });

  test('flags a shaky match as not confident instead of guessing', () => {
    const shaky = matchProduct('panir');
    assert.equal(shaky.product.id, 'paneer');
    assert.equal(shaky.confident, false);
  });

  test('returns nothing for genuinely unknown words', () => {
    assert.equal(matchProduct('quantum blockchain'), null);
    assert.deepEqual(matchProducts('xyzzy'), []);
  });
});

describe('filters', () => {
  const filtersFor = (text, lang = 'en') =>
    parseFilters(digitizeNumbers(normalize(text), lang), lang);

  test('extracts a maximum price and leaves a clean query', () => {
    const result = filtersFor('toothpaste under 5 dollars');
    // Regression: alternation order matched "dollar" before "dollars",
    // stranding an "s" in the product query.
    assert.equal(result.query, 'toothpaste');
    assert.equal(result.maxPrice, 5);
    assert.equal(result.currency, 'USD');
  });

  test('extracts ranges, minimums and approximations', () => {
    assert.deepEqual(
      (({ minPrice, maxPrice }) => ({ minPrice, maxPrice }))(filtersFor('milk between 2 and 5 dollars')),
      { minPrice: 2, maxPrice: 5 }
    );
    assert.equal(filtersFor('cheese more than 4 dollars').minPrice, 4);
    assert.deepEqual(
      (({ minPrice, maxPrice }) => ({ minPrice, maxPrice }))(filtersFor('chocolate around 3 dollars')),
      { minPrice: 2.4, maxPrice: 3.6 }
    );
  });

  test('extracts brands, tags and sizes', () => {
    assert.equal(filtersFor('Colgate toothpaste').brand, 'Colgate');
    assert.equal(filtersFor('toothpaste by Colgate').brand, 'Colgate');
    assert.deepEqual(filtersFor('organic apples').tags, ['organic']);
    assert.deepEqual(filtersFor('gluten free bread').tags, ['gluten-free']);
    assert.equal(filtersFor('1 litre milk').size, '1 litre');
  });

  test('reads prices in other currencies and languages', () => {
    const rupees = filtersFor('shampoo under 500 rupees');
    assert.equal(rupees.maxPrice, 500);
    assert.equal(rupees.currency, 'INR');

    const hindi = filtersFor('टूथपेस्ट 5 डॉलर से कम', 'hi');
    assert.equal(hindi.maxPrice, 5);
    assert.equal(hindi.query, 'टूथपेस्ट');

    assert.equal(filtersFor('dentifrice moins de 5 euros', 'fr').maxPrice, 5);
  });
});

describe('parse pipeline', () => {
  test('parses a quantity, unit and product together', () => {
    const command = parseOne('add two litres of milk');
    assert.equal(command.intent, INTENTS.ADD);
    assert.equal(command.items.length, 1);
    assert.equal(command.items[0].productId, 'milk');
    assert.equal(command.items[0].quantity, 2);
    assert.equal(command.items[0].unit, 'l');
  });

  test('splits several products in one command, each with its own quantity', () => {
    const command = parseOne('add 2 litres of milk and 3 apples');
    assert.equal(command.items.length, 2);
    assert.deepEqual(
      command.items.map((item) => [item.productId, item.quantity]),
      [['milk', 2], ['apple', 3]]
    );
  });

  test('splits an utterance holding two different commands', () => {
    const { commands } = parse('add milk and remove bread');
    assert.equal(commands.length, 2);
    assert.equal(commands[0].intent, INTENTS.ADD);
    assert.equal(commands[1].intent, INTENTS.REMOVE);
  });

  test('treats a bare product name as an add', () => {
    const command = parseOne('milk');
    assert.equal(command.intent, INTENTS.ADD);
    assert.equal(command.implied, true);
    assert.equal(command.items[0].productId, 'milk');
  });

  test('keeps an unknown item as free text rather than dropping it', () => {
    const command = parseOne('add quantum widget');
    assert.equal(command.intent, INTENTS.ADD);
    assert.equal(command.items[0].productId, null);
    assert.equal(command.items[0].name, 'Quantum Widget');
    assert.equal(command.items[0].category, 'other');
  });

  test('reports unknown for genuinely unparseable input', () => {
    assert.equal(parseOne('zzz qqq vvv').intent, INTENTS.UNKNOWN);
  });

  test('detects Devanagari regardless of the configured language', () => {
    assert.equal(detectScript('दूध'), 'hi');
    assert.equal(detectScript('milk'), null);
    // Configured as English, spoken in Hindi — the script wins.
    assert.equal(parse('दूध जोड़ो', { lang: 'en' }).lang, 'hi');
  });

  test('parses the assignment\'s example commands', () => {
    assert.equal(parseOne('Add milk').items[0].productId, 'milk');
    assert.equal(parseOne('I need apples').items[0].productId, 'apple');
    assert.equal(parseOne('I want to buy bananas').items[0].productId, 'banana');
    assert.equal(parseOne('Add bananas to my list').items[0].productId, 'banana');
    assert.equal(parseOne('Remove milk from my list').intent, INTENTS.REMOVE);

    const water = parseOne('Add 2 bottles of water');
    assert.equal(water.items[0].productId, 'water');
    assert.equal(water.items[0].quantity, 2);

    const oranges = parseOne('Buy 5 oranges');
    assert.equal(oranges.items[0].productId, 'orange');
    assert.equal(oranges.items[0].quantity, 5);

    const search = parseOne('Find me organic apples');
    assert.equal(search.intent, INTENTS.SEARCH);
    assert.deepEqual(search.filters.tags, ['organic']);

    const priced = parseOne('Find toothpaste under 5 dollars');
    assert.equal(priced.filters.maxPrice, 5);
  });

  test('returns an empty result for empty input', () => {
    assert.deepEqual(parse('').commands, []);
    assert.equal(parseOne('   '), null);
  });
});
