/**
 * Side panel: smart suggestions, seasonal picks, and search results.
 *
 * Every row is one-tap addable, because the point of a suggestion the user did
 * not ask for is that acting on it should cost nothing.
 *
 * Each suggestion states *why* it is being offered ("You usually rebuy this
 * every 4 days", "25% off this week"). An unexplained recommendation is noise;
 * the reason is what makes it trustworthy, and it is the visible half of the
 * assignment's "It looks like you're running low on bread".
 */

import { el, render } from './dom.js';
import { t, categoryLabel } from '../../../shared/i18n/index.js';
import { localizedName } from '../../../shared/data/catalog.js';
import { getCategory } from '../../../shared/data/categories.js';

/** Turn a suggestion's reason key + vars into a sentence. */
function reasonText(entry, lang) {
  const vars = entry.vars || {};

  switch (entry.reason) {
    case 'runningLow':
      return t(lang, 'suggest.runningLow', { days: vars.days });
    case 'frequentlyBought':
      return t(lang, 'suggest.frequentlyBought');
    case 'pairsWith':
      return t(lang, 'suggest.pairsWith', { item: vars.item });
    case 'inSeason':
      return t(lang, 'suggest.inSeason');
    case 'onSale':
      return t(lang, 'suggest.onSale', { percent: vars.percent ?? entry.discount });
    case 'seasonalEvent':
      return vars.event ? t(lang, `event.${vars.event}`) : t(lang, 'suggest.seasonalEvent');
    case 'staple':
      return t(lang, 'suggest.staple');
    default:
      return categoryLabel(lang, entry.category);
  }
}

/** Price cell, showing the strike-through original when discounted. */
function priceCell(entry, store) {
  if (entry.price === undefined || entry.price === null) return null;

  const discounted = entry.discount > 0 && entry.salePrice < entry.price;

  return el('div', { className: 'suggestion-price' }, [
    discounted ? el('span', { className: 'price-was', text: store.money(entry.price) }) : null,
    el('span', {
      className: discounted ? 'price-now' : '',
      text: store.money(discounted ? entry.salePrice : entry.price)
    })
  ]);
}

function addButton(entry, store, onAdd) {
  const alreadyOnList = store.list.items.some((item) => !item.bought && item.productId === entry.id);

  return el('button', {
    className: 'add-button',
    text: alreadyOnList ? '✓' : '+',
    attrs: {
      type: 'button',
      disabled: alreadyOnList,
      'aria-label': `Add ${entry.name}`,
      title: alreadyOnList ? 'Already on your list' : `Add ${entry.name}`
    },
    on: { click: () => onAdd(entry) }
  });
}

/** One suggestion / search-result row. */
function productRow(entry, store, onAdd, options = {}) {
  const lang = store.lang;
  const category = getCategory(entry.category);

  const tags = [];
  if (entry.discount > 0) tags.push(el('span', { className: 'sale-tag', text: `-${entry.discount}%` }));
  if (entry.available === false) tags.push(el('span', { className: 'oos-tag', text: 'out of stock' }));

  const why = options.why ?? reasonText(entry, lang);

  return el('div', { className: 'suggestion' }, [
    el('div', { className: 'suggestion-main' }, [
      el('div', { className: 'suggestion-name' }, [
        `${category.icon} ${localizedName(entry.id, lang) || entry.name}`,
        ...tags
      ]),
      why ? el('div', { className: 'suggestion-why', text: why }) : null,
      // When the store is out of something, the substitutes are the useful
      // part of the row, so they are offered inline rather than hidden.
      entry.substitutes?.length
        ? el('div', { className: 'suggestion-why' }, [
            `${t(lang, 'panel.substitutes')}: `,
            ...entry.substitutes.flatMap((sub, index) => [
              index ? ', ' : '',
              el('button', {
                className: 'text-button',
                text: localizedName(sub.id, lang) || sub.name,
                attrs: { type: 'button' },
                on: { click: () => onAdd(sub) }
              })
            ])
          ])
        : null
    ]),
    priceCell(entry, store),
    addButton(entry, store, onAdd)
  ]);
}

function emptyNote(text) {
  return el('p', { className: 'panel-note', text });
}

