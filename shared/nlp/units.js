/**
 * Unit-of-measure recognition.
 *
 * Splits into two kinds, because they behave differently downstream:
 *   - measures  (kg, g, l, ml) describe an amount of the product itself
 *   - containers (bottle, pack, dozen) describe how it is sold
 *
 * "2 litres of milk" and "2 bottles of water" both yield quantity 2, but only
 * the first should ever be re-expressed as grams, so the distinction is kept.
 */

/**
 * Canonical unit -> spoken forms in every supported language.
 * All forms are given in normalised shape (lowercase, accents folded).
 */
const UNIT_FORMS = {
  // ------------------------------------------------------------- measures
  kg: {
    kind: 'measure',
    forms: ['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms', 'kilogramme', 'kilogrammes',
      'किलो', 'किलोग्राम', 'kilogramo', 'kilogramos', 'kilogramme']
  },
  g: {
    kind: 'measure',
    forms: ['g', 'gm', 'gms', 'gram', 'grams', 'gramme', 'grammes',
      'ग्राम', 'gramo', 'gramos']
  },
  l: {
    kind: 'measure',
    forms: ['l', 'lt', 'ltr', 'litre', 'litres', 'liter', 'liters',
      'लीटर', 'litro', 'litros']
  },
  ml: {
    kind: 'measure',
    forms: ['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters',
      'मिलीलीटर', 'mililitro', 'mililitros']
  },
  lb: {
    kind: 'measure',
    forms: ['lb', 'lbs', 'pound', 'pounds', 'libra', 'libras', 'livre', 'livres']
  },

  // ------------------------------------------------------------ containers
  dozen: {
    kind: 'container',
    forms: ['dozen', 'dozens', 'दर्जन', 'darjan', 'docena', 'docenas', 'douzaine', 'douzaines']
  },
  bottle: {
    kind: 'container',
    forms: ['bottle', 'bottles', 'बोतल', 'botella', 'botellas', 'bouteille', 'bouteilles']
  },
  can: {
    kind: 'container',
    forms: ['can', 'cans', 'tin', 'tins', 'डिब्बा', 'lata', 'latas', 'boite', 'boites', 'canette', 'canettes']
  },
  pack: {
    kind: 'container',
    forms: ['pack', 'packs', 'packet', 'packets', 'pkt', 'पैकेट', 'paquete', 'paquetes', 'paquet', 'paquets']
  },
  box: {
    kind: 'container',
    forms: ['box', 'boxes', 'डिब्बे', 'caja', 'cajas', 'boite', 'boites']
  },
  bag: {
    kind: 'container',
    forms: ['bag', 'bags', 'sack', 'sacks', 'थैला', 'bolsa', 'bolsas', 'sac', 'sacs']
  },
  jar: {
    kind: 'container',
    forms: ['jar', 'jars', 'बरनी', 'tarro', 'tarros', 'pot', 'pots', 'bocal', 'bocaux']
  },
  carton: {
    kind: 'container',
    forms: ['carton', 'cartons', 'brick', 'carton de leche', 'brique', 'briques']
  },
  loaf: {
    kind: 'container',
    // 'baguette' is deliberately absent: in French it names the product far
    // more often than the unit, so it belongs to Bread's aliases instead.
    forms: ['loaf', 'loaves', 'barra', 'barras', 'miche']
  },
  bunch: {
    kind: 'container',
    forms: ['bunch', 'bunches', 'गुच्छा', 'manojo', 'manojos', 'botte', 'bottes']
  },
  head: {
    kind: 'container',
    forms: ['head', 'heads', 'cabeza', 'tete', 'tetes']
  },
  roll: {
    kind: 'container',
    forms: ['roll', 'rolls', 'रोल', 'rollo', 'rollos', 'rouleau', 'rouleaux']
  },
  tube: {
    kind: 'container',
    forms: ['tube', 'tubes', 'ट्यूब', 'tubo', 'tubos']
  },
  bar: {
    kind: 'container',
    forms: ['bar', 'bars', 'slab', 'tableta', 'tabletas', 'tablette', 'tablettes']
  },
  cup: {
    kind: 'container',
    forms: ['cup', 'cups', 'pot', 'कप', 'vaso', 'vasos', 'taza', 'tazas']
  },
  tub: {
    kind: 'container',
    forms: ['tub', 'tubs', 'tarrina', 'bac']
  },
  pcs: {
    kind: 'container',
    forms: ['piece', 'pieces', 'pcs', 'pc', 'unit', 'units', 'item', 'items',
      'नग', 'pieza', 'piezas', 'unidad', 'unidades', 'piece', 'unite', 'unites']
  }
};

/** Reverse index: spoken form -> { unit, kind }. */
const FORM_INDEX = new Map();
for (const [unit, { kind, forms }] of Object.entries(UNIT_FORMS)) {
  for (const form of forms) {
    // First writer wins, so the canonical unit owns its own name.
    if (!FORM_INDEX.has(form)) FORM_INDEX.set(form, { unit, kind });
  }
}

/**
 * Find the unit in an utterance.
 *
 * Scans tokens rather than running a regex over the whole string so a product
 * name containing a unit word ("canned beans" holding "can") cannot be
 * mistaken for packaging — only standalone tokens count.
 *
 * @param {string} text normalised, number-digitised text
 * @returns {{ unit: string, kind: string, token: string, tokenIndex: number } | null}
 */
