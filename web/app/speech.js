/**
 * Web Speech API wrapper.
 *
 * Uses the browser's built-in SpeechRecognition rather than a cloud STT
 * service: it is free, needs no API key in a public repo, adds zero
 * dependencies, and keeps the audio on the device. The trade-off is browser
 * support, which is why every failure mode below is handled explicitly and the
 * app always keeps a working text input.
 *
 * The API is quirky in ways that matter:
 *   - Chrome fires `onend` after every utterance even in continuous mode, so
 *     hands-free listening has to restart itself.
 *   - iOS Safari ignores `continuous` entirely and stops after one result.
 *   - `onerror` fires for benign situations ("no-speech") as well as real ones,
 *     so errors are classified rather than shown raw.
 *   - Recognition cannot change language mid-session; the instance is rebuilt.
 */

/** Vendor-prefixed on WebKit, unprefixed elsewhere. */
const SpeechRecognitionImpl =
  globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition || null;

/** Errors that mean "try again", not "something is broken". */
const BENIGN_ERRORS = new Set(['no-speech', 'aborted']);

/** Map a raw error code to one of our i18n keys. */
const ERROR_KEYS = {
  'not-allowed': 'error.micDenied',
  'service-not-allowed': 'error.micDenied',
  'no-speech': 'error.noSpeech',
  network: 'error.network',
  'audio-capture': 'error.audioCapture',
  aborted: 'error.aborted'
};

export const isSupported = Boolean(SpeechRecognitionImpl);

/**
 * A restartable speech recogniser with an event-emitter interface.
 *
 * Events: start, interim, result, error, end, stateChange
 */
export class VoiceRecognizer {
  /**
   * @param {object} [options]
   * @param {string} [options.lang='en-US'] BCP-47 tag
   * @param {boolean} [options.continuous=false] keep listening after a result
   */
  constructor(options = {}) {
    this.lang = options.lang || 'en-US';
    this.continuous = Boolean(options.continuous);

    this.recognition = null;
    this.state = isSupported ? 'idle' : 'unsupported';
    this.listeners = new Map();

    /** Set while we intend to be listening, so onend can decide to restart. */
    this.wantsToListen = false;

    /** Guards the restart loop from spinning if the mic is permanently broken. */
    this.consecutiveFailures = 0;
    this.restartTimer = null;
  }

  /** Subscribe. Returns an unsubscribe function. */
  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  emit(event, payload) {
    for (const handler of this.listeners.get(event) || []) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[speech] listener for "${event}" threw:`, error);
      }
    }
  }

  setState(state) {
    if (this.state === state) return;
    this.state = state;
    this.emit('stateChange', state);
  }

  /**
   * Change recognition language.
   * A live session is torn down and rebuilt, because the spec does not allow
   * changing `lang` on a running recogniser.
   */
  setLanguage(tag) {
    if (this.lang === tag) return;
    this.lang = tag;

    if (this.recognition) {
      const wasListening = this.wantsToListen;
      this.stop();
      this.recognition = null;
      if (wasListening) this.start();
    }
  }

  setContinuous(enabled) {
    this.continuous = Boolean(enabled);
    if (this.recognition) this.recognition.continuous = this.continuous;
  }

  /** Build and wire a recognition instance. */
  build() {
    const recognition = new SpeechRecognitionImpl();

    recognition.lang = this.lang;
    recognition.continuous = this.continuous;
    recognition.interimResults = true;
    // A couple of alternatives cost nothing and let the UI offer a correction
    // when the top hypothesis matches no product.
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      this.consecutiveFailures = 0;
      this.setState('listening');
      this.emit('start');
    };

    recognition.onresult = (event) => {
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const best = result[0];

        if (result.isFinal) {
          const alternatives = [];
          for (let a = 1; a < result.length; a += 1) alternatives.push(result[a].transcript.trim());

          this.setState('processing');
          this.emit('result', {
            transcript: best.transcript.trim(),
            // Chrome reports 0 confidence for some locales; treat that as
            // "unknown" rather than "certainly wrong".
            confidence: best.confidence > 0 ? best.confidence : null,
            alternatives
          });
        } else {
          interim += best.transcript;
        }
      }

      if (interim.trim()) this.emit('interim', { transcript: interim.trim() });
    };

    recognition.onerror = (event) => {
      const code = event.error || 'unknown';
      const benign = BENIGN_ERRORS.has(code);

      if (!benign) this.consecutiveFailures += 1;

      // A permission or hardware failure is terminal: stop trying, and let the
      // UI fall back to the text input rather than pulsing forever.
      const terminal = code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture';
      if (terminal) {
        this.wantsToListen = false;
        this.setState(code === 'audio-capture' ? 'error' : 'denied');
      }

      this.emit('error', {
        code,
        benign,
        terminal,
        messageKey: ERROR_KEYS[code] || 'error.generic'
      });
    };

    recognition.onend = () => {
      this.emit('end');

      // Chrome ends the session after each utterance. Restart if the user
      // still wants hands-free mode and we are not failing repeatedly.
      if (this.wantsToListen && this.continuous && this.consecutiveFailures < 3) {
        this.scheduleRestart();
        return;
      }

      this.wantsToListen = false;
      if (this.state !== 'denied' && this.state !== 'error') this.setState('idle');
    };

    return recognition;
  }

  /** Restart after a short delay; immediate restarts are rejected by Chrome. */
  scheduleRestart() {
    clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => {
      if (!this.wantsToListen) return;
      try {
        this.recognition.start();
      } catch {
        // "already started" — harmless, the session is alive.
      }
    }, 350);
  }

  /** Begin listening. Safe to call when already listening. */
  start() {
    if (!isSupported) {
      this.setState('unsupported');
      this.emit('error', {
        code: 'unsupported',
        benign: false,
        terminal: true,
        messageKey: 'error.micUnsupported'
      });
      return false;
    }

    if (this.state === 'listening') return true;

    if (!this.recognition) this.recognition = this.build();

    this.wantsToListen = true;

    try {
      this.recognition.start();
      return true;
    } catch (error) {
      // InvalidStateError means a session is already running, which is fine.
      if (error.name !== 'InvalidStateError') {
        this.wantsToListen = false;
        this.setState('idle');
        this.emit('error', {
          code: 'start-failed',
          benign: false,
          terminal: false,
          messageKey: 'error.generic'
        });
        return false;
      }
      return true;
    }
  }

  /** Stop listening and cancel any pending restart. */
  stop() {
    this.wantsToListen = false;
    clearTimeout(this.restartTimer);

    if (!this.recognition) {
      this.setState('idle');
      return;
    }

    try {
      this.recognition.stop();
    } catch {
      // Already stopped.
    }
  }

  /** Toggle listening; the mic button's only job. */
  toggle() {
    if (this.state === 'listening') {
      this.stop();
      return false;
    }
    return this.start();
  }

  /** Mark the end of app-side processing so the UI can return to idle. */
  finishProcessing() {
    if (this.state === 'processing') {
      this.setState(this.wantsToListen ? 'listening' : 'idle');
    }
  }
}
