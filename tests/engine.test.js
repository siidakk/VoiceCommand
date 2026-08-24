/**
 * Engine tests: list management, categorisation, recommendations, search and
 * the command executor.
 *
 * Time is injected everywhere it matters (`now`), so the repurchase-prediction
 * tests assert real behaviour instead of being skipped as untestable.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import * as list from '../shared/engine/list-manager.js';
import { categorize } from '../shared/engine/categorizer.js';
import { suggest, alternatives, purchaseStats, previouslyBought } from '../shared/engine/recommender.js';
import { search } from '../shared/engine/search.js';
import { applyCommand, applyAll, RESULT } from '../shared/engine/executor.js';
import { parse, parseOne, INTENTS } from '../shared/nlp/index.js';
import { parseFilters } from '../shared/nlp/filters.js';
import { seasonalPicks, salePrice, isAvailable, PROMOTIONS } from '../shared/data/seasonal.js';
import { CATALOG, CATALOG_BY_ID, localizedName } from '../shared/data/catalog.js';
import { SUBSTITUTES } from '../shared/data/substitutes.js';

const NOW = new Date('2026-06-15T10:00:00Z');
const daysAgo = (days) => new Date(NOW.getTime() - days * 86400000).toISOString();

/** Build a list from a series of add specs. */
function listWith(...specs) {
  let state = list.createState();
  for (const spec of specs) ({ state } = list.addItem(state, spec, NOW));
  return state;
}

describe('catalog integrity', () => {
  test('every product has variants at more than one price', () => {
    for (const product of CATALOG) {
      assert.ok(product.variants.length >= 1, `${product.id} has no variants`);
      assert.ok(product.priceFrom <= product.price, `${product.id} headline is below its cheapest`);
      assert.ok(product.priceTo >= product.price, `${product.id} headline is above its dearest`);

      // The anchor variant is the declared price exactly, which is what makes
      // every other variant a stated multiple rather than an invented number.
      const anchor = product.variants.find((v) => v.isDefault);
      assert.equal(anchor.price, product.price, `${product.id} anchor drifted`);

      for (const variant of product.variants) {
        assert.ok(variant.price > 0, `${product.id} variant ${variant.id} has no price`);
      }
    }
  });

  test('a product with several brands and sizes has several prices', () => {
    const toothpaste = CATALOG_BY_ID.get('toothpaste');
    const prices = new Set(toothpaste.variants.map((v) => v.price));
    assert.ok(prices.size >= 5, 'expected a spread of toothpaste prices');
    // Straddling $5 is what makes the example filter in the brief meaningful.
    assert.ok(toothpaste.priceFrom < 5, 'cheapest toothpaste should be under $5');
    assert.ok(toothpaste.priceTo > 5, 'dearest toothpaste should be over $5');
  });

  test('every product id is unique and well formed', () => {
    const ids = new Set();
    for (const product of CATALOG) {
      assert.ok(!ids.has(product.id), `duplicate id ${product.id}`);
      ids.add(product.id);
      assert.ok(product.name, `${product.id} has no name`);
      assert.ok(product.price > 0, `${product.id} has no price`);
      assert.ok(product.unit, `${product.id} has no unit`);
      assert.ok(product.category, `${product.id} has no category`);
    }
  });

  test('every substitute points at a real product', () => {
    for (const [id, subs] of Object.entries(SUBSTITUTES)) {
      assert.ok(CATALOG_BY_ID.has(id), `substitute key ${id} is not a product`);
      for (const sub of subs) {
        assert.ok(CATALOG_BY_ID.has(sub.id), `${id} -> ${sub.id} is not a product`);
      }
    }
  });

  test('localizedName falls back to English', () => {
    assert.equal(localizedName('milk', 'hi'), 'दूध');
    assert.equal(localizedName('milk', 'en'), 'Milk');
    // No Hindi alias for lettuce, so English is used rather than an id.
    assert.equal(localizedName('lettuce', 'hi'), 'Lettuce');
    assert.equal(localizedName('nope', 'en'), '');
  });
});