export function extractUnit(text) {
  const tokens = text.split(' ');

  for (let i = 0; i < tokens.length; i += 1) {
    const hit = FORM_INDEX.get(tokens[i]);
    if (!hit) continue;

    // "canned tomatoes" / "packed lunch": a unit word directly modifying the
    // next word is an adjective, not a measure. Require it to be preceded by a
    // number, or followed by "of"/end, to count as packaging.
    const previous = tokens[i - 1];
    const next = tokens[i + 1];
    const afterNumber = previous !== undefined && /^\d+(\.\d+)?$/.test(previous);
    const beforeOf = next === 'of' || next === 'de' || next === 'का' || next === 'की' || next === 'd';
    const atEnd = next === undefined;

    if (afterNumber || beforeOf || atEnd) {
      return { unit: hit.unit, kind: hit.kind, token: tokens[i], tokenIndex: i };
    }
  }

  return null;
}

/**
 * Strip the unit token (and a trailing "of"/"de") from an utterance so what
 * remains is the product name.
 *
 * @param {string} text normalised text
 * @param {{ tokenIndex: number }} unitHit result of extractUnit
 */
export function removeUnit(text, unitHit) {
  if (!unitHit) return text;

  const tokens = text.split(' ');
  const drop = new Set([unitHit.tokenIndex]);

  const next = tokens[unitHit.tokenIndex + 1];
  if (next === 'of' || next === 'de' || next === 'd' || next === 'का' || next === 'की') {
    drop.add(unitHit.tokenIndex + 1);
  }

  return tokens
    .filter((_, i) => !drop.has(i))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Unit names in the non-English locales.
 *
 * These live here rather than in shared/i18n because they are a property of
 * the unit system, not of the UI copy — the same table serves both the spoken
 * confirmation and the rendered list row.
 */
const LOCALISED_UNITS = {
  hi: {
    kg: 'किलो', g: 'ग्राम', l: 'लीटर', ml: 'मिली', lb: 'पाउंड',
    dozen: 'दर्जन', bottle: 'बोतल', can: 'डिब्बा', pack: 'पैकेट', box: 'डिब्बा',
    bag: 'थैला', jar: 'बरनी', carton: 'डिब्बा', loaf: 'पाव', bunch: 'गुच्छा',
    head: 'नग', roll: 'रोल', tube: 'ट्यूब', bar: 'बार', cup: 'कप', tub: 'डिब्बा', pcs: 'नग'
  },
  es: {
    kg: 'kg', g: 'g', l: 'L', ml: 'ml', lb: ['libra', 'libras'],
    dozen: 'docena', bottle: ['botella', 'botellas'], can: ['lata', 'latas'],
    pack: ['paquete', 'paquetes'], box: ['caja', 'cajas'], bag: ['bolsa', 'bolsas'],
    jar: ['tarro', 'tarros'], carton: ['cartón', 'cartones'], loaf: ['barra', 'barras'],
    bunch: ['manojo', 'manojos'], head: ['unidad', 'unidades'], roll: ['rollo', 'rollos'],
    tube: ['tubo', 'tubos'], bar: ['tableta', 'tabletas'], cup: ['vaso', 'vasos'],
    tub: ['tarrina', 'tarrinas'], pcs: ['unidad', 'unidades']
  },
  fr: {
    kg: 'kg', g: 'g', l: 'L', ml: 'ml', lb: ['livre', 'livres'],
    dozen: 'douzaine', bottle: ['bouteille', 'bouteilles'], can: ['boîte', 'boîtes'],
    pack: ['paquet', 'paquets'], box: ['boîte', 'boîtes'], bag: ['sac', 'sacs'],
    jar: ['pot', 'pots'], carton: ['brique', 'briques'], loaf: ['baguette', 'baguettes'],
    bunch: ['botte', 'bottes'], head: ['pièce', 'pièces'], roll: ['rouleau', 'rouleaux'],
    tube: ['tube', 'tubes'], bar: ['tablette', 'tablettes'], cup: ['pot', 'pots'],
    tub: ['bac', 'bacs'], pcs: ['pièce', 'pièces']
  }
};

/**
 * Human-readable unit label for a quantity, pluralised in English and
 * translated elsewhere.
 */
export function unitLabel(unit, quantity, lang = 'en') {
  if (!unit) return '';

  if (lang !== 'en') {
    const translated = (LOCALISED_UNITS[lang] || {})[unit];
    // Entries are either an invariant string (symbols like kg) or a
    // [singular, plural] pair, so "1 barra" does not read as "1 barras".
    if (Array.isArray(translated)) return quantity === 1 ? translated[0] : translated[1];
    // Fall back to the canonical token rather than an English plural, which
    // would read worse inside an otherwise translated sentence.
    return translated || unit;
  }

  const plurals = {
    kg: 'kg', g: 'g', l: 'L', ml: 'ml', lb: quantity === 1 ? 'lb' : 'lbs',
    dozen: quantity === 1 ? 'dozen' : 'dozen',
    bottle: quantity === 1 ? 'bottle' : 'bottles',
    can: quantity === 1 ? 'can' : 'cans',
    pack: quantity === 1 ? 'pack' : 'packs',
    box: quantity === 1 ? 'box' : 'boxes',
    bag: quantity === 1 ? 'bag' : 'bags',
    jar: quantity === 1 ? 'jar' : 'jars',
    carton: quantity === 1 ? 'carton' : 'cartons',
    loaf: quantity === 1 ? 'loaf' : 'loaves',
    bunch: quantity === 1 ? 'bunch' : 'bunches',
    head: quantity === 1 ? 'head' : 'heads',
    roll: quantity === 1 ? 'roll' : 'rolls',
    tube: quantity === 1 ? 'tube' : 'tubes',
    bar: quantity === 1 ? 'bar' : 'bars',
    cup: quantity === 1 ? 'cup' : 'cups',
    tub: quantity === 1 ? 'tub' : 'tubs',
    pcs: quantity === 1 ? 'piece' : 'pieces'
  };

  return plurals[unit] || unit;
}
