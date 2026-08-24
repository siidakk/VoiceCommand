/**
 * Substitution graph.
 *
 * Powers the assignment's "suggest almond milk if the user mentions regular
 * milk" requirement, and the out-of-stock fallback.
 *
 * Each entry maps a product id to ranked alternatives. `reason` is an i18n key
 * resolved through shared/i18n so the explanation shown next to a suggestion
 * ("dairy-free alternative") is translated like everything else.
 *
 * Reason keys: dairyFree | vegan | healthier | cheaper | similar | glutenFree
 *              | leaner | premium
 */

export const SUBSTITUTES = {
  milk: [
    { id: 'almond_milk', reason: 'dairyFree' },
    { id: 'oat_milk', reason: 'dairyFree' },
    { id: 'soy_milk', reason: 'vegan' }
  ],
  almond_milk: [
    { id: 'oat_milk', reason: 'similar' },
    { id: 'soy_milk', reason: 'cheaper' },
    { id: 'milk', reason: 'cheaper' }
  ],
  soy_milk: [
    { id: 'almond_milk', reason: 'similar' },
    { id: 'oat_milk', reason: 'similar' }
  ],
  oat_milk: [
    { id: 'almond_milk', reason: 'similar' },
    { id: 'soy_milk', reason: 'cheaper' }
  ],
  butter: [
    { id: 'olive_oil', reason: 'healthier' },
    { id: 'ghee', reason: 'similar' }
  ],
  ghee: [{ id: 'butter', reason: 'cheaper' }],
  cream: [{ id: 'yogurt', reason: 'healthier' }],
  yogurt: [
    { id: 'greek_yogurt', reason: 'healthier' },
    { id: 'paneer', reason: 'similar' }
  ],
  greek_yogurt: [{ id: 'yogurt', reason: 'cheaper' }],
  cheese: [{ id: 'paneer', reason: 'similar' }],
  paneer: [
    { id: 'cheese', reason: 'similar' },
    { id: 'chickpeas', reason: 'vegan' }
  ],
  eggs: [{ id: 'paneer', reason: 'similar' }],

  bread: [
    { id: 'brown_bread', reason: 'healthier' },
    { id: 'tortilla', reason: 'similar' },
    { id: 'buns', reason: 'similar' }
  ],
  brown_bread: [{ id: 'bread', reason: 'cheaper' }],
  buns: [{ id: 'bread', reason: 'cheaper' }],
  tortilla: [{ id: 'bread', reason: 'similar' }],
  bagel: [{ id: 'bread', reason: 'cheaper' }],
  croissant: [{ id: 'muffin', reason: 'similar' }],
  muffin: [{ id: 'croissant', reason: 'similar' }],
  cake: [{ id: 'muffin', reason: 'cheaper' }],

  sugar: [{ id: 'honey', reason: 'healthier' }],
  honey: [{ id: 'jam', reason: 'similar' }],
  jam: [
    { id: 'honey', reason: 'healthier' },
    { id: 'peanut_butter', reason: 'similar' }
  ],
  peanut_butter: [{ id: 'jam', reason: 'cheaper' }],

  rice: [
    { id: 'pasta', reason: 'similar' },
    { id: 'noodles', reason: 'cheaper' }
  ],
  pasta: [
    { id: 'noodles', reason: 'cheaper' },
    { id: 'rice', reason: 'glutenFree' }
  ],
  noodles: [{ id: 'pasta', reason: 'healthier' }],
  flour: [{ id: 'oats', reason: 'glutenFree' }],
  cereal: [
    { id: 'oats', reason: 'healthier' },
    { id: 'granola_bar', reason: 'similar' }
  ],
  oats: [{ id: 'cereal', reason: 'similar' }],

  cooking_oil: [{ id: 'olive_oil', reason: 'healthier' }],
  olive_oil: [{ id: 'cooking_oil', reason: 'cheaper' }],

  chicken: [
    { id: 'chicken_breast', reason: 'leaner' },
    { id: 'turkey', reason: 'leaner' },
    { id: 'paneer', reason: 'vegan' }
  ],
  chicken_breast: [
    { id: 'chicken', reason: 'cheaper' },
    { id: 'turkey', reason: 'similar' },
    { id: 'fish_fillet', reason: 'healthier' }
  ],
  ground_beef: [
    { id: 'chicken_breast', reason: 'leaner' },
    { id: 'lentils', reason: 'vegan' }
  ],
  mutton: [{ id: 'chicken', reason: 'cheaper' }],
  bacon: [{ id: 'sausage', reason: 'similar' }],
  sausage: [{ id: 'bacon', reason: 'similar' }],
  turkey: [{ id: 'chicken_breast', reason: 'cheaper' }],
  salmon: [
    { id: 'fish_fillet', reason: 'cheaper' },
    { id: 'tuna', reason: 'cheaper' }
  ],
  fish_fillet: [{ id: 'salmon', reason: 'premium' }],
  tuna: [{ id: 'chickpeas', reason: 'vegan' }],
  shrimp: [{ id: 'fish_fillet', reason: 'cheaper' }],

  lentils: [{ id: 'chickpeas', reason: 'similar' }],
  chickpeas: [
    { id: 'lentils', reason: 'similar' },
    { id: 'canned_beans', reason: 'similar' }
  ],
  canned_beans: [{ id: 'chickpeas', reason: 'similar' }],

  potato: [{ id: 'frozen_fries', reason: 'similar' }],
  frozen_fries: [{ id: 'potato', reason: 'healthier' }],
  frozen_peas: [{ id: 'peas', reason: 'similar' }],
  peas: [{ id: 'frozen_peas', reason: 'cheaper' }],
  tomato: [{ id: 'canned_tomatoes', reason: 'cheaper' }],
  canned_tomatoes: [{ id: 'tomato', reason: 'similar' }],
  lettuce: [{ id: 'spinach', reason: 'healthier' }],
  spinach: [{ id: 'lettuce', reason: 'similar' }],
  strawberry: [{ id: 'frozen_berries', reason: 'cheaper' }],
  frozen_berries: [{ id: 'strawberry', reason: 'similar' }],
  apple: [{ id: 'banana', reason: 'cheaper' }],
  banana: [{ id: 'apple', reason: 'similar' }],
  orange: [
    { id: 'lemon', reason: 'similar' },
    { id: 'orange_juice', reason: 'similar' }
  ],

  chips: [
    { id: 'popcorn', reason: 'healthier' },
    { id: 'nuts', reason: 'healthier' },
    { id: 'crackers', reason: 'similar' }
  ],
  cookies: [
    { id: 'granola_bar', reason: 'healthier' },
    { id: 'crackers', reason: 'similar' }
  ],
  chocolate: [
    { id: 'granola_bar', reason: 'healthier' },
    { id: 'nuts', reason: 'healthier' }
  ],
  popcorn: [{ id: 'chips', reason: 'similar' }],
  crackers: [{ id: 'cookies', reason: 'similar' }],
  granola_bar: [{ id: 'nuts', reason: 'similar' }],

  cola: [
    { id: 'sparkling_water', reason: 'healthier' },
    { id: 'orange_juice', reason: 'healthier' },
    { id: 'coconut_water', reason: 'healthier' }
  ],
  energy_drink: [{ id: 'coffee', reason: 'cheaper' }],
  orange_juice: [
    { id: 'apple_juice', reason: 'similar' },
    { id: 'orange', reason: 'healthier' }
  ],
  apple_juice: [{ id: 'orange_juice', reason: 'similar' }],
  sparkling_water: [{ id: 'water', reason: 'cheaper' }],
  water: [{ id: 'sparkling_water', reason: 'premium' }],
  coffee: [{ id: 'tea', reason: 'cheaper' }],
  tea: [{ id: 'coffee', reason: 'similar' }],
  beer: [{ id: 'wine', reason: 'premium' }],
  wine: [{ id: 'beer', reason: 'cheaper' }],
  ice_cream: [{ id: 'frozen_berries', reason: 'healthier' }],

  ketchup: [{ id: 'hot_sauce', reason: 'similar' }],
  hot_sauce: [{ id: 'ketchup', reason: 'similar' }],
  mayonnaise: [{ id: 'yogurt', reason: 'healthier' }],
  mustard: [{ id: 'mayonnaise', reason: 'similar' }],

  toilet_paper: [{ id: 'tissues', reason: 'similar' }],
  paper_towels: [{ id: 'tissues', reason: 'similar' }],
  tissues: [{ id: 'paper_towels', reason: 'similar' }],
  dish_soap: [{ id: 'cleaning_spray', reason: 'similar' }],
  cleaning_spray: [{ id: 'dish_soap', reason: 'cheaper' }],
  detergent: [{ id: 'soap', reason: 'cheaper' }],

  shampoo: [{ id: 'body_wash', reason: 'similar' }],
  conditioner: [{ id: 'shampoo', reason: 'similar' }],
  body_wash: [{ id: 'soap', reason: 'cheaper' }],
  soap: [{ id: 'body_wash', reason: 'premium' }],
  hand_sanitizer: [{ id: 'soap', reason: 'cheaper' }],
  face_wash: [{ id: 'soap', reason: 'cheaper' }],
  toothbrush: [{ id: 'toothpaste', reason: 'similar' }],

  diapers: [{ id: 'baby_wipes', reason: 'similar' }],
  baby_formula: [{ id: 'milk', reason: 'cheaper' }],
  dog_food: [{ id: 'pet_treats', reason: 'similar' }],
  cat_food: [{ id: 'pet_treats', reason: 'similar' }]
};

/**
 * Alternatives for a product id, optionally filtered by an availability check.
 *
 * @param {string} id                     product to replace
 * @param {(id: string) => boolean} [isAvailable]  stock predicate
 * @param {number} [limit=3]
 * @returns {{ id: string, reason: string }[]}
 */
export function substitutesFor(id, isAvailable, limit = 3) {
  const list = SUBSTITUTES[id] || [];
  const usable = typeof isAvailable === 'function' ? list.filter((s) => isAvailable(s.id)) : list;
  return usable.slice(0, limit);
}
