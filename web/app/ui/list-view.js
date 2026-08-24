/**
 * Shopping list rendering.
 *
 * Renders the list grouped into aisle-ordered category sections, each row with
 * a bought toggle, a quantity stepper and a remove button — so every voice
 * action has a visible, tappable equivalent.
 *
 * Rows changed by the last command carry a one-shot `flash` class. That is the
 * assignment's "display recognized items and actions in real time": the user
 * sees *which* row a spoken command affected, not just a confirmation string.
 */

import { el, render } from './dom.js';
import { getCategory } from '../../../shared/data/categories.js';
import { localizedName } from '../../../shared/data/catalog.js';
import { unitLabel } from '../../../shared/nlp/units.js';
import { t, categoryLabel } from '../../../shared/i18n/index.js';

/** Display name for a stored item, translated where the catalog knows how. */
function displayName(item, lang) {
  return item.productId ? localizedName(item.productId, lang) : item.name;
}

/**
 * "2 L" style subtitle.
 *
 * The price is deliberately not in here — it gets its own right-aligned
 * column, so the numbers line up down the list and can be scanned as a column
 * rather than hunted for inside a sentence.
 */
function itemMeta(item, store) {
  const lang = store.lang;
  const bits = [];

  const unit = unitLabel(item.unit, item.quantity, lang);
  if (item.quantity > 1 || (unit && unit !== 'pcs')) {
    bits.push(`${item.quantity} ${unit}`.trim());
  }

  return bits;
}

function itemRow(item, store, handlers) {
  const lang = store.lang;
  const flashing = store.ui.flash.has(item.id);

  const check = el('button', {
    className: 'item-check',
    text: '✓',
    attrs: {
      type: 'button',
      'aria-label': t(lang, 'a11y.toggleItem', { item: displayName(item, lang) }),
      'aria-pressed': String(item.bought)
    },
    on: { click: () => handlers.onToggle(item.id) }
  });

  const meta = itemMeta(item, store);

  const main = el('div', { className: 'item-main' }, [
    el('div', { className: 'item-name', text: displayName(item, lang) }),
    meta.length || !item.productId
      ? el('div', { className: 'item-meta' }, [
          ...meta.map((bit) => el('span', { text: bit })),
          // A free-text item had no catalog match, which is worth showing:
          // it explains why there is no price and no suggestions for it.
          !item.productId ? el('span', { className: 'item-flag', text: 'custom' }) : null
        ])
      : null
  ]);

  const quantity = el('div', { className: 'qty' }, [
    el('button', {
      text: '−',
      attrs: {
        type: 'button',
        'aria-label': t(lang, 'a11y.decrease', { item: displayName(item, lang) })
      },
      on: { click: () => handlers.onQuantity(item.id, item.quantity - 1) }
    }),
    el('span', { className: 'qty-value', text: item.quantity }),
    el('button', {
      text: '+',
      attrs: {
        type: 'button',
        'aria-label': t(lang, 'a11y.increase', { item: displayName(item, lang) })
      },
      on: { click: () => handlers.onQuantity(item.id, item.quantity + 1) }
    })
  ]);

  // A free-text item has no catalog price, so the column stays empty rather
  // than showing a zero that would quietly understate the total.
  const lineTotal = store.moneyForItem(item);
  const price = el('div', {
    className: 'item-price',
    text: lineTotal || ''
  });

  const remove = el('button', {
    className: 'item-remove',
    text: '×',
    attrs: {
      type: 'button',
      'aria-label': t(lang, 'a11y.removeItem', { item: displayName(item, lang) })
    },
    on: { click: () => handlers.onRemove(item.id) }
  });

  return el(
    'div',
    {
      className: `item${item.bought ? ' bought' : ''}${flashing ? ' flash' : ''}`,
      dataset: { itemId: item.id },
      // The category tint is applied per row as a left edge, so a long list
      // stays readable when the section header has scrolled out of view.
      attrs: { style: `--row-accent:${getCategory(item.category).color}` }
    },
    [check, main, price, quantity, remove]
  );
}

function categorySection(group, store, handlers) {
  const category = getCategory(group.category);

  return el('section', { className: 'category-group' }, [
    el('h3', { className: 'category-head' }, [
      el('span', {
        className: 'category-dot',
        attrs: { style: `background:${category.color}` }
      }),
      `${category.icon} ${categoryLabel(store.lang, group.category)}`
    ]),
    ...group.items.map((item) => itemRow(item, store, handlers))
  ]);
}

function emptyState(store) {
  return el('div', { className: 'empty' }, [
    el('p', { className: 'empty-title', text: t(store.lang, 'list.empty') }),
    el('p', { className: 'empty-hint', text: t(store.lang, 'list.emptyHint') })
  ]);
}

/**
 * Render the list into its container.
 *
 * @param {object} refs     cached DOM nodes
 * @param {import('../state.js').Store} store
 * @param {object} handlers onToggle, onQuantity, onRemove
 */
export function renderList(refs, store, handlers) {
  const groups = store.groups;
  const totals = store.totals;
  const lang = store.lang;

  refs.listBody.setAttribute('aria-busy', String(store.ui.busy));

  render(
    refs.listBody,
    groups.length ? groups.map((group) => categorySection(group, store, handlers)) : emptyState(store)
  );

  // Count reads "3 items · 1 in the cart" so progress is visible while shopping.
  const parts = [totals.total === 1 ? t(lang, 'list.itemsOne') : t(lang, 'list.items', { count: totals.total })];
  if (totals.bought) parts.push(`${totals.bought} ${t(lang, 'list.done')}`);
  refs.listCount.textContent = totals.total ? parts.join(' · ') : '';

  const hasEstimate = totals.estimated > 0;
  refs.listTotal.hidden = !hasEstimate;
  if (hasEstimate) {
    refs.listTotalValue.textContent = store.money(totals.estimated);
  }

  refs.undoButton.hidden = !store.canUndo;
  refs.clearButton.hidden = totals.total === 0;

  // The flash is one render only; clearing it here stops a later unrelated
  // re-render from replaying the animation.
  store.ui.flash = new Set();
}