describe('list manager', () => {
  test('adds items and bumps the version', () => {
    const state = listWith(
      { productId: 'milk', name: 'Milk', quantity: 2, unit: 'l' },
      { productId: 'bread', name: 'Bread', quantity: 1, unit: 'loaf' }
    );
    assert.equal(state.items.length, 2);
    assert.equal(state.version, 2);
  });

  test('merges a repeat add into the existing row', () => {
    let state = listWith({ productId: 'milk', name: 'Milk', quantity: 2, unit: 'l' });
    const result = list.addItem(state, { productId: 'milk', name: 'Milk', quantity: 1, unit: 'l' }, NOW);

    assert.equal(result.merged, true);
    assert.equal(result.item.quantity, 3);
    assert.equal(result.state.items.length, 1);
  });

  test('does not merge into an item already bought', () => {
    let state = listWith({ productId: 'milk', name: 'Milk', quantity: 1, unit: 'l' });
    ({ state } = list.markBought(state, { name: 'Milk' }, true, NOW));
    ({ state } = list.addItem(state, { productId: 'milk', name: 'Milk', quantity: 1, unit: 'l' }, NOW));

    assert.equal(state.items.length, 2);
  });

  test('never mutates the state it was given', () => {
    const before = listWith({ productId: 'milk', name: 'Milk', quantity: 1, unit: 'l' });
    const snapshot = JSON.stringify(before);

    list.addItem(before, { productId: 'bread', name: 'Bread', quantity: 1, unit: 'loaf' }, NOW);
    list.removeItem(before, { name: 'Milk' }, NOW);
    list.clearList(before, NOW);

    assert.equal(JSON.stringify(before), snapshot);
  });

  test('finds items by product id, exact name and fuzzy name', () => {
    const state = listWith({ productId: 'cola', name: 'Cola', quantity: 1, unit: 'bottle' });
    assert.ok(list.findItem(state, { productId: 'cola' }));
    assert.ok(list.findItem(state, { name: 'cola' }));
    // "coke" is a catalog synonym for Cola.
    assert.ok(list.findItem(state, { name: 'coke' }));
    assert.equal(list.findItem(state, { name: 'caviar' }), null);
  });

  test('a quantity of zero removes the item', () => {
    const state = listWith({ productId: 'apple', name: 'Apples', quantity: 3, unit: 'kg' });
    const result = list.updateQuantity(state, { name: 'Apples' }, 0, NOW);

    assert.equal(result.removed, true);
    assert.equal(result.state.items.length, 0);
  });

  test('marking bought records history', () => {
    let state = listWith({ productId: 'bread', name: 'Bread', quantity: 1, unit: 'loaf' });
    ({ state } = list.markBought(state, { name: 'Bread' }, true, NOW));

    assert.equal(state.history.length, 1);
    assert.equal(state.history[0].productId, 'bread');
  });

  test('clearing keeps history, because suggestions depend on it', () => {
    let state = listWith({ productId: 'bread', name: 'Bread', quantity: 1, unit: 'loaf' });
    ({ state } = list.markBought(state, { name: 'Bread' }, true, NOW));
    ({ state } = list.clearList(state, NOW));

    assert.equal(state.items.length, 0);
    assert.equal(state.history.length, 1);
  });

  test('groups by category in supermarket walking order', () => {
    const state = listWith(
      { productId: 'milk', name: 'Milk', quantity: 1, unit: 'l' },
      { productId: 'apple', name: 'Apples', quantity: 1, unit: 'kg' },
      { productId: 'rice', name: 'Rice', quantity: 1, unit: 'bag' }
    );

    assert.deepEqual(
      list.groupByCategory(state).map((group) => group.category),
      ['produce', 'dairy', 'pantry']
    );
  });

  test('totals price only what the catalog knows', () => {
    const state = listWith(
      { productId: 'milk', name: 'Milk', quantity: 2, unit: 'l' },
      { productId: null, name: 'Rice Paper', quantity: 1, unit: 'pack' }
    );

    const totals = list.totals(state);
    assert.equal(totals.total, 2);
    assert.equal(totals.priced, 1);
    assert.equal(totals.unpriced, 1);
    // Milk is $3.49 a litre; the free-text item contributes nothing.
    assert.equal(totals.estimated, 6.98);
  });

  test('a chosen variant sets the line price, not the headline price', () => {
    // Regression: the row renderer priced every line from the product's
    // headline price, so two differently-priced tubes of toothpaste showed the
    // same number while the basket total quietly disagreed.
    const toothpaste = CATALOG_BY_ID.get('toothpaste');
    const cheapest = toothpaste.variants[0];
    const dearest = toothpaste.variants[toothpaste.variants.length - 1];

    let state = list.createState();
    ({ state } = list.addItem(state, { productId: 'toothpaste', name: 'Toothpaste', variantId: cheapest.id }, NOW));
    ({ state } = list.addItem(state, { productId: 'toothpaste', name: 'Toothpaste', variantId: dearest.id }, NOW));

    // Two variants of one product are two things to buy, not one merged line.
    assert.equal(state.items.length, 2);
    assert.equal(list.lineUnitPrice(state.items[0]), cheapest.price);
    assert.equal(list.lineUnitPrice(state.items[1]), dearest.price);
    assert.equal(list.totals(state).estimated, Math.round((cheapest.price + dearest.price) * 100) / 100);
  });

  test('the same variant added twice merges', () => {
    const variant = CATALOG_BY_ID.get('toothpaste').variants[0];

    let state = list.createState();
    ({ state } = list.addItem(state, { productId: 'toothpaste', name: 'Toothpaste', variantId: variant.id }, NOW));
    const again = list.addItem(state, { productId: 'toothpaste', name: 'Toothpaste', variantId: variant.id }, NOW);

    assert.equal(again.merged, true);
    assert.equal(again.item.quantity, 2);
  });

  test('an item with no variant falls back to the catalog price', () => {
    const { item } = list.addItem(list.createState(), { productId: 'milk', name: 'Milk' }, NOW);
    assert.equal(list.lineUnitPrice(item), CATALOG_BY_ID.get('milk').price);
    assert.equal(list.itemVariantLabel(item), '');
  });

  test('a free-text item has no price at all', () => {
    const { item } = list.addItem(list.createState(), { name: 'Rice Paper' }, NOW);
    assert.equal(list.lineUnitPrice(item), null);
  });

  test('hydrate repairs arbitrary persisted junk', () => {
    const state = list.hydrate({
      items: [{ name: '  Milk  ', quantity: -5 }, { nope: 1 }, null, 'string'],
      history: 'not an array',
      version: -3
    });

    assert.equal(state.items.length, 1);
    assert.equal(state.items[0].name, 'Milk');
    assert.equal(state.items[0].quantity, 1);
    assert.equal(state.items[0].category, 'dairy');
    assert.deepEqual(state.history, []);
    assert.equal(state.version, 0);
  });

  test('hydrate accepts null and undefined', () => {
    assert.deepEqual(list.hydrate(null).items, []);
    assert.deepEqual(list.hydrate(undefined).items, []);
  });
});

