/**
 * Command reference sheet.
 *
 * Discoverability is the hardest problem in a voice UI — nothing on screen
 * tells you what the grammar accepts. Every example here is a real, tappable
 * command: tapping runs it, so the sheet doubles as a way to try the app
 * without speaking (useful on a desktop with no microphone, and for anyone
 * reviewing the project).
 *
 * Examples are per-language because the grammar is.
 */

import { el, render } from './dom.js';
import { t } from '../../../shared/i18n/index.js';

/** Example commands per language, grouped by what they do. */
const EXAMPLES = {
  en: {
    'help.add': ['Add milk', 'I need apples and bread', 'Add 2 bottles of water', 'Buy a dozen eggs'],
    'help.quantity': ['Change milk to 3', 'Add two litres of milk', 'Add 500 grams of cheese'],
    'help.remove': ['Remove milk from my list', "I don't need bread", 'Clear my list'],
    'help.search': ['Find toothpaste under 200 rupees', 'Find me organic apples', 'Show me Colgate toothpaste'],
    'help.manage': [
      "What's on my list",
      'What should I buy',
      'I got the eggs',
      'What can I use instead of milk'
    ]
  },
  hi: {
    'help.add': ['दूध जोड़ो', 'मुझे ब्रेड और अंडे चाहिए', 'दो लीटर दूध जोड़ो', 'आधा दर्जन अंडे'],
    'help.quantity': ['तीन किलो चावल जोड़ो', '500 ग्राम पनीर जोड़ो'],
    'help.remove': ['दूध हटाओ', 'ब्रेड नहीं चाहिए', 'सूची साफ़ करो'],
    'help.search': ['टूथपेस्ट 200 रुपये से कम', 'शैम्पू 300 रुपये से कम'],
    'help.manage': ['लिस्ट में क्या है', 'क्या खरीदूं', 'दूध की जगह क्या']
  },
  es: {
    'help.add': ['Añade leche', 'Necesito pan y huevos', 'Añade dos litros de leche', 'Media docena de huevos'],
    'help.quantity': ['Cambia leche a 3', 'Añade 500 gramos de queso'],
    'help.remove': ['Quita la leche', 'Ya no necesito pan', 'Borra la lista'],
    'help.search': ['Busca pasta de dientes menos de 200 rupias', 'Busca manzanas'],
    'help.manage': ['Qué hay en mi lista', 'Qué debería comprar', 'Alternativa a leche']
  },
  fr: {
    'help.add': ['Ajoute du lait', "J'ai besoin de pain", 'Ajoute deux litres de lait', 'Une douzaine d\'œufs'],
    'help.quantity': ['Change lait en 3', 'Ajoute 500 grammes de fromage'],
    'help.remove': ['Retire le lait', "Je n'ai plus besoin de pain", 'Vide la liste'],
    'help.search': ['Trouve dentifrice moins de 200 roupies', 'Trouve des pommes'],
    'help.manage': ['Ma liste', 'Que dois-je acheter', 'Alternative à lait']
  }
};

/**
 * Fill and open the help dialog.
 *
 * @param {object} refs
 * @param {import('../state.js').Store} store
 * @param {(text: string) => void} onRun  called when an example is tapped
 */
export function renderHelp(refs, store, onRun) {
  const lang = store.lang;
  const groups = EXAMPLES[lang] || EXAMPLES.en;

  const nodes = Object.entries(groups).map(([titleKey, examples]) =>
    el('section', { className: 'help-group' }, [
      el('h3', { text: t(lang, titleKey) }),
      el(
        'div',
        { className: 'help-examples' },
        examples.map((example) =>
          el('button', {
            className: 'help-example',
            attrs: { type: 'button' },
            text: example,
            on: {
              click: () => {
                refs.helpDialog.close();
                onRun(example);
              }
            }
          })
        )
      )
    ])
  );

  render(refs.helpBody, nodes);
}

export function openHelp(refs, store, onRun) {
  renderHelp(refs, store, onRun);
  if (typeof refs.helpDialog.showModal === 'function') {
    refs.helpDialog.showModal();
  } else {
    // <dialog> is widely supported, but a plain attribute keeps the sheet
    // usable on anything that lacks showModal.
    refs.helpDialog.setAttribute('open', '');
  }
}
