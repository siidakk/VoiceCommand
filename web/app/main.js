/**
 * Application bootstrap.
 *
 * Wires the four pieces together and owns every DOM event:
 *
 *   VoiceRecognizer  speech in
 *   Store            parse, execute, persist, sync
 *   Speaker          speech out
 *   views            render
 *
 * Rendering is a single subscription: anything that changes state calls
 * store.notify(), and the whole UI re-renders from that state. With a list
 * this small it is far easier to reason about than targeted DOM patching, and
 * it makes "the screen always reflects the state" true by construction rather
 * than by discipline.
 */

import { ApiClient } from './api-client.js';
import { Store } from './state.js';
import { VoiceRecognizer, isSupported as speechSupported } from './speech.js';
import { Speaker, isSupported as ttsSupported } from './tts.js';

import { $, $$, el, render } from './ui/dom.js';
import { renderList } from './ui/list-view.js';
import { renderPanels } from './ui/panel-view.js';
import { renderTranscript, renderActionChips, renderError, announce } from './ui/feedback.js';
import { openHelp } from './ui/help.js';

import { LANGUAGES, t } from '../../shared/i18n/index.js';

// ------------------------------------------------------------------- refs --

const refs = {
  app: $('#app'),
  liveRegion: $('#live-region'),

  langSelect: $('#lang-select'),
  ttsToggle: $('#tts-toggle'),
  helpButton: $('#help-button'),
  connectionBadge: $('#connection-badge'),

  transcript: $('#transcript'),
  transcriptLabel: $('#transcript-label'),
  transcriptText: $('#transcript-text'),
  transcriptConfidence: $('#transcript-confidence'),
  transcriptChips: $('#transcript-chips'),

  errorSlot: $('#error-slot'),

  listBody: $('#list-body'),
  listCount: $('#list-count'),
  listTotal: $('#list-total'),
  listTotalValue: $('#list-total-value'),
  undoButton: $('#undo-button'),
  clearButton: $('#clear-button'),

  tabs: $$('.tab'),
  panelBody: $('#panel-body'),

  micButton: $('#mic-button'),
  micStatus: $('#mic-status'),
  continuousToggle: $('#continuous-toggle'),

  textForm: $('#text-form'),
  textInput: $('#text-input'),

  helpDialog: $('#help-dialog'),
  helpBody: $('#help-body'),
  helpClose: $('#help-close')
};

// ------------------------------------------------------------------ setup --

const api = new ApiClient();
const store = new Store(api);
const speaker = new Speaker({ enabled: store.settings.speakReplies, lang: store.speechTag });
const recognizer = new VoiceRecognizer({
  lang: store.speechTag,
  continuous: store.settings.continuous
});

api.setLanguage(store.lang);

/** Populate the language picker from the i18n registry. */
function buildLanguageSelect() {
  render(
    refs.langSelect,
    LANGUAGES.map((language) =>
      el('option', { text: language.nativeName, attrs: { value: language.code } })
    )
  );
  refs.langSelect.value = store.lang;
}

/** Apply translations to every element carrying data-i18n. */
function applyStaticText() {
  const lang = store.lang;

  for (const node of $$('[data-i18n]')) {
    node.textContent = t(lang, node.dataset.i18n);
  }

  document.documentElement.lang = lang;
  refs.textInput.placeholder = t(lang, 'ctl.typeInstead');
  refs.micButton.setAttribute('aria-label', t(lang, 'a11y.micButton'));
  refs.liveRegion.setAttribute('aria-label', t(lang, 'a11y.liveRegion'));
  refs.ttsToggle.title = t(lang, 'ctl.voiceReplies');
  refs.helpButton.title = t(lang, 'ctl.help');
}

/** Mic button label reflects the recogniser state, not the last command. */
function renderMicState() {
  const lang = store.lang;
  const state = recognizer.state;

  refs.micButton.dataset.state = state;
  refs.micButton.disabled = state === 'unsupported';

  const labels = {
    idle: 'mic.idle',
    listening: 'mic.listening',
    processing: 'mic.processing',
    denied: 'mic.denied',
    error: 'mic.denied',
    unsupported: 'mic.unsupported'
  };

  refs.micStatus.textContent = t(lang, labels[state] || 'mic.idle');
}

function renderConnection() {
  const lang = store.lang;
  const online = api.online === true;

  refs.connectionBadge.dataset.state = online ? 'synced' : 'local';
  refs.connectionBadge.textContent = t(lang, online ? 'ctl.online' : 'ctl.offline');
}

// --------------------------------------------------------------- handlers --

const listHandlers = {
  onToggle: (id) => store.toggleBought(id),
  onQuantity: (id, quantity) => store.setQuantity(id, quantity),
  onRemove: (id) => store.removeItem(id)
};

const panelHandlers = {
  onAdd: (entry) => store.addProduct({ productId: entry.id, name: entry.name }),
  onDismissSubstitutes: () => store.dismissSubstitutes()
};

const feedbackHandlers = {
  /** Replace a badly-matched item with the alternative the user picked. */
  onSwap: async (itemId, alternative) => {
    await store.removeItem(itemId);
    await store.addProduct({ productId: alternative.id, name: alternative.name });
    announce(refs, t(store.lang, 'say.addedSimple', { item: alternative.name }));
  },
  onAdd: (entry) => store.addProduct({ productId: entry.id, name: entry.name }),
  onRetry: () => bootstrap(),
  onDismiss: () => store.clearError()
};