describe('categorizer', () => {
  test('uses the catalog category for known products', () => {
    assert.equal(categorize('anything at all', 'toothpaste'), 'personal_care');
  });

  test('classifies free-text items by keyword', () => {
    assert.equal(categorize('almond milk'), 'dairy');
    assert.equal(categorize('frozen pizza'), 'frozen');
    assert.equal(categorize('chocolate cake'), 'bakery');
    assert.equal(categorize('shaving foam'), 'personal_care');
  });

  test('strong qualifiers override word position', () => {
    // Dog biscuits belong with pet food, not with biscuits.
    assert.equal(categorize('dog biscuits'), 'pet');
    assert.equal(categorize('baby shampoo'), 'baby');
  });

  test('admits ignorance rather than guessing an aisle', () => {
    assert.equal(categorize('quantum widget'), 'other');
    assert.equal(categorize('xyzzy plugh'), 'other');
    assert.equal(categorize(''), 'other');
  });
});

describe('recommender', () => {
  /** Bread every 4 days, milk every 3, eggs every 8. */
  const history = [
    { productId: 'bread', name: 'Bread', category: 'bakery', quantity: 1, at: daysAgo(17) },
    { productId: 'bread', name: 'Bread', category: 'bakery', quantity: 1, at: daysAgo(13) },
    { productId: 'bread', name: 'Bread', category: 'bakery', quantity: 1, at: daysAgo(9) },
    { productId: 'bread', name: 'Bread', category: 'bakery', quantity: 1, at: daysAgo(5) },
    { productId: 'milk', name: 'Milk', category: 'dairy', quantity: 1, at: daysAgo(9) },
    { productId: 'milk', name: 'Milk', category: 'dairy', quantity: 1, at: daysAgo(6) },
    { productId: 'milk', name: 'Milk', category: 'dairy', quantity: 1, at: daysAgo(3) },
    { productId: 'butter', name: 'Butter', category: 'dairy', quantity: 1, at: daysAgo(2) }
  ];

  test('learns each product\'s own repurchase interval', () => {
    const stats = purchaseStats(history);
    assert.equal(stats.get('bread').count, 4);
    assert.equal(stats.get('bread').learned, 4);
    assert.equal(stats.get('milk').learned, 3);
    // One purchase gives no interval to learn from.
    assert.equal(stats.get('butter').learned, null);
  });

  test('flags a due repurchase as running low', () => {
    const state = { ...list.createState(), history };
    const bread = suggest(state, { now: NOW, limit: 10 }).find((entry) => entry.id === 'bread');

    assert.ok(bread, 'expected bread to be suggested');
    assert.equal(bread.reason, 'runningLow');
    assert.equal(bread.vars.days, 4);
  });

  test('does not suggest something bought recently', () => {
    const state = { ...list.createState(), history };
    // Butter's catalog cycle is 21 days and it was bought 2 days ago.
    assert.equal(suggest(state, { now: NOW, limit: 30 }).find((e) => e.id === 'butter'), undefined);
  });

  test('never suggests something already on the list', () => {
    const state = { ...listWith({ productId: 'bread', name: 'Bread', quantity: 1, unit: 'loaf' }), history };
    assert.equal(suggest(state, { now: NOW, limit: 30 }).find((e) => e.id === 'bread'), undefined);
  });

  test('suggests pairings for what is on the list', () => {
    const state = listWith({ productId: 'pasta', name: 'Pasta', quantity: 1, unit: 'pack' });
    const pairs = suggest(state, { now: NOW, limit: 12 }).filter((e) => e.reason === 'pairsWith');

    assert.ok(pairs.length > 0);
    assert.ok(pairs.some((entry) => entry.id === 'canned_tomatoes'));
  });

  test('falls back to seasonal and staples with no history', () => {
    const suggestions = suggest(list.createState(), { now: NOW, limit: 8 });
    assert.ok(suggestions.length > 0);
    assert.ok(suggestions.every((entry) => entry.reason !== 'runningLow'));
  });

  test('never suggests an out-of-stock product', () => {
    const suggestions = suggest(list.createState(), { now: NOW, limit: 40, month: 5 });
    assert.ok(suggestions.every((entry) => isAvailable(entry.id)));
  });

  test('offers ranked substitutes with reasons', () => {
    const options = alternatives('milk');
    assert.deepEqual(options.map((o) => o.id), ['almond_milk', 'oat_milk', 'soy_milk']);
    assert.equal(options[0].reason, 'dairyFree');
  });

  test('filters out-of-stock substitutes by default', () => {
    // Frozen Berries substitutes for Strawberries, which is out of stock.
    assert.ok(alternatives('frozen_berries').every((option) => option.available));
  });

  test('previouslyBought lists distinct products, most recent first', () => {
    const state = { ...list.createState(), history };
    const bought = previouslyBought(state, 10);
    assert.equal(bought[0].id, 'butter');
    assert.equal(bought.find((entry) => entry.id === 'bread').count, 4);
  });
});

