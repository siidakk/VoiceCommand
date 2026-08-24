/**
 * Translation tests.
 *
 * The parity check is the important one: it fails the build the moment a
 * locale drifts from English, which is the only reliable way to stop a missing
 * key from shipping and rendering as a raw identifier like "say.added" in the
 * user's face.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  LOCALES,
  LANGUAGES,
  DEFAULT_LANG,
  t,
  translator,
  resolveLang,
  currencyFor,
  formatCurrency,
  toUsd,
  speechTag,
  categoryLabel,
  itemCount
} from '../shared/i18n/index.js';
import { CATEGORY_IDS } from '../shared/data/categories.js';

const OTHER_LANGS = Object.keys(LOCALES).filter((code) => code !== 'en');

describe('locale parity', () => {
  const englishKeys = Object.keys(LOCALES.en.strings);

  test('English defines a non-trivial set of keys', () => {
    assert.ok(englishKeys.length > 100);
  });

  for (const code of OTHER_LANGS) {
    test(`${code} defines exactly the English keys`, () => {
      const keys = Object.keys(LOCALES[code].strings);

      const missing = englishKeys.filter((key) => !keys.includes(key));
      const extra = keys.filter((key) => !englishKeys.includes(key));

      assert.deepEqual(missing, [], `${code} is missing keys`);
      assert.deepEqual(extra, [], `${code} has keys English does not`);
    });

    test(`${code} uses the same placeholders as English`, () => {
      const placeholders = (value) => (value.match(/\{(\w+)\}/g) || []).sort();

      for (const key of englishKeys) {
        assert.deepEqual(
          placeholders(LOCALES[code].strings[key]),
          placeholders(LOCALES.en.strings[key]),
          `placeholder mismatch in ${code}.${key}`
        );
      }
    });

    test(`${code} has no untranslated copies of the English string`, () => {
      // A handful of words are legitimately identical across languages
      // ("Snacks", "Premium"), so this only flags long strings.
      const suspicious = englishKeys.filter((key) => {
        const english = LOCALES.en.strings[key];
        return english.length > 25 && LOCALES[code].strings[key] === english;
      });

      assert.deepEqual(suspicious, [], `${code} left long strings untranslated`);
    });
  }

  test('every category has a label in every language', () => {
    for (const code of Object.keys(LOCALES)) {
      for (const id of CATEGORY_IDS) {
        const label = categoryLabel(code, id);
        assert.notEqual(label, `category.${id}`, `${code} is missing category.${id}`);
      }
    }
  });
});

describe('translation lookup', () => {
  test('fills placeholders', () => {
    assert.equal(t('en', 'say.added', { qty: 2, unit: 'L', item: 'Milk' }), 'Added 2 L of Milk');
  });

  test('leaves an unknown placeholder untouched rather than printing undefined', () => {
    assert.equal(t('en', 'say.addedSimple', {}), 'Added {item}');
  });

  test('falls back to English, then to the key itself', () => {
    assert.equal(t('fr', 'totally.missing.key'), 'totally.missing.key');
  });

  test('translator binds a language', () => {
    const translate = translator('es');
    assert.equal(translate.lang, 'es');
    assert.equal(translate('ctl.send'), 'Enviar');
  });
});

describe('language resolution', () => {
  test('normalises regional tags to a base language', () => {
    assert.equal(resolveLang('en-GB'), 'en');
    assert.equal(resolveLang('hi-IN'), 'hi');
    assert.equal(resolveLang('es_MX'), 'es');
    assert.equal(resolveLang('pt-BR'), DEFAULT_LANG);
    assert.equal(resolveLang(null), DEFAULT_LANG);
    assert.equal(resolveLang(''), DEFAULT_LANG);
  });

  test('exposes a BCP-47 tag for the Web Speech API', () => {
    assert.equal(speechTag('hi'), 'hi-IN');
    assert.equal(speechTag('en'), 'en-US');
  });

  test('the language list matches the loaded locales', () => {
    assert.deepEqual(
      LANGUAGES.map((language) => language.code).sort(),
      Object.keys(LOCALES).sort()
    );
    assert.ok(LANGUAGES.every((language) => language.nativeName && language.speech));
  });
});

describe('currency', () => {
  test('each language has a default currency', () => {
    assert.equal(currencyFor('en'), 'USD');
    assert.equal(currencyFor('hi'), 'INR');
    assert.equal(currencyFor('fr'), 'EUR');
  });

  test('formats an amount in the language currency', () => {
    assert.match(formatCurrency(3.49, 'en'), /\$3\.49/);
    assert.match(formatCurrency(3.49, 'hi'), /₹/);
    assert.match(formatCurrency(3.49, 'fr'), /€/);
  });

  test('rupees are shown whole, since paise are noise on a grocery list', () => {
    assert.doesNotMatch(formatCurrency(3.49, 'hi'), /\./);
  });

  test('toUsd inverts the conversion', () => {
    const usd = 5;
    const inr = usd * 83;
    assert.ok(Math.abs(toUsd(inr, 'hi') - usd) < 0.001);
    assert.equal(toUsd(5, 'en'), 5);
  });

  test('an unknown currency does not throw', () => {
    assert.ok(formatCurrency(5, 'en', 'XYZ').includes('5'));
  });
});

describe('pluralisation', () => {
  test('uses the singular string for one item', () => {
    assert.equal(itemCount('en', 1), '1 item');
    assert.equal(itemCount('en', 3), '3 items');
    assert.equal(itemCount('es', 1), '1 artículo');
  });
});