/** Single render pass driven by store state. */
function renderAll() {
  renderList(refs, store, listHandlers);
  renderPanels(refs, store, panelHandlers);
  renderTranscript(refs, store);
  renderActionChips(refs, store, feedbackHandlers);
  renderError(refs, store, feedbackHandlers);
  renderConnection();
  renderMicState();
}

store.subscribe(renderAll);

/**
 * Run a command and voice the reply.
 * The single funnel for speech, typed input and tapped help examples, so all
 * three behave identically.
 */
async function runCommand(text, options = {}) {
  refs.transcript.dataset.state = 'processing';

  try {
    const responses = await store.dispatch(text, options);

    const spoken = responses
      .map((response) => response.speak)
      .filter(Boolean)
      .join('. ');

    if (spoken) {
      speaker.speak(spoken, { lang: store.speechTag });
      announce(refs, spoken);
    }

    refs.transcript.dataset.state = responses.some((r) => !r.ok) ? 'error' : 'idle';
  } catch (error) {
    console.error('[app] command failed:', error);
    store.setError({ messageKey: 'error.generic', severity: 'error', retry: false });
    refs.transcript.dataset.state = 'error';
  } finally {
    recognizer.finishProcessing();
    renderMicState();
  }
}

// ------------------------------------------------------------ speech wiring --

recognizer.on('stateChange', () => {
  renderMicState();
  if (recognizer.state === 'listening') {
    refs.transcript.dataset.state = 'listening';
  }
});

recognizer.on('interim', ({ transcript }) => {
  renderTranscript(refs, store, { interim: transcript, state: 'listening' });
});

recognizer.on('result', ({ transcript, confidence }) => {
  if (!transcript) return;
  runCommand(transcript, { confidence });
});

recognizer.on('error', ({ benign, terminal, messageKey }) => {
  // "no-speech" fires constantly in hands-free mode and means nothing went
  // wrong — surfacing it would make the app feel broken.
  if (benign && !terminal) {
    refs.transcript.dataset.state = 'idle';
    return;
  }

  store.setError({
    messageKey,
    severity: terminal ? 'error' : 'warn',
    retry: false
  });

  refs.transcript.dataset.state = 'error';
  renderMicState();
});

recognizer.on('end', () => {
  if (!recognizer.wantsToListen) refs.transcript.dataset.state = 'idle';
});

// --------------------------------------------------------------- UI events --

refs.micButton.addEventListener('click', () => {
  store.clearError();
  recognizer.toggle();
});

refs.continuousToggle.addEventListener('change', (event) => {
  const enabled = event.target.checked;
  store.setContinuous(enabled);
  recognizer.setContinuous(enabled);
  if (enabled && recognizer.state !== 'listening') recognizer.start();
});

refs.textForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = refs.textInput.value.trim();
  if (!text) return;
  refs.textInput.value = '';
  runCommand(text, { confidence: null });
});

refs.langSelect.addEventListener('change', (event) => {
  store.setLanguage(event.target.value);
  recognizer.setLanguage(store.speechTag);
  speaker.setLanguage(store.speechTag);
  applyStaticText();
  renderAll();
});

refs.ttsToggle.addEventListener('click', () => {
  const enabled = !store.settings.speakReplies;
  store.setSpeakReplies(enabled);
  speaker.setEnabled(enabled);
  refs.ttsToggle.setAttribute('aria-pressed', String(enabled));
});

refs.helpButton.addEventListener('click', () => {
  openHelp(refs, store, (example) => runCommand(example, { confidence: null }));
});

refs.helpClose.addEventListener('click', () => refs.helpDialog.close());

for (const tab of refs.tabs) {
  tab.addEventListener('click', () => store.setActivePanel(tab.dataset.tab));
}

refs.undoButton.addEventListener('click', () => store.undo());

refs.clearButton.addEventListener('click', () => {
  // Clearing is the only destructive one-tap action, and it is easy to hit by
  // accident on a phone — so it confirms, and undo still covers a mistake.
  if (store.list.items.length > 1 && !window.confirm(t(store.lang, 'list.clearAll') + '?')) return;
  store.clearList();
});

// Stop speech when the tab is hidden: a backgrounded page that keeps listening
// is both a battery drain and a privacy problem.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    recognizer.stop();
    speaker.cancel();
  }
});

// A regained connection should resync rather than wait for the next command.
window.addEventListener('online', () => {
  api.probe().then(({ online }) => {
    if (online) store.pushToServer();
    renderConnection();
  });
});

window.addEventListener('offline', () => {
  api.online = false;
  renderConnection();
});

// ------------------------------------------------------------------ start --

async function bootstrap() {
  buildLanguageSelect();
  applyStaticText();

  refs.ttsToggle.setAttribute('aria-pressed', String(store.settings.speakReplies && ttsSupported));
  refs.ttsToggle.disabled = !ttsSupported;
  refs.continuousToggle.checked = store.settings.continuous;

  if (!speechSupported) {
    // Not an error state so much as a capability gap: say so once, keep the
    // text input, and let the rest of the app work normally.
    store.setError({ messageKey: 'error.micUnsupported', severity: 'warn', retry: false });
  }

  renderAll();

  try {
    await store.bootstrap();
  } catch (error) {
    console.error('[app] bootstrap failed:', error);
    store.setError({ messageKey: 'error.server', severity: 'warn', retry: true });
  }

  renderConnection();

  if (store.settings.continuous && speechSupported) recognizer.start();
}

bootstrap();

// Exposed for manual poking from the console and for the browser-side smoke
// checks in docs/TESTING.md; nothing in the app reads it.
globalThis.__vcsa = { store, api, recognizer, speaker, runCommand };
