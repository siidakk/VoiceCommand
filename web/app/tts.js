/**
 * Spoken replies via the built-in SpeechSynthesis API.
 *
 * Voice output is what makes the app usable without looking at it — the
 * assignment's "voice-only interface" — so every action the assistant takes
 * gets confirmed aloud when this is enabled.
 *
 * Browser quirks handled here:
 *   - The voice list loads asynchronously, and on Chrome is empty until the
 *     `voiceschanged` event fires.
 *   - Speaking while already speaking queues rather than replaces, which makes
 *     a rapid sequence of commands run long; each new reply cancels the last.
 *   - Some engines never fire `onend`, so nothing is allowed to await it.
 */

const synth = globalThis.speechSynthesis || null;

export const isSupported = Boolean(synth);

let voices = [];

/** Refresh the cached voice list. */
function loadVoices() {
  if (!synth) return;
  voices = synth.getVoices() || [];
}

if (synth) {
  loadVoices();
  // Chrome populates voices asynchronously after page load.
  synth.addEventListener?.('voiceschanged', loadVoices);
}

/**
 * Best available voice for a BCP-47 tag.
 *
 * Prefers an exact locale match, then any voice for the base language, then
 * nothing — in which case the engine picks its default, which is still better
 * than staying silent.
 */
function pickVoice(tag) {
  if (!voices.length) loadVoices();
  if (!voices.length) return null;

  const wanted = tag.toLowerCase();
  const base = wanted.split('-')[0];

  return (
    voices.find((voice) => voice.lang.toLowerCase() === wanted) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith(`${base}-`)) ||
    voices.find((voice) => voice.lang.toLowerCase() === base) ||
    null
  );
}

export class Speaker {
  /**
   * @param {object} [options]
   * @param {boolean} [options.enabled=true]
   * @param {string} [options.lang='en-US']
   */
  constructor(options = {}) {
    this.enabled = options.enabled ?? true;
    this.lang = options.lang || 'en-US';
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) this.cancel();
  }

  setLanguage(tag) {
    this.lang = tag;
  }

  /** True when this browser can speak and the user has not muted it. */
  get available() {
    return isSupported && this.enabled;
  }

  /**
   * Speak a phrase, replacing anything currently queued.
   *
   * Deliberately fire-and-forget: a stalled utterance must never block the UI
   * from processing the next command.
   *
   * @param {string} text
   * @param {object} [options]
   * @param {string} [options.lang] override the configured language
   */
  speak(text, options = {}) {
    if (!this.available) return;

    const phrase = String(text || '').trim();
    if (!phrase) return;

    try {
      // Replace rather than queue, so five quick commands do not produce five
      // backed-up confirmations.
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(phrase);
      const tag = options.lang || this.lang;

      utterance.lang = tag;
      utterance.rate = 1.05;
      utterance.pitch = 1;
      utterance.volume = 1;

      const voice = pickVoice(tag);
      if (voice) utterance.voice = voice;

      utterance.onerror = (event) => {
        // "interrupted" and "canceled" are expected whenever a new reply
        // pre-empts an old one, and are not worth logging as failures.
        if (event.error && event.error !== 'interrupted' && event.error !== 'canceled') {
          console.warn('[tts] speech failed:', event.error);
        }
      };

      synth.speak(utterance);
    } catch (error) {
      console.warn('[tts] could not speak:', error);
    }
  }

  /** Stop anything in progress. */
  cancel() {
    if (!isSupported) return;
    try {
      synth.cancel();
    } catch {
      // Nothing was speaking.
    }
  }
}
