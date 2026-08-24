/**
 * Store categories, ordered the way a shopper physically walks a supermarket.
 * `aisle` drives the sort order of the rendered list so the printed/spoken list
 * reads in walking order rather than insertion order.
 *
 * Display names are NOT stored here — they live in shared/i18n/* keyed by
 * `category.<id>` so the same structure serves every supported language.
 */

export const CATEGORIES = [
  { id: 'produce',       aisle: 1,  icon: '\u{1F96C}', color: '#4ca66b' },
  { id: 'bakery',        aisle: 2,  icon: '\u{1F35E}', color: '#c98b3a' },
  { id: 'dairy',         aisle: 3,  icon: '\u{1F95B}', color: '#4a8fd4' },
  { id: 'meat',          aisle: 4,  icon: '\u{1F357}', color: '#c25b5b' },
  { id: 'seafood',       aisle: 5,  icon: '\u{1F41F}', color: '#3f9fb0' },
  { id: 'frozen',        aisle: 6,  icon: '\u{1F9CA}', color: '#6aa8d8' },
  { id: 'breakfast',     aisle: 7,  icon: '\u{1F963}', color: '#d4a04a' },
  { id: 'pantry',        aisle: 8,  icon: '\u{1F958}', color: '#b08050' },
  { id: 'condiments',    aisle: 9,  icon: '\u{1F9C2}', color: '#9c7b4a' },
  { id: 'snacks',        aisle: 10, icon: '\u{1F36A}', color: '#d08a5a' },
  { id: 'beverages',     aisle: 11, icon: '\u{1F964}', color: '#7a6bd0' },
  { id: 'household',     aisle: 12, icon: '\u{1F9F4}', color: '#7d8794' },
  { id: 'personal_care', aisle: 13, icon: '\u{1F9F4}', color: '#b06a9c' },
  { id: 'baby',          aisle: 14, icon: '\u{1F37C}', color: '#d98fa8' },
  { id: 'pet',           aisle: 15, icon: '\u{1F415}', color: '#8a7a5c' },
  { id: 'other',         aisle: 99, icon: '\u{1F4E6}', color: '#8a8a8a' }
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

/** Look up a category record, always returning a valid one. */
export function getCategory(id) {
  return BY_ID.get(id) || BY_ID.get('other');
}

/** Aisle position used for sorting; unknown categories sort last. */
export function aisleOf(id) {
  return getCategory(id).aisle;
}

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