describe('seasonal', () => {
  test('summer picks lead with in-season items', () => {
    const picks = seasonalPicks(6, 5);
    assert.ok(picks.length > 0);
    assert.equal(picks[0].reason, 'inSeason');
    assert.ok(picks.some((pick) => pick.id === 'watermelon'));
  });

  test('sale price applies the discount', () => {
    // Olive oil is 25% off $9.20.
    assert.equal(salePrice('olive_oil'), 6.9);
    assert.equal(salePrice('lettuce'), CATALOG_BY_ID.get('lettuce').price);
  });

  test('sale prices never carry sub-cent noise', () => {
    for (const id of Object.keys(PROMOTIONS)) {
      const price = salePrice(id);
      // Compared via toFixed rather than `price * 100`, because that
      // multiplication introduces the very float noise being tested for.
      assert.equal(price, Number(price.toFixed(2)), `${id} has a fractional cent`);
    }
  });
});

describe('search', () => {
  const run = (text, lang = 'en') => {
    const command = parseOne(text, { lang });
    const filters = command?.filters || parseFilters(text, lang);
    return search(filters, { lang });
  };

  test("applies the brief's own price ceiling", () => {
    const outcome = run('find toothpaste under 5 dollars');

    assert.equal(outcome.total, 1);
    assert.equal(outcome.results[0].id, 'toothpaste');
    assert.equal(outcome.priceRange.max, 5);
    // Every option it offers must actually be under $5.
    assert.ok(outcome.results[0].variants.every((v) => v.price <= 5));
  });

  test('filters variants, not just products', () => {
    // Toothpaste spans $2.29 to $5.79, so "under $5" has to drop the dearest
    // tubes rather than answering yes or no for toothpaste as a whole.
    const all = run('find toothpaste');
    const cheap = run('find toothpaste under 5 dollars');

    assert.ok(all.results[0].variantCount > cheap.results[0].variantCount);
    assert.equal(cheap.results[0].totalVariants, all.results[0].variantCount);
  });

  test('a bare number is read as dollars', () => {
    assert.equal(run('find toothpaste under 4').priceRange.max, 4);
  });

  test('converts a foreign currency into the dollar base', () => {
    // 500 rupees is about $6.
    const outcome = run('find shampoo under 500 rupees');
    assert.ok(outcome.priceRange.max > 5 && outcome.priceRange.max < 7);
  });

  test('excludes items above the ceiling', () => {
    assert.equal(run('find shampoo under 1 dollar').total, 0);
  });

  test('filters by a specific pack size', () => {
    // Regression: "1 litre" never matched the catalog's "1 L", so a size
    // filter silently returned nothing.
    const outcome = run('find 1 litre milk');
    assert.equal(outcome.total, 1);
    assert.ok(outcome.results[0].variants.every((v) => v.size === '1 L'));
  });

  test('searches a category name', () => {
    const outcome = run('find dairy');
    assert.ok(outcome.total >= 10);
    assert.ok(outcome.results.every((r) => r.category === 'dairy'));
  });

  test('filters by brand and by tag', () => {
    assert.ok(run('show me Colgate toothpaste').results.every((r) => r.brands.includes('Colgate')));
    assert.ok(run('find me organic apples').results.every((r) => r.tags.includes('organic')));
  });

  test('relaxes an impossible tag rather than returning nothing', () => {
    const outcome = run('find gluten free bread');
    assert.ok(outcome.total > 0);
    assert.deepEqual(outcome.relaxedFilters, ['tags']);
    assert.deepEqual(outcome.requestedTags, ['gluten-free']);
  });

  test('offers substitutes for an out-of-stock hit', () => {
    const outcome = run('find strawberries');
    const strawberries = outcome.results.find((r) => r.id === 'strawberry');
    assert.equal(strawberries.available, false);
    assert.ok(strawberries.substitutes.length > 0);
  });

  test('returns nothing for an unstocked product', () => {
    assert.equal(run('find caviar').total, 0);
  });
});