/** The "alternatives to X" block, shown above suggestions when requested. */
function substitutesBlock(store, onAdd, onDismiss) {
  const data = store.panels.substitutes;
  if (!data || !data.options.length) return null;

  const lang = store.lang;

  return el('div', {}, [
    el('div', { className: 'panel-head-meta', attrs: { style: 'padding-bottom:8px' } }, [
      el('strong', { text: `${t(lang, 'panel.substitutes')} · ${data.of}` }),
      el('button', {
        className: 'text-button',
        text: t(lang, 'ctl.close'),
        attrs: { type: 'button' },
        on: { click: onDismiss }
      })
    ]),
    ...data.options.map((option) =>
      productRow(option, store, onAdd, { why: t(lang, `reason.${option.reason}`) })
    ),
    el('hr', { attrs: { style: 'border:none;border-top:1px solid var(--border);margin:12px 0' } })
  ]);
}

/** Chips describing which filters a search applied. */
function filterSummary(data, store) {
  const lang = store.lang;
  const filters = data.filters || {};
  const chips = [];

  if (filters.maxPrice !== null && filters.maxPrice !== undefined && filters.minPrice === null) {
    chips.push(t(lang, 'search.under', { price: store.money(data.priceRangeUsd.max) }));
  }
  if (filters.minPrice !== null && filters.minPrice !== undefined && filters.maxPrice !== null) {
    chips.push(
      t(lang, 'search.between', {
        min: store.money(data.priceRangeUsd.min),
        max: store.money(data.priceRangeUsd.max)
      })
    );
  }
  if (filters.brand) chips.push(t(lang, 'search.brand', { brand: filters.brand }));
  for (const tag of filters.tags || []) chips.push(tag);
  if (filters.size) chips.push(filters.size);

  if (!chips.length) return null;

  return el(
    'div',
    { className: 'filter-summary' },
    chips.map((label) => el('span', { className: 'chip info', text: label }))
  );
}

function renderSuggestions(store, handlers) {
  const lang = store.lang;
  const nodes = [];

  const substitutes = substitutesBlock(store, handlers.onAdd, handlers.onDismissSubstitutes);
  if (substitutes) nodes.push(substitutes);

  if (store.panels.suggestions.length) {
    nodes.push(...store.panels.suggestions.map((entry) => productRow(entry, store, handlers.onAdd)));
  } else if (!substitutes) {
    nodes.push(emptyNote(t(lang, 'panel.noSuggestions')));
  }

  return nodes;
}

function renderSeasonal(store, handlers) {
  const lang = store.lang;

  if (!store.panels.seasonal.length) return [emptyNote(t(lang, 'panel.noSuggestions'))];

  return store.panels.seasonal.map((entry) =>
    productRow(entry, store, handlers.onAdd, {
      why:
        entry.reason === 'onSale'
          ? t(lang, 'suggest.onSale', { percent: entry.discount })
          : entry.event
            ? t(lang, `event.${entry.event}`)
            : t(lang, 'suggest.inSeason')
    })
  );
}

function renderSearch(store, handlers) {
  const lang = store.lang;
  const data = store.panels.search;

  if (!data) return [emptyNote(t(lang, 'mic.hint'))];

  const nodes = [];
  const summary = filterSummary(data, store);
  if (summary) nodes.push(summary);

  if (!data.results.length) {
    nodes.push(emptyNote(t(lang, 'search.none', { query: data.query || '' })));
    return nodes;
  }

  // Be explicit when an attribute could not be honoured, rather than quietly
  // returning results that do not actually match what was asked for.
  if (data.relaxedFilters?.includes('tags')) {
    nodes.push(
      emptyNote(
        `${t(lang, 'search.none', { query: (data.requestedTags || []).join(', ') })} ${t(lang, 'heard.tryThese')}`
      )
    );
  }

  nodes.push(
    emptyNote(
      data.total === 1
        ? t(lang, 'search.resultsOne', { query: data.query || '' })
        : t(lang, 'search.results', { count: data.total, query: data.query || '' })
    )
  );

  nodes.push(
    ...data.results.map((entry) =>
      productRow(entry, store, handlers.onAdd, {
        why: [categoryLabel(lang, entry.category), ...(entry.tags || []).slice(0, 2)].join(' · ')
      })
    )
  );

  return nodes;
}

/**
 * Render the active side panel.
 *
 * @param {object} refs
 * @param {import('../state.js').Store} store
 * @param {object} handlers onAdd, onDismissSubstitutes
 */
export function renderPanels(refs, store, handlers) {
  const active = store.panels.active;

  for (const tab of refs.tabs) {
    tab.setAttribute('aria-selected', String(tab.dataset.tab === active));
  }

  const nodes =
    active === 'seasonal'
      ? renderSeasonal(store, handlers)
      : active === 'search'
        ? renderSearch(store, handlers)
        : renderSuggestions(store, handlers);

  render(refs.panelBody, nodes);
}
