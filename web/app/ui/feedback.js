/**
 * Recognition feedback and error surfaces.
 *
 * Three jobs:
 *   1. Show what was heard, live — interim text while speaking, then the final
 *      transcript with a confidence reading.
 *   2. Summarise what the assistant did, as chips ("+ Milk", "− Bread").
 *   3. Offer a correction when a match was shaky, instead of silently filing
 *      the wrong product.
 *
 * (3) is the one that matters most in practice. Speech recognition is wrong
 * often enough that an assistant which never admits uncertainty is worse than
 * one that asks — so a low-confidence match is added *and* offered as a
 * one-tap swap, which loses nothing either way.
 */

import { el, render, clear } from './dom.js';
import { t } from '../../../shared/i18n/index.js';

/** Update the transcript strip. */
export function renderTranscript(refs, store, { interim = null, state = null } = {}) {
  const lang = store.lang;
  const node = refs.transcript;

  if (state) node.dataset.state = state;

  if (interim !== null) {
    refs.transcriptLabel.textContent = t(lang, 'heard.interim');
    refs.transcriptText.textContent = interim;
    refs.transcriptText.classList.add('interim');
    refs.transcriptConfidence.textContent = '';
    clear(refs.transcriptChips);
    return;
  }

  refs.transcriptText.classList.remove('interim');

  if (!store.ui.lastHeard) {
    refs.transcriptLabel.textContent = t(lang, 'mic.hint');
    refs.transcriptText.textContent = '';
    refs.transcriptConfidence.textContent = '';
    clear(refs.transcriptChips);
    return;
  }

  refs.transcriptLabel.textContent = t(lang, 'heard.label');
  refs.transcriptText.textContent = store.ui.lastHeard;

  refs.transcriptConfidence.textContent =
    store.ui.lastConfidence === null || store.ui.lastConfidence === undefined
      ? ''
      : t(lang, 'heard.confidence', { percent: Math.round(store.ui.lastConfidence * 100) });
}

/**
 * Chips summarising the last set of responses.
 *
 * @param {object} handlers onSwap(itemId, productId), onAdd(entry), onRetry()
 */
export function renderActionChips(refs, store, handlers) {
  const lang = store.lang;
  const chips = [];

  for (const response of store.ui.lastResponses) {
    const data = response.data || {};

    for (const item of data.added || []) {
      chips.push(el('span', { className: 'chip added', text: `+ ${item.name}` }));
    }

    for (const item of data.removed || []) {
      chips.push(el('span', { className: 'chip removed', text: `− ${item.name}` }));
    }

    if (response.kind === 'updated' && data.item) {
      chips.push(el('span', { className: 'chip info', text: `${data.item.name} × ${data.item.quantity}` }));
    }

    if (response.kind === 'marked' && data.item) {
      chips.push(el('span', { className: 'chip added', text: `✓ ${data.item.name}` }));
    }

    if (response.kind === 'cleared') {
      chips.push(el('span', { className: 'chip removed', text: t(lang, 'say.cleared') }));
    }

    for (const name of data.missing || []) {
      chips.push(el('span', { className: 'chip', text: `? ${name}` }));
    }

    // Low-confidence matches: offer the runner-up as a one-tap correction.
    // The item that was actually added is filtered out — offering "did you
    // mean Paneer?" right after adding Paneer reads as a bug, not a courtesy.
    for (const uncertain of data.unconfident || []) {
      const others = uncertain.alternatives.filter((alt) => alt.id !== uncertain.productId);
      for (const alternative of others.slice(0, 2)) {
        chips.push(
          el('button', {
            className: 'chip action',
            text: t(lang, 'heard.didYouMean', { item: alternative.name }),
            attrs: { type: 'button' },
            on: { click: () => handlers.onSwap(uncertain.itemId, alternative) }
          })
        );
      }
    }

    // Out of stock: offer the substitute directly from the chip row.
    for (const entry of data.unavailable || []) {
      for (const substitute of entry.substitutes.slice(0, 2)) {
        chips.push(
          el('button', {
            className: 'chip action',
            text: `${substitute.name} →`,
            attrs: { type: 'button', title: t(lang, 'suggest.outOfStock', { item: entry.name }) },
            on: { click: () => handlers.onAdd(substitute) }
          })
        );
      }
    }

    // Nothing understood: show the closest catalog guesses as shortcuts.
    if (response.kind === 'unknown') {
      const guesses = data.alternatives || [];
      if (guesses.length) {
        chips.push(el('span', { className: 'chip', text: t(lang, 'heard.tryThese') }));
        for (const guess of guesses.slice(0, 3)) {
          chips.push(
            el('button', {
              className: 'chip action',
              text: guess.name,
              attrs: { type: 'button' },
              on: { click: () => handlers.onAdd({ id: guess.id, name: guess.name }) }
            })
          );
        }
      } else {
        chips.push(el('span', { className: 'chip', text: t(lang, 'heard.unrecognised') }));
      }
    }
  }

  render(refs.transcriptChips, chips);
}

/**
 * Render the error banner.
 *
 * Errors carry a severity: a missing server is a `warn` (the app still works
 * offline), a blocked microphone is an `error` (a capability is genuinely
 * gone). Showing both in the same red would train the user to ignore them.
 */
export function renderError(refs, store, handlers) {
  const error = store.ui.error;

  if (!error) {
    clear(refs.errorSlot);
    return;
  }

  const lang = store.lang;
  const banner = el('div', { className: `error-banner${error.severity === 'warn' ? ' warn' : ''}` }, [
    el('p', { text: t(lang, error.messageKey) }),
    el('div', { className: 'error-actions' }, [
      error.retry
        ? el('button', {
            className: 'text-button',
            text: t(lang, 'error.retry'),
            attrs: { type: 'button' },
            on: { click: handlers.onRetry }
          })
        : null,
      el('button', {
        className: 'text-button',
        text: t(lang, 'error.dismiss'),
        attrs: { type: 'button' },
        on: { click: handlers.onDismiss }
      })
    ])
  ]);

  render(refs.errorSlot, banner);
}

/** Announce a phrase to screen readers, independent of the TTS setting. */
export function announce(refs, message) {
  if (!message) return;
  // Clearing first guarantees the reader sees a change even if the same text
  // is announced twice in a row.
  refs.liveRegion.textContent = '';
  refs.liveRegion.textContent = message;
}