describe('executor', () => {
  const run = (state, text, lang = 'en') =>
    applyAll(state, parse(text, { lang }), { lang, now: NOW });

  test('adds, confirms and prices', () => {
    const { state, responses } = run(list.createState(), 'add two litres of milk');

    assert.equal(responses[0].kind, RESULT.ADDED);
    assert.equal(responses[0].speak, 'Added 2 L of Milk');
    assert.equal(state.items[0].quantity, 2);
  });

  test('handles several commands in one utterance', () => {
    let state = listWith({ productId: 'bread', name: 'Bread', quantity: 1, unit: 'loaf' });
    const result = run(state, 'add milk and remove bread');

    assert.equal(result.responses.length, 2);
    assert.equal(result.responses[0].kind, RESULT.ADDED);
    assert.equal(result.responses[1].kind, RESULT.REMOVED);
    assert.deepEqual(result.state.items.map((i) => i.productId), ['milk']);
  });

  test('reports a removal that matched nothing', () => {
    const { state, responses } = run(list.createState(), 'remove caviar');

    assert.equal(responses[0].kind, RESULT.NOT_FOUND);
    assert.equal(responses[0].ok, false);
    assert.equal(state.items.length, 0);
  });

  test('adds an out-of-stock item and offers a substitute', () => {
    const { responses } = run(list.createState(), 'add strawberries');
    const data = responses[0].data;

    assert.equal(responses[0].kind, RESULT.ADDED);
    assert.equal(data.unavailable.length, 1);
    assert.equal(data.unavailable[0].substitutes[0].id, 'frozen_berries');
    assert.match(responses[0].speak, /out of stock/);
  });

  test('adds a shaky match but carries the correction', () => {
    const { responses } = run(list.createState(), 'add panir');
    const uncertain = responses[0].data.unconfident[0];

    assert.equal(responses[0].kind, RESULT.ADDED);
    assert.equal(uncertain.productId, 'paneer');
    assert.ok(uncertain.alternatives.length > 0);
  });

  test('search does not modify the list', () => {
    const before = listWith({ productId: 'milk', name: 'Milk', quantity: 1, unit: 'l' });
    const { state, responses } = run(before, 'find toothpaste under 5 dollars');

    assert.equal(state, before);
    assert.equal(responses[0].kind, RESULT.SEARCH);
    assert.equal(responses[0].speak, 'I found one match for toothpaste');
  });

  test('reports substitutes without changing the list', () => {
    const before = list.createState();
    const { state, responses } = run(before, 'what can i use instead of milk');

    assert.equal(state, before);
    assert.equal(responses[0].kind, RESULT.SUBSTITUTES);
    assert.equal(responses[0].data.options[0].id, 'almond_milk');
  });

  test('answers unparseable input without throwing', () => {
    const { responses } = run(list.createState(), 'zzz qqq vvv');
    assert.equal(responses[0].kind, RESULT.UNKNOWN);
    assert.equal(responses[0].ok, false);
  });

  test('speaks the reply in the active language', () => {
    const hindi = run(list.createState(), 'दो लीटर दूध जोड़ो', 'hi');
    assert.equal(hindi.responses[0].speak, 'दूध 2 लीटर जोड़ दिया');

    const spanish = run(list.createState(), 'anade dos litros de leche', 'es');
    assert.equal(spanish.responses[0].speak, 'Añadido 2 L de leche');

    const french = run(list.createState(), 'ajoute deux litres de lait', 'fr');
    assert.equal(french.responses[0].speak, '2 L de lait ajouté');
  });

  test('undo is reported to the client rather than performed', () => {
    const before = listWith({ productId: 'milk', name: 'Milk', quantity: 1, unit: 'l' });
    const { state, response } = applyCommand(before, { intent: INTENTS.UNDO, items: [], text: 'undo' }, {
      lang: 'en'
    });

    assert.equal(state, before);
    assert.equal(response.data.undo, true);
  });
});
