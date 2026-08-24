/**
 * Product catalog.
 *
 * Single source of truth for everything the assistant knows about a product:
 * which aisle it belongs to (auto-categorisation), what it costs (voice price
 * filtering), which brands and sizes exist (voice search refining), how often a
 * household re-buys it (running-low predictions) and what it is called in each
 * supported language (multilingual matching).
 *
 * Prices are USD to match the assignment's "toothpaste under $5" example; the
 * UI can render another currency via shared/i18n/index.js formatCurrency().
 *
 * Field reference
 *   id        stable key, also used in purchase history
 *   name      canonical English display name
 *   category  category id from shared/data/categories.js
 *   price     typical unit price in USD
 *   unit      noun used when speaking a quantity ("2 bottles of water")
 *   brands    brands matched when the user names one
 *   sizes     pack sizes matched when the user names one
 *   tags      free-form attributes ("organic", "gluten-free") for search
 *   syn       extra English phrasings the recogniser may return
 *   alias     { hi, es, fr } spoken forms in the other supported languages
 *   cycleDays typical days between repurchases; drives "running low" alerts
 *   season    1-indexed months when the item is in season / promoted
 */

/** Compact product factory so the table below stays readable. */
const P = (id, name, category, price, unit, extra = {}) => ({
  id,
  name,
  category,
  price,
  unit,
  brands: [],
  sizes: [],
  tags: [],
  syn: [],
  alias: {},
  cycleDays: 0,
  season: [],
  ...extra
});

export const CATALOG = [
  // ----------------------------------------------------------------- produce
  P('apple', 'Apples', 'produce', 3.2, 'kg', {
    brands: ['Washington', 'Pink Lady', 'Granny Smith'],
    sizes: ['500 g', '1 kg', '2 kg'],
    tags: ['organic', 'fresh', 'fruit'],
    syn: ['apple', 'green apples', 'red apples'],
    alias: { hi: ['सेब', 'seb'], es: ['manzana', 'manzanas'], fr: ['pomme', 'pommes'] },
    cycleDays: 7,
    season: [9, 10, 11]
  }),
  P('banana', 'Bananas', 'produce', 1.4, 'dozen', {
    brands: ['Chiquita', 'Dole'],
    sizes: ['6 pcs', '12 pcs', '1 kg'],
    tags: ['fresh', 'fruit'],
    syn: ['banana'],
    alias: { hi: ['केला', 'kela'], es: ['plátano', 'plátanos', 'banana'], fr: ['banane', 'bananes'] },
    cycleDays: 5
  }),
  P('orange', 'Oranges', 'produce', 2.9, 'kg', {
    brands: ['Sunkist', 'Valencia'],
    sizes: ['1 kg', '2 kg'],
    tags: ['fresh', 'fruit', 'citrus'],
    syn: ['orange'],
    alias: { hi: ['संतरा', 'santra'], es: ['naranja', 'naranjas'], fr: ['orange', 'oranges'] },
    cycleDays: 10,
    season: [12, 1, 2, 3]
  }),
  P('tomato', 'Tomatoes', 'produce', 2.1, 'kg', {
    brands: ['Roma', 'Cherry'],
    sizes: ['500 g', '1 kg'],
    tags: ['fresh', 'vegetable'],
    syn: ['tomato'],
    alias: { hi: ['टमाटर', 'tamatar'], es: ['tomate', 'tomates'], fr: ['tomate', 'tomates'] },
    cycleDays: 6,
    season: [6, 7, 8, 9]
  }),
  P('potato', 'Potatoes', 'produce', 1.6, 'kg', {
    sizes: ['1 kg', '2 kg', '5 kg'],
    tags: ['fresh', 'vegetable'],
    syn: ['potato'],
    alias: { hi: ['आलू', 'aloo'], es: ['papa', 'patata', 'patatas'], fr: ['pomme de terre'] },
    cycleDays: 14
  }),
  P('onion', 'Onions', 'produce', 1.8, 'kg', {
    sizes: ['1 kg', '2 kg'],
    tags: ['fresh', 'vegetable'],
    syn: ['onion', 'red onion'],
    alias: { hi: ['प्याज', 'pyaz'], es: ['cebolla', 'cebollas'], fr: ['oignon', 'oignons'] },
    cycleDays: 14
  }),
  P('garlic', 'Garlic', 'produce', 0.9, 'pack', {
    sizes: ['100 g', '250 g'],
    tags: ['fresh', 'vegetable', 'aromatic'],
    alias: { hi: ['लहसुन', 'lehsun'], es: ['ajo'], fr: ['ail'] },
    cycleDays: 21
  }),
  P('ginger', 'Ginger', 'produce', 1.2, 'pack', {
    sizes: ['100 g', '250 g'],
    tags: ['fresh', 'aromatic'],
    alias: { hi: ['अदरक', 'adrak'], es: ['jengibre'], fr: ['gingembre'] },
    cycleDays: 21
  }),
  P('carrot', 'Carrots', 'produce', 1.5, 'kg', {
    sizes: ['500 g', '1 kg'],
    tags: ['fresh', 'vegetable', 'organic'],
    syn: ['carrot'],
    alias: { hi: ['गाजर', 'gajar'], es: ['zanahoria', 'zanahorias'], fr: ['carotte', 'carottes'] },
    cycleDays: 10,
    season: [11, 12, 1, 2]
  }),
  P('spinach', 'Spinach', 'produce', 2.4, 'bunch', {
    sizes: ['200 g', '500 g'],
    tags: ['fresh', 'vegetable', 'leafy', 'organic'],
    alias: { hi: ['पालक', 'palak'], es: ['espinaca', 'espinacas'], fr: ['épinards'] },
    cycleDays: 7,
    season: [3, 4, 5, 10, 11]
  }),
  P('broccoli', 'Broccoli', 'produce', 2.8, 'head', {
    sizes: ['1 head', '500 g'],
    tags: ['fresh', 'vegetable'],
    alias: { hi: ['ब्रोकली'], es: ['brócoli'], fr: ['brocoli'] },
    cycleDays: 10,
    season: [10, 11, 12, 1]
  }),
  P('cucumber', 'Cucumber', 'produce', 1.1, 'pcs', {
    sizes: ['1 pc', '3 pcs'],
    tags: ['fresh', 'vegetable'],
    alias: { hi: ['खीरा', 'kheera'], es: ['pepino'], fr: ['concombre'] },
    cycleDays: 7,
    season: [5, 6, 7, 8]
  }),
  P('lettuce', 'Lettuce', 'produce', 2.2, 'head', {
    sizes: ['1 head'],
    tags: ['fresh', 'vegetable', 'leafy', 'salad'],
    syn: ['iceberg lettuce', 'romaine'],
    alias: { es: ['lechuga'], fr: ['laitue'] },
    cycleDays: 7
  }),
  P('bell_pepper', 'Bell Peppers', 'produce', 3.1, 'kg', {
    sizes: ['250 g', '500 g'],
    tags: ['fresh', 'vegetable'],
    // No bare "peppers": it singularises to "pepper", which "salt and pepper"
    // means as the spice. Black Pepper owns that word.
    syn: ['capsicum', 'bell pepper', 'sweet pepper'],
    alias: { hi: ['शिमला मिर्च', 'shimla mirch'], es: ['pimiento'], fr: ['poivron'] },
    cycleDays: 10,
    season: [7, 8, 9]
  }),
  P('mushroom', 'Mushrooms', 'produce', 3.6, 'pack', {
    sizes: ['200 g', '400 g'],
    tags: ['fresh', 'vegetable'],
    alias: { hi: ['मशरूम'], es: ['champiñones'], fr: ['champignons'] },
    cycleDays: 10
  }),
  P('lemon', 'Lemons', 'produce', 1.7, 'pack', {
    sizes: ['4 pcs', '500 g'],
    tags: ['fresh', 'fruit', 'citrus'],
    syn: ['lemon', 'lime', 'limes'],
    alias: { hi: ['नींबू', 'nimbu'], es: ['limón', 'limones'], fr: ['citron', 'citrons'] },
    cycleDays: 12
  }),
  P('avocado', 'Avocado', 'produce', 2.5, 'pcs', {
    brands: ['Hass'],
    sizes: ['1 pc', '2 pcs'],
    tags: ['fresh', 'fruit', 'organic'],
    alias: { es: ['aguacate'], fr: ['avocat'] },
    cycleDays: 7
  }),
  P('grapes', 'Grapes', 'produce', 4.2, 'kg', {
    sizes: ['500 g', '1 kg'],
    tags: ['fresh', 'fruit'],
    alias: { hi: ['अंगूर', 'angoor'], es: ['uvas'], fr: ['raisins'] },
    cycleDays: 10,
    season: [8, 9, 10]
  }),
  P('strawberry', 'Strawberries', 'produce', 4.8, 'pack', {
    sizes: ['250 g', '500 g'],
    tags: ['fresh', 'fruit', 'berries'],
    syn: ['strawberry'],
    alias: { es: ['fresas'], fr: ['fraises'] },
    cycleDays: 10,
    season: [4, 5, 6]
  }),
  P('mango', 'Mangoes', 'produce', 3.9, 'kg', {
    brands: ['Alphonso', 'Kesar'],
    sizes: ['1 kg', '2 kg'],
    tags: ['fresh', 'fruit', 'seasonal'],
    syn: ['mango'],
    alias: { hi: ['आम', 'aam'], es: ['mango'], fr: ['mangue'] },
    cycleDays: 10,
    season: [4, 5, 6, 7]
  }),
  P('watermelon', 'Watermelon', 'produce', 5.0, 'pcs', {
    sizes: ['1 pc'],
    tags: ['fresh', 'fruit', 'seasonal'],
    alias: { hi: ['तरबूज', 'tarbooj'], es: ['sandía'], fr: ['pastèque'] },
    cycleDays: 14,
    season: [5, 6, 7, 8]
  }),
  P('coriander', 'Coriander', 'produce', 0.8, 'bunch', {
    sizes: ['1 bunch'],
    tags: ['fresh', 'herbs'],
    syn: ['cilantro', 'fresh coriander'],
    alias: { hi: ['धनिया', 'dhania'], es: ['cilantro'], fr: ['coriandre'] },
    cycleDays: 5
  }),
  P('green_chilli', 'Green Chillies', 'produce', 1.0, 'pack', {
    sizes: ['100 g', '250 g'],
    tags: ['fresh', 'vegetable', 'spicy'],
    syn: ['chilli', 'chillies', 'green chili'],
    alias: { hi: ['हरी मिर्च', 'hari mirch'], es: ['chile verde'], fr: ['piment vert'] },
    cycleDays: 10
  }),
  P('cauliflower', 'Cauliflower', 'produce', 2.3, 'head', {
    sizes: ['1 head'],
    tags: ['fresh', 'vegetable'],
    alias: { hi: ['फूलगोभी', 'gobi'], es: ['coliflor'], fr: ['chou-fleur'] },
    cycleDays: 10,
    season: [10, 11, 12, 1, 2]
  }),
  P('peas', 'Green Peas', 'produce', 2.6, 'pack', {
    sizes: ['250 g', '500 g'],
    tags: ['fresh', 'vegetable'],
    alias: { hi: ['मटर', 'matar'], es: ['guisantes'], fr: ['petits pois'] },
    cycleDays: 12,
    season: [11, 12, 1, 2]
  }),

  // ------------------------------------------------------------------ bakery
  P('bread', 'Bread', 'bakery', 2.5, 'loaf', {
    brands: ['Wonder', 'Harvest Gold', 'Britannia'],
    sizes: ['400 g', '700 g'],
    tags: ['whole wheat', 'white'],
    syn: ['white bread', 'loaf of bread', 'sandwich bread'],
    alias: { hi: ['ब्रेड', 'ब्रैड', 'double roti'], es: ['pan'], fr: ['pain', 'baguette'] },
    cycleDays: 4
  }),
  P('brown_bread', 'Brown Bread', 'bakery', 3.1, 'loaf', {
    brands: ['Harvest Gold', 'Britannia'],
    sizes: ['400 g'],
    tags: ['whole wheat', 'high fibre'],
    syn: ['wheat bread', 'multigrain bread', 'whole wheat bread'],
    alias: { es: ['pan integral'], fr: ['pain complet'] },
    cycleDays: 5
  }),
  P('bagel', 'Bagels', 'bakery', 3.4, 'pack', {
    sizes: ['4 pcs', '6 pcs'],
    tags: ['breakfast'],
    syn: ['bagel'],
    alias: { es: ['bagels'], fr: ['bagels'] },
    cycleDays: 10
  }),
  P('croissant', 'Croissants', 'bakery', 4.0, 'pack', {
    sizes: ['4 pcs'],
    tags: ['breakfast', 'pastry'],
    syn: ['croissant'],
    alias: { es: ['cruasán'], fr: ['croissant', 'croissants'] },
    cycleDays: 12
  }),
  P('tortilla', 'Tortillas', 'bakery', 2.9, 'pack', {
    brands: ['Mission', 'Old El Paso'],
    sizes: ['6 pcs', '10 pcs'],
    tags: ['wraps'],
    syn: ['wraps', 'tortilla', 'roti'],
    alias: { es: ['tortillas'], fr: ['tortillas'] },
    cycleDays: 14
  }),
  P('buns', 'Burger Buns', 'bakery', 2.2, 'pack', {
    sizes: ['4 pcs', '6 pcs'],
    tags: [],
    syn: ['buns', 'hot dog buns', 'burger bun'],
    alias: { es: ['panecillos'], fr: ['pains à burger'] },
    cycleDays: 14
  }),
  P('cake', 'Cake', 'bakery', 12.0, 'pcs', {
    brands: ['Sara Lee'],
    sizes: ['500 g', '1 kg'],
    tags: ['dessert'],
    alias: { hi: ['केक'], es: ['pastel'], fr: ['gâteau'] },
    cycleDays: 30
  }),
  P('muffin', 'Muffins', 'bakery', 4.5, 'pack', {
    sizes: ['4 pcs', '6 pcs'],
    tags: ['breakfast', 'dessert'],
    syn: ['muffin'],
    alias: { es: ['magdalenas'], fr: ['muffins'] },
    cycleDays: 14
  }),

  // ------------------------------------------------------------------- dairy
  P('milk', 'Milk', 'dairy', 3.49, 'bottle', {
    brands: ['Amul', 'Nestlé', 'DairyPure', 'Horizon'],
    sizes: ['500 ml', '1 L', '2 L'],
    tags: ['whole', 'skimmed', 'organic'],
    syn: ['whole milk', 'full cream milk', 'skim milk', 'carton of milk'],
    alias: { hi: ['दूध', 'doodh'], es: ['leche'], fr: ['lait'] },
    cycleDays: 3
  }),
  P('almond_milk', 'Almond Milk', 'dairy', 4.2, 'carton', {
    brands: ['Almond Breeze', 'Silk', 'Alpro'],
    sizes: ['1 L'],
    tags: ['vegan', 'dairy-free', 'unsweetened'],
    syn: ['almond milk'],
    alias: { hi: ['बादाम का दूध'], es: ['leche de almendras'], fr: ['lait d\'amande'] },
    cycleDays: 10
  }),
  P('soy_milk', 'Soy Milk', 'dairy', 3.8, 'carton', {
    brands: ['Silk', 'Alpro'],
    sizes: ['1 L'],
    tags: ['vegan', 'dairy-free'],
    syn: ['soya milk', 'soy milk'],
    alias: { es: ['leche de soja'], fr: ['lait de soja'] },
    cycleDays: 10
  }),
  P('oat_milk', 'Oat Milk', 'dairy', 4.6, 'carton', {
    brands: ['Oatly', 'Alpro'],
    sizes: ['1 L'],
    tags: ['vegan', 'dairy-free'],
    syn: ['oat milk'],
    alias: { es: ['leche de avena'], fr: ['lait d\'avoine'] },
    cycleDays: 10
  }),
  P('butter', 'Butter', 'dairy', 4.1, 'pack', {
    brands: ['Amul', 'Land O\'Lakes', 'Président'],
    sizes: ['100 g', '250 g', '500 g'],
    tags: ['salted', 'unsalted'],
    alias: { hi: ['मक्खन', 'makhan'], es: ['mantequilla'], fr: ['beurre'] },
    cycleDays: 21
  }),
  P('cheese', 'Cheese', 'dairy', 5.5, 'pack', {
    brands: ['Amul', 'Kraft', 'Britannia'],
    sizes: ['200 g', '400 g'],
    tags: ['cheddar', 'mozzarella', 'sliced'],
    syn: ['cheddar', 'mozzarella', 'cheese slices'],
    alias: { hi: ['चीज़', 'पनीर चीज़'], es: ['queso'], fr: ['fromage'] },
    cycleDays: 14
  }),
  P('yogurt', 'Yogurt', 'dairy', 3.3, 'cup', {
    brands: ['Danone', 'Amul', 'Chobani'],
    sizes: ['200 g', '400 g', '1 kg'],
    tags: ['plain', 'flavoured', 'probiotic'],
    syn: ['curd', 'yoghurt'],
    alias: { hi: ['दही', 'dahi'], es: ['yogur'], fr: ['yaourt'] },
    cycleDays: 7
  }),
  P('greek_yogurt', 'Greek Yogurt', 'dairy', 4.9, 'cup', {
    brands: ['Chobani', 'Fage'],
    sizes: ['150 g', '500 g'],
    tags: ['high protein', 'probiotic'],
    syn: ['greek yoghurt'],
    alias: { es: ['yogur griego'], fr: ['yaourt grec'] },
    cycleDays: 7
  }),
  P('paneer', 'Paneer', 'dairy', 4.4, 'pack', {
    brands: ['Amul', 'Mother Dairy'],
    sizes: ['200 g', '500 g'],
    tags: ['fresh', 'high protein'],
    syn: ['cottage cheese'],
    alias: { hi: ['पनीर'], es: ['queso fresco'], fr: ['paneer'] },
    cycleDays: 10
  }),
  P('cream', 'Cream', 'dairy', 3.0, 'pack', {
    brands: ['Amul', 'Nestlé'],
    sizes: ['200 ml', '500 ml'],
    tags: ['fresh', 'whipping'],
    syn: ['fresh cream', 'heavy cream', 'whipping cream'],
    alias: { hi: ['क्रीम', 'malai'], es: ['nata', 'crema'], fr: ['crème'] },
    cycleDays: 21
  }),
  P('eggs', 'Eggs', 'dairy', 3.7, 'dozen', {
    brands: ['Eggland\'s Best', 'Keggs'],
    sizes: ['6 pcs', '12 pcs', '30 pcs'],
    tags: ['free-range', 'organic', 'brown'],
    syn: ['egg', 'a dozen eggs'],
    alias: { hi: ['अंडे', 'anda', 'ande'], es: ['huevos'], fr: ['œufs', 'oeufs'] },
    cycleDays: 7
  }),
  P('ghee', 'Ghee', 'dairy', 8.5, 'jar', {
    brands: ['Amul', 'Patanjali'],
    sizes: ['500 ml', '1 L'],
    tags: ['clarified butter'],
    alias: { hi: ['घी'], es: ['ghee'], fr: ['ghee'] },
    cycleDays: 45
  }),

  // -------------------------------------------------------------------- meat
  P('chicken', 'Chicken', 'meat', 7.9, 'kg', {
    brands: ['Perdue', 'Licious'],
    sizes: ['500 g', '1 kg'],
    tags: ['fresh', 'halal'],
    syn: ['whole chicken', 'chicken curry cut'],
    alias: { hi: ['चिकन', 'murgi'], es: ['pollo'], fr: ['poulet'] },
    cycleDays: 7
  }),
  P('chicken_breast', 'Chicken Breast', 'meat', 9.5, 'kg', {
    brands: ['Perdue', 'Licious'],
    sizes: ['500 g', '1 kg'],
    tags: ['boneless', 'high protein', 'fresh'],
    syn: ['boneless chicken', 'chicken breasts'],
    alias: { es: ['pechuga de pollo'], fr: ['blanc de poulet'] },
    cycleDays: 7
  }),
  P('mutton', 'Mutton', 'meat', 14.0, 'kg', {
    sizes: ['500 g', '1 kg'],
    tags: ['fresh', 'halal'],
    syn: ['lamb', 'goat meat'],
    alias: { hi: ['मटन'], es: ['cordero'], fr: ['agneau'] },
    cycleDays: 14
  }),
  P('bacon', 'Bacon', 'meat', 6.4, 'pack', {
    brands: ['Oscar Mayer'],
    sizes: ['200 g', '400 g'],
    tags: ['smoked'],
    alias: { es: ['tocino'], fr: ['bacon'] },
    cycleDays: 14
  }),
  P('sausage', 'Sausages', 'meat', 5.6, 'pack', {
    brands: ['Johnsonville'],
    sizes: ['250 g', '500 g'],
    tags: [],
    syn: ['sausage', 'hot dogs'],
    alias: { es: ['salchichas'], fr: ['saucisses'] },
    cycleDays: 14
  }),
  P('ground_beef', 'Ground Beef', 'meat', 8.8, 'kg', {
    sizes: ['500 g', '1 kg'],
    tags: ['fresh'],
    syn: ['minced beef', 'beef mince', 'mince'],
    alias: { es: ['carne picada'], fr: ['bœuf haché'] },
    cycleDays: 10
  }),
  P('turkey', 'Turkey', 'meat', 11.0, 'kg', {
    sizes: ['1 kg', '2 kg'],
    tags: ['fresh', 'lean'],
    alias: { es: ['pavo'], fr: ['dinde'] },
    cycleDays: 30,
    season: [11, 12]
  }),

  // ----------------------------------------------------------------- seafood
  P('salmon', 'Salmon', 'seafood', 16.0, 'kg', {
    sizes: ['250 g', '500 g'],
    tags: ['fresh', 'omega-3'],
    syn: ['salmon fillet'],
    alias: { es: ['salmón'], fr: ['saumon'] },
    cycleDays: 14
  }),
  P('shrimp', 'Shrimp', 'seafood', 13.5, 'kg', {
    sizes: ['250 g', '500 g'],
    tags: ['frozen', 'peeled'],
    syn: ['prawns', 'prawn'],
    alias: { hi: ['झींगा'], es: ['camarones', 'gambas'], fr: ['crevettes'] },
    cycleDays: 21
  }),
  P('tuna', 'Canned Tuna', 'seafood', 2.4, 'can', {
    brands: ['John West', 'StarKist'],
    sizes: ['150 g', '185 g'],
    tags: ['canned', 'in brine', 'high protein'],
    syn: ['tuna', 'tuna can'],
    alias: { es: ['atún'], fr: ['thon'] },
    cycleDays: 21
  }),
  P('fish_fillet', 'Fish Fillet', 'seafood', 10.5, 'kg', {
    sizes: ['400 g', '1 kg'],
    tags: ['fresh', 'boneless'],
    syn: ['fish', 'white fish'],
    alias: { hi: ['मछली', 'machli'], es: ['filete de pescado'], fr: ['filet de poisson'] },
    cycleDays: 14
  }),

  // ------------------------------------------------------------------ frozen
  P('frozen_peas', 'Frozen Peas', 'frozen', 2.2, 'pack', {
    brands: ['Birds Eye'],
    sizes: ['500 g', '1 kg'],
    tags: ['frozen', 'vegetable'],
    alias: { es: ['guisantes congelados'], fr: ['petits pois surgelés'] },
    cycleDays: 30
  }),
  P('ice_cream', 'Ice Cream', 'frozen', 5.9, 'tub', {
    brands: ['Ben & Jerry\'s', 'Häagen-Dazs', 'Amul'],
    sizes: ['500 ml', '1 L'],
    tags: ['dessert', 'frozen'],
    alias: { hi: ['आइसक्रीम'], es: ['helado'], fr: ['glace'] },
    cycleDays: 21,
    season: [4, 5, 6, 7, 8]
  }),
  P('frozen_pizza', 'Frozen Pizza', 'frozen', 6.5, 'pcs', {
    brands: ['Dr. Oetker', 'McCain'],
    sizes: ['1 pc'],
    tags: ['frozen', 'ready meal'],
    syn: ['pizza'],
    alias: { es: ['pizza congelada'], fr: ['pizza surgelée'] },
    cycleDays: 21
  }),
  P('frozen_fries', 'Frozen Fries', 'frozen', 3.8, 'pack', {
    brands: ['McCain'],
    sizes: ['500 g', '1 kg'],
    tags: ['frozen'],
    syn: ['french fries', 'fries', 'chips frozen'],
    alias: { es: ['papas fritas congeladas'], fr: ['frites surgelées'] },
    cycleDays: 21
  }),
  P('frozen_berries', 'Frozen Berries', 'frozen', 5.2, 'pack', {
    sizes: ['400 g'],
    tags: ['frozen', 'fruit'],
    alias: { es: ['bayas congeladas'], fr: ['fruits rouges surgelés'] },
    cycleDays: 30
  }),

  // --------------------------------------------------------------- breakfast
  P('cereal', 'Cereal', 'breakfast', 4.7, 'box', {
    brands: ['Kellogg\'s', 'Nestlé', 'General Mills'],
    sizes: ['375 g', '500 g'],
    tags: ['breakfast', 'high fibre'],
    syn: ['breakfast cereal', 'corn flakes', 'cornflakes'],
    alias: { es: ['cereal'], fr: ['céréales'] },
    cycleDays: 21
  }),
  P('oats', 'Oats', 'breakfast', 3.9, 'pack', {
    brands: ['Quaker', 'Saffola'],
    sizes: ['500 g', '1 kg'],
    tags: ['whole grain', 'high fibre'],
    syn: ['oatmeal', 'rolled oats'],
    alias: { hi: ['ओट्स'], es: ['avena'], fr: ['flocons d\'avoine'] },
    cycleDays: 30
  }),
  P('pancake_mix', 'Pancake Mix', 'breakfast', 4.2, 'box', {
    brands: ['Aunt Jemima', 'Betty Crocker'],
    sizes: ['500 g'],
    tags: ['breakfast'],
    syn: ['pancakes'],
    alias: { es: ['mezcla para panqueques'], fr: ['préparation pour crêpes'] },
    cycleDays: 45
  }),
  P('honey', 'Honey', 'breakfast', 6.3, 'jar', {
    brands: ['Dabur', 'Langnese'],
    sizes: ['250 g', '500 g'],
    tags: ['natural', 'organic'],
    alias: { hi: ['शहद', 'shahad'], es: ['miel'], fr: ['miel'] },
    cycleDays: 60
  }),
  P('peanut_butter', 'Peanut Butter', 'breakfast', 5.4, 'jar', {
    brands: ['Skippy', 'Jif', 'Pintola'],
    sizes: ['340 g', '500 g'],
    tags: ['crunchy', 'smooth', 'high protein'],
    alias: { es: ['mantequilla de maní'], fr: ['beurre de cacahuète'] },
    cycleDays: 30
  }),
  P('jam', 'Jam', 'breakfast', 3.6, 'jar', {
    brands: ['Kissan', 'Bonne Maman'],
    sizes: ['200 g', '500 g'],
    tags: ['strawberry', 'mixed fruit'],
    syn: ['jelly', 'marmalade', 'preserve'],
    alias: { hi: ['जैम'], es: ['mermelada'], fr: ['confiture'] },
    cycleDays: 45
  }),

  // ------------------------------------------------------------------ pantry
  P('rice', 'Rice', 'pantry', 6.8, 'bag', {
    brands: ['India Gate', 'Daawat', 'Tilda'],
    sizes: ['1 kg', '5 kg', '10 kg'],
    tags: ['basmati', 'brown', 'long grain'],
    syn: ['basmati rice', 'brown rice', 'white rice'],
    alias: { hi: ['चावल', 'chawal'], es: ['arroz'], fr: ['riz'] },
    cycleDays: 45
  }),
  P('pasta', 'Pasta', 'pantry', 2.3, 'pack', {
    brands: ['Barilla', 'De Cecco'],
    sizes: ['500 g', '1 kg'],
    tags: ['durum wheat', 'whole wheat'],
    syn: ['spaghetti', 'penne', 'macaroni', 'noodles pasta'],
    alias: { es: ['pasta'], fr: ['pâtes'] },
    cycleDays: 21
  }),
  P('flour', 'Flour', 'pantry', 3.1, 'bag', {
    brands: ['Aashirvaad', 'Pillsbury', 'King Arthur'],
    sizes: ['1 kg', '5 kg'],
    tags: ['whole wheat', 'all purpose'],
    syn: ['atta', 'wheat flour', 'all purpose flour'],
    alias: { hi: ['आटा', 'atta'], es: ['harina'], fr: ['farine'] },
    cycleDays: 30
  }),
  P('sugar', 'Sugar', 'pantry', 2.6, 'bag', {
    sizes: ['1 kg', '2 kg'],
    tags: ['white', 'brown'],
    syn: ['brown sugar', 'white sugar'],
    alias: { hi: ['चीनी', 'cheeni'], es: ['azúcar'], fr: ['sucre'] },
    cycleDays: 45
  }),
  P('salt', 'Salt', 'pantry', 1.2, 'pack', {
    brands: ['Tata', 'Morton'],
    sizes: ['500 g', '1 kg'],
    tags: ['iodised', 'sea salt'],
    alias: { hi: ['नमक', 'namak'], es: ['sal'], fr: ['sel'] },
    cycleDays: 90
  }),
  P('lentils', 'Lentils', 'pantry', 3.4, 'bag', {
    sizes: ['500 g', '1 kg'],
    tags: ['high protein', 'organic'],
    syn: ['dal', 'daal', 'toor dal', 'red lentils'],
    alias: { hi: ['दाल', 'dal'], es: ['lentejas'], fr: ['lentilles'] },
    cycleDays: 30
  }),
  P('chickpeas', 'Chickpeas', 'pantry', 2.8, 'can', {
    sizes: ['400 g', '1 kg'],
    tags: ['canned', 'high protein'],
    syn: ['garbanzo beans', 'chana'],
    alias: { hi: ['छोले', 'chana'], es: ['garbanzos'], fr: ['pois chiches'] },
    cycleDays: 30
  }),
  P('olive_oil', 'Olive Oil', 'pantry', 9.2, 'bottle', {
    brands: ['Bertolli', 'Figaro', 'Borges'],
    sizes: ['500 ml', '1 L'],
    tags: ['extra virgin', 'organic'],
    syn: ['extra virgin olive oil'],
    alias: { es: ['aceite de oliva'], fr: ['huile d\'olive'] },
    cycleDays: 60
  }),
  P('cooking_oil', 'Cooking Oil', 'pantry', 5.5, 'bottle', {
    brands: ['Fortune', 'Saffola'],
    sizes: ['1 L', '5 L'],
    tags: ['sunflower', 'refined'],
    syn: ['sunflower oil', 'vegetable oil', 'refined oil'],
    alias: { hi: ['तेल', 'tel'], es: ['aceite'], fr: ['huile'] },
    cycleDays: 45
  }),
  P('black_pepper', 'Black Pepper', 'pantry', 3.2, 'pack', {
    sizes: ['50 g', '100 g'],
    tags: ['spice', 'whole', 'ground'],
    syn: ['pepper', 'peppercorns'],
    alias: { hi: ['काली मिर्च', 'kali mirch'], es: ['pimienta negra'], fr: ['poivre noir'] },
    cycleDays: 90
  }),
  P('turmeric', 'Turmeric', 'pantry', 2.1, 'pack', {
    sizes: ['100 g', '200 g'],
    tags: ['spice', 'organic'],
    alias: { hi: ['हल्दी', 'haldi'], es: ['cúrcuma'], fr: ['curcuma'] },
    cycleDays: 90
  }),
  P('cumin', 'Cumin', 'pantry', 2.4, 'pack', {
    sizes: ['100 g', '200 g'],
    tags: ['spice'],
    syn: ['jeera', 'cumin seeds'],
    alias: { hi: ['जीरा', 'jeera'], es: ['comino'], fr: ['cumin'] },
    cycleDays: 90
  }),
  P('tea', 'Tea', 'pantry', 4.6, 'box', {
    brands: ['Tetley', 'Lipton', 'Taj Mahal', 'Twinings'],
    sizes: ['100 g', '250 g', '500 g'],
    tags: ['green tea', 'black tea', 'organic'],
    syn: ['tea bags', 'green tea', 'chai'],
    alias: { hi: ['चाय', 'chai'], es: ['té'], fr: ['thé'] },
    cycleDays: 30
  }),
  P('coffee', 'Coffee', 'pantry', 8.4, 'pack', {
    brands: ['Nescafé', 'Bru', 'Lavazza', 'Starbucks'],
    sizes: ['100 g', '200 g', '500 g'],
    tags: ['instant', 'ground', 'beans'],
    syn: ['instant coffee', 'ground coffee', 'coffee beans'],
    alias: { hi: ['कॉफ़ी'], es: ['café'], fr: ['café'] },
    cycleDays: 30
  }),
  P('noodles', 'Instant Noodles', 'pantry', 1.1, 'pack', {
    brands: ['Maggi', 'Nissin', 'Top Ramen'],
    sizes: ['70 g', '280 g'],
    tags: ['instant', 'ready meal'],
    syn: ['maggi', 'ramen', 'instant noodles'],
    alias: { hi: ['नूडल्स'], es: ['fideos instantáneos'], fr: ['nouilles instantanées'] },
    cycleDays: 21
  }),
  P('canned_tomatoes', 'Canned Tomatoes', 'pantry', 1.9, 'can', {
    brands: ['Mutti', 'Hunt\'s'],
    sizes: ['400 g'],
    tags: ['canned', 'chopped'],
    syn: ['tinned tomatoes', 'tomato puree'],
    alias: { es: ['tomate en lata'], fr: ['tomates en conserve'] },
    cycleDays: 21
  }),
  P('canned_beans', 'Canned Beans', 'pantry', 1.7, 'can', {
    brands: ['Heinz'],
    sizes: ['400 g'],
    tags: ['canned', 'baked beans', 'high protein'],
    syn: ['baked beans', 'kidney beans', 'rajma'],
    alias: { es: ['frijoles en lata'], fr: ['haricots en conserve'] },
    cycleDays: 21
  }),

  // -------------------------------------------------------------- condiments
  P('ketchup', 'Ketchup', 'condiments', 3.0, 'bottle', {
    brands: ['Heinz', 'Kissan'],
    sizes: ['500 g', '1 kg'],
    tags: ['tomato'],
    syn: ['tomato sauce', 'tomato ketchup'],
    alias: { hi: ['केचप'], es: ['kétchup'], fr: ['ketchup'] },
    cycleDays: 45
  }),
  P('mayonnaise', 'Mayonnaise', 'condiments', 3.9, 'jar', {
    brands: ['Hellmann\'s', 'Veeba'],
    sizes: ['250 g', '500 g'],
    tags: ['eggless'],
    syn: ['mayo'],
    alias: { es: ['mayonesa'], fr: ['mayonnaise'] },
    cycleDays: 45
  }),
  P('mustard', 'Mustard', 'condiments', 2.7, 'jar', {
    brands: ['French\'s', 'Maille'],
    sizes: ['200 g'],
    tags: ['dijon'],
    alias: { es: ['mostaza'], fr: ['moutarde'] },
    cycleDays: 60
  }),
  P('soy_sauce', 'Soy Sauce', 'condiments', 3.3, 'bottle', {
    brands: ['Kikkoman', 'Ching\'s'],
    sizes: ['200 ml', '500 ml'],
    tags: ['dark', 'light'],
    syn: ['soya sauce'],
    alias: { es: ['salsa de soja'], fr: ['sauce soja'] },
    cycleDays: 60
  }),
  P('hot_sauce', 'Hot Sauce', 'condiments', 3.5, 'bottle', {
    brands: ['Tabasco', 'Sriracha'],
    sizes: ['150 ml', '250 ml'],
    tags: ['spicy'],
    syn: ['chilli sauce', 'sriracha', 'tabasco'],
    alias: { es: ['salsa picante'], fr: ['sauce piquante'] },
    cycleDays: 60
  }),
  P('vinegar', 'Vinegar', 'condiments', 2.2, 'bottle', {
    sizes: ['500 ml'],
    tags: ['white', 'apple cider'],
    syn: ['apple cider vinegar', 'white vinegar'],
    alias: { hi: ['सिरका'], es: ['vinagre'], fr: ['vinaigre'] },
    cycleDays: 90
  }),
  P('pickle', 'Pickle', 'condiments', 3.8, 'jar', {
    brands: ['Mother\'s Recipe', 'Priya'],
    sizes: ['300 g', '500 g'],
    tags: ['spicy', 'mango'],
    syn: ['achar', 'pickles'],
    alias: { hi: ['अचार', 'achar'], es: ['encurtidos'], fr: ['cornichons'] },
    cycleDays: 90
  }),

  // ------------------------------------------------------------------ snacks
  P('chips', 'Potato Chips', 'snacks', 2.9, 'pack', {
    brands: ['Lay\'s', 'Pringles', 'Bingo'],
    sizes: ['52 g', '90 g', '150 g'],
    tags: ['salted', 'spicy'],
    syn: ['crisps', 'chips', 'lays'],
    alias: { hi: ['चिप्स'], es: ['papas fritas'], fr: ['chips'] },
    cycleDays: 10
  }),
  P('cookies', 'Cookies', 'snacks', 3.2, 'pack', {
    brands: ['Oreo', 'Britannia', 'Chips Ahoy'],
    sizes: ['150 g', '300 g'],
    tags: ['chocolate', 'butter'],
    syn: ['biscuits', 'biscuit', 'cookie'],
    alias: { hi: ['बिस्किट'], es: ['galletas'], fr: ['biscuits'] },
    cycleDays: 14
  }),
  P('chocolate', 'Chocolate', 'snacks', 2.5, 'bar', {
    brands: ['Cadbury', 'Lindt', 'Hershey\'s', 'Nestlé'],
    sizes: ['50 g', '100 g', '200 g'],
    tags: ['dark', 'milk', 'sugar-free'],
    syn: ['chocolate bar', 'dark chocolate'],
    alias: { hi: ['चॉकलेट'], es: ['chocolate'], fr: ['chocolat'] },
    cycleDays: 10
  }),
  P('popcorn', 'Popcorn', 'snacks', 2.8, 'pack', {
    brands: ['Act II', 'Pop Secret'],
    sizes: ['100 g', '250 g'],
    tags: ['microwave', 'butter'],
    alias: { es: ['palomitas'], fr: ['pop-corn'] },
    cycleDays: 21
  }),
  P('nuts', 'Mixed Nuts', 'snacks', 7.4, 'pack', {
    brands: ['Happilo', 'Planters'],
    sizes: ['200 g', '500 g'],
    tags: ['roasted', 'unsalted', 'high protein'],
    syn: ['almonds', 'cashews', 'dry fruits', 'nuts'],
    alias: { hi: ['मेवे', 'badam'], es: ['frutos secos'], fr: ['fruits secs'] },
    cycleDays: 30
  }),
  P('granola_bar', 'Granola Bars', 'snacks', 4.3, 'pack', {
    brands: ['Nature Valley', 'Yoga Bar'],
    sizes: ['6 pcs', '12 pcs'],
    tags: ['high fibre', 'breakfast'],
    syn: ['protein bar', 'cereal bar', 'granola bar'],
    alias: { es: ['barritas de cereal'], fr: ['barres de céréales'] },
    cycleDays: 21
  }),
  P('crackers', 'Crackers', 'snacks', 2.6, 'pack', {
    brands: ['Ritz', 'Monaco'],
    sizes: ['150 g', '300 g'],
    tags: ['salted'],
    syn: ['salted crackers', 'cracker'],
    alias: { es: ['galletas saladas'], fr: ['crackers'] },
    cycleDays: 21
  }),

  // --------------------------------------------------------------- beverages
  P('water', 'Bottled Water', 'beverages', 0.9, 'bottle', {
    brands: ['Bisleri', 'Aquafina', 'Evian'],
    sizes: ['500 ml', '1 L', '2 L'],
    tags: ['mineral', 'still'],
    syn: ['water', 'mineral water', 'drinking water'],
    alias: { hi: ['पानी', 'paani'], es: ['agua'], fr: ['eau'] },
    cycleDays: 5
  }),
  P('sparkling_water', 'Sparkling Water', 'beverages', 1.6, 'bottle', {
    brands: ['Perrier', 'San Pellegrino'],
    sizes: ['500 ml', '1 L'],
    tags: ['carbonated', 'sugar-free'],
    syn: ['soda water', 'carbonated water', 'club soda'],
    alias: { es: ['agua con gas'], fr: ['eau gazeuse'] },
    cycleDays: 14
  }),
  P('orange_juice', 'Orange Juice', 'beverages', 4.1, 'carton', {
    brands: ['Tropicana', 'Real', 'Minute Maid'],
    sizes: ['1 L'],
    tags: ['no added sugar', 'fresh'],
    syn: ['oj', 'orange juice'],
    alias: { es: ['zumo de naranja'], fr: ['jus d\'orange'] },
    cycleDays: 7
  }),
  P('apple_juice', 'Apple Juice', 'beverages', 3.8, 'carton', {
    brands: ['Tropicana', 'Real'],
    sizes: ['1 L'],
    tags: ['no added sugar'],
    alias: { es: ['zumo de manzana'], fr: ['jus de pomme'] },
    cycleDays: 10
  }),
  P('cola', 'Cola', 'beverages', 1.8, 'bottle', {
    brands: ['Coca-Cola', 'Pepsi', 'Thums Up'],
    sizes: ['500 ml', '1.25 L', '2 L'],
    tags: ['carbonated', 'diet', 'zero sugar'],
    syn: ['coke', 'pepsi', 'soft drink', 'soda'],
    alias: { hi: ['कोल्ड ड्रिंक'], es: ['refresco', 'coca cola'], fr: ['coca', 'soda'] },
    cycleDays: 10
  }),
  P('energy_drink', 'Energy Drink', 'beverages', 2.7, 'can', {
    brands: ['Red Bull', 'Monster', 'Sting'],
    sizes: ['250 ml', '500 ml'],
    tags: ['caffeine', 'sugar-free'],
    alias: { es: ['bebida energética'], fr: ['boisson énergisante'] },
    cycleDays: 14
  }),
  P('beer', 'Beer', 'beverages', 9.5, 'pack', {
    brands: ['Heineken', 'Corona', 'Kingfisher'],
    sizes: ['6 pcs', '12 pcs'],
    tags: ['lager', 'alcohol'],
    alias: { es: ['cerveza'], fr: ['bière'] },
    cycleDays: 14
  }),
  P('wine', 'Wine', 'beverages', 14.0, 'bottle', {
    brands: ['Jacob\'s Creek', 'Sula'],
    sizes: ['750 ml'],
    tags: ['red', 'white', 'alcohol'],
    alias: { es: ['vino'], fr: ['vin'] },
    cycleDays: 30
  }),
  P('coconut_water', 'Coconut Water', 'beverages', 2.4, 'carton', {
    brands: ['Vita Coco', 'Real Activ'],
    sizes: ['330 ml', '1 L'],
    tags: ['natural', 'no added sugar'],
    alias: { hi: ['नारियल पानी'], es: ['agua de coco'], fr: ['eau de coco'] },
    cycleDays: 10,
    season: [4, 5, 6, 7]
  }),

  // --------------------------------------------------------------- household
  P('toilet_paper', 'Toilet Paper', 'household', 7.2, 'pack', {
    brands: ['Charmin', 'Origami'],
    sizes: ['4 rolls', '8 rolls', '12 rolls'],
    tags: ['2-ply', '3-ply'],
    syn: ['toilet rolls', 'tissue roll', 'loo roll'],
    alias: { es: ['papel higiénico'], fr: ['papier toilette'] },
    cycleDays: 30
  }),
  P('paper_towels', 'Paper Towels', 'household', 5.4, 'pack', {
    brands: ['Bounty'],
    sizes: ['2 rolls', '6 rolls'],
    tags: ['absorbent'],
    syn: ['kitchen towel', 'kitchen roll'],
    alias: { es: ['papel de cocina'], fr: ['essuie-tout'] },
    cycleDays: 30
  }),
  P('dish_soap', 'Dish Soap', 'household', 3.4, 'bottle', {
    brands: ['Vim', 'Fairy', 'Dawn'],
    sizes: ['500 ml', '1 L'],
    tags: ['lemon', 'antibacterial'],
    syn: ['dishwashing liquid', 'dish washing soap', 'dishwasher liquid'],
    alias: { es: ['lavavajillas'], fr: ['liquide vaisselle'] },
    cycleDays: 30
  }),
  P('detergent', 'Laundry Detergent', 'household', 11.5, 'pack', {
    brands: ['Ariel', 'Tide', 'Surf Excel'],
    sizes: ['1 kg', '2 kg', '4 kg'],
    tags: ['powder', 'liquid'],
    syn: ['washing powder', 'laundry soap', 'detergent'],
    alias: { hi: ['डिटर्जेंट', 'surf'], es: ['detergente'], fr: ['lessive'] },
    cycleDays: 45
  }),
  P('trash_bags', 'Trash Bags', 'household', 4.8, 'pack', {
    brands: ['Glad', 'Hefty'],
    sizes: ['30 pcs', '60 pcs'],
    tags: ['biodegradable'],
    syn: ['garbage bags', 'bin bags', 'dustbin bags'],
    alias: { es: ['bolsas de basura'], fr: ['sacs poubelle'] },
    cycleDays: 45
  }),
  P('foil', 'Aluminium Foil', 'household', 3.6, 'roll', {
    sizes: ['10 m', '25 m'],
    tags: [],
    syn: ['aluminum foil', 'tin foil', 'silver foil'],
    alias: { es: ['papel de aluminio'], fr: ['papier aluminium'] },
    cycleDays: 90
  }),
  P('sponges', 'Sponges', 'household', 2.4, 'pack', {
    brands: ['Scotch-Brite'],
    sizes: ['3 pcs', '6 pcs'],
    tags: ['scrub'],
    syn: ['scrubber', 'dish sponge', 'sponge'],
    alias: { es: ['esponjas'], fr: ['éponges'] },
    cycleDays: 45
  }),
  P('cleaning_spray', 'Cleaning Spray', 'household', 4.2, 'bottle', {
    brands: ['Lysol', 'Dettol', 'Mr. Muscle'],
    sizes: ['500 ml'],
    tags: ['disinfectant', 'antibacterial'],
    syn: ['surface cleaner', 'all purpose cleaner', 'disinfectant'],
    alias: { es: ['limpiador multiusos'], fr: ['nettoyant multi-usage'] },
    cycleDays: 60
  }),
  P('light_bulbs', 'Light Bulbs', 'household', 6.0, 'pack', {
    brands: ['Philips', 'Syska'],
    sizes: ['2 pcs', '4 pcs'],
    tags: ['LED', 'warm white'],
    syn: ['bulb', 'led bulb', 'light bulb'],
    alias: { es: ['bombillas'], fr: ['ampoules'] },
    cycleDays: 180
  }),

  // ----------------------------------------------------------- personal care
  P('toothpaste', 'Toothpaste', 'personal_care', 3.5, 'tube', {
    brands: ['Colgate', 'Sensodyne', 'Crest', 'Pepsodent'],
    sizes: ['75 ml', '100 ml', '150 ml'],
    tags: ['whitening', 'sensitive', 'fluoride'],
    alias: { hi: ['टूथपेस्ट', 'manjan'], es: ['pasta de dientes'], fr: ['dentifrice'] },
    cycleDays: 45
  }),
  P('toothbrush', 'Toothbrush', 'personal_care', 2.8, 'pcs', {
    brands: ['Oral-B', 'Colgate'],
    sizes: ['1 pc', '3 pcs'],
    tags: ['soft', 'medium'],
    alias: { hi: ['ब्रश'], es: ['cepillo de dientes'], fr: ['brosse à dents'] },
    cycleDays: 90
  }),
  P('shampoo', 'Shampoo', 'personal_care', 6.9, 'bottle', {
    brands: ['Head & Shoulders', 'Dove', 'Pantene', 'L\'Oréal'],
    sizes: ['200 ml', '400 ml', '650 ml'],
    tags: ['anti-dandruff', 'sulphate-free'],
    alias: { hi: ['शैम्पू'], es: ['champú'], fr: ['shampooing'] },
    cycleDays: 45
  }),
  P('conditioner', 'Conditioner', 'personal_care', 6.4, 'bottle', {
    brands: ['Dove', 'Tresemme'],
    sizes: ['200 ml', '400 ml'],
    tags: ['sulphate-free'],
    alias: { es: ['acondicionador'], fr: ['après-shampooing'] },
    cycleDays: 60
  }),
  P('soap', 'Soap', 'personal_care', 1.9, 'bar', {
    brands: ['Dove', 'Lux', 'Dettol'],
    sizes: ['3 pcs', '4 pcs'],
    tags: ['moisturising', 'antibacterial'],
    syn: ['bath soap', 'bar soap'],
    alias: { hi: ['साबुन', 'sabun'], es: ['jabón'], fr: ['savon'] },
    cycleDays: 30
  }),
  P('body_wash', 'Body Wash', 'personal_care', 5.8, 'bottle', {
    brands: ['Nivea', 'Dove'],
    sizes: ['250 ml', '500 ml'],
    tags: ['moisturising'],
    syn: ['shower gel'],
    alias: { es: ['gel de ducha'], fr: ['gel douche'] },
    cycleDays: 45
  }),
  P('deodorant', 'Deodorant', 'personal_care', 4.6, 'bottle', {
    brands: ['Nivea', 'Axe', 'Rexona'],
    sizes: ['150 ml'],
    tags: ['roll-on', 'spray'],
    syn: ['deo', 'antiperspirant'],
    alias: { es: ['desodorante'], fr: ['déodorant'] },
    cycleDays: 45
  }),
  P('razor', 'Razors', 'personal_care', 8.2, 'pack', {
    brands: ['Gillette', 'Schick'],
    sizes: ['3 pcs', '5 pcs'],
    tags: [],
    syn: ['razor', 'shaving razor', 'blades'],
    alias: { es: ['maquinillas de afeitar'], fr: ['rasoirs'] },
    cycleDays: 60
  }),
  P('hand_sanitizer', 'Hand Sanitizer', 'personal_care', 3.1, 'bottle', {
    brands: ['Dettol', 'Purell'],
    sizes: ['100 ml', '500 ml'],
    tags: ['antibacterial', 'alcohol-based'],
    syn: ['sanitizer', 'hand gel'],
    alias: { es: ['gel desinfectante'], fr: ['gel hydroalcoolique'] },
    cycleDays: 60
  }),
  P('face_wash', 'Face Wash', 'personal_care', 5.2, 'tube', {
    brands: ['Cetaphil', 'Himalaya', 'Neutrogena'],
    sizes: ['100 ml', '150 ml'],
    tags: ['oil-free', 'gentle'],
    syn: ['face cleanser', 'facewash'],
    alias: { es: ['limpiador facial'], fr: ['nettoyant visage'] },
    cycleDays: 45
  }),
  P('sunscreen', 'Sunscreen', 'personal_care', 9.8, 'tube', {
    brands: ['Neutrogena', 'La Roche-Posay'],
    sizes: ['50 ml', '100 ml'],
    tags: ['SPF 50', 'water resistant'],
    syn: ['sunblock', 'spf'],
    alias: { es: ['protector solar'], fr: ['crème solaire'] },
    cycleDays: 60,
    season: [4, 5, 6, 7, 8]
  }),
  P('tissues', 'Tissues', 'personal_care', 2.9, 'box', {
    brands: ['Kleenex', 'Origami'],
    sizes: ['100 pcs', '200 pcs'],
    tags: ['soft'],
    syn: ['facial tissues', 'tissue box'],
    alias: { es: ['pañuelos'], fr: ['mouchoirs'] },
    cycleDays: 30
  }),

  // -------------------------------------------------------------------- baby
  P('diapers', 'Diapers', 'baby', 18.5, 'pack', {
    brands: ['Pampers', 'Huggies', 'MamyPoko'],
    sizes: ['S 60 pcs', 'M 56 pcs', 'L 48 pcs'],
    tags: ['overnight', 'sensitive'],
    syn: ['nappies', 'diaper'],
    alias: { es: ['pañales'], fr: ['couches'] },
    cycleDays: 21
  }),
  P('baby_wipes', 'Baby Wipes', 'baby', 4.4, 'pack', {
    brands: ['Pampers', 'Himalaya'],
    sizes: ['72 pcs', '160 pcs'],
    tags: ['fragrance-free', 'sensitive'],
    syn: ['wet wipes', 'wipes'],
    alias: { es: ['toallitas'], fr: ['lingettes'] },
    cycleDays: 21
  }),
  P('baby_formula', 'Baby Formula', 'baby', 24.0, 'tin', {
    brands: ['Enfamil', 'Similac', 'Nestlé NAN'],
    sizes: ['400 g', '800 g'],
    tags: ['stage 1', 'stage 2'],
    syn: ['infant formula', 'formula milk'],
    alias: { es: ['leche de fórmula'], fr: ['lait infantile'] },
    cycleDays: 21
  }),
  P('baby_food', 'Baby Food', 'baby', 3.2, 'jar', {
    brands: ['Gerber', 'Cerelac'],
    sizes: ['120 g', '300 g'],
    tags: ['organic', 'no added sugar'],
    alias: { es: ['papilla'], fr: ['petits pots'] },
    cycleDays: 14
  }),

  // --------------------------------------------------------------------- pet
  P('dog_food', 'Dog Food', 'pet', 22.0, 'bag', {
    brands: ['Pedigree', 'Royal Canin'],
    sizes: ['1.2 kg', '3 kg', '10 kg'],
    tags: ['dry', 'adult', 'puppy'],
    alias: { es: ['comida para perros'], fr: ['nourriture pour chien'] },
    cycleDays: 30
  }),
  P('cat_food', 'Cat Food', 'pet', 19.0, 'bag', {
    brands: ['Whiskas', 'Royal Canin'],
    sizes: ['1 kg', '3 kg'],
    tags: ['dry', 'wet'],
    alias: { es: ['comida para gatos'], fr: ['nourriture pour chat'] },
    cycleDays: 30
  }),
  P('cat_litter', 'Cat Litter', 'pet', 12.5, 'bag', {
    brands: ['Tidy Cats'],
    sizes: ['5 kg', '10 kg'],
    tags: ['clumping', 'odour control'],
    alias: { es: ['arena para gatos'], fr: ['litière pour chat'] },
    cycleDays: 30
  }),
  P('pet_treats', 'Pet Treats', 'pet', 6.8, 'pack', {
    brands: ['Pedigree', 'Dentastix'],
    sizes: ['100 g', '250 g'],
    tags: ['dental'],
    syn: ['dog treats', 'cat treats'],
    alias: { es: ['premios para mascotas'], fr: ['friandises'] },
    cycleDays: 21
  })
];

/** Fast id -> product lookup. */
export const CATALOG_BY_ID = new Map(CATALOG.map((p) => [p.id, p]));

export function getProduct(id) {
  return CATALOG_BY_ID.get(id) || null;
}

/**
 * Product name in the user's language.
 *
 * Aliases are ordered native-script first, so the first entry is the right one
 * to show or speak. Falls back to the canonical English name, which is always
 * better than rendering an id.
 *
 * @param {object|string} product product record or id
 * @param {string} lang
 */
export function localizedName(product, lang = 'en') {
  const record = typeof product === 'string' ? getProduct(product) : product;
  if (!record) return '';
  if (lang === 'en') return record.name;

  const aliases = record.alias[lang];
  return aliases && aliases.length ? aliases[0] : record.name;
}

/** Every distinct brand in the catalog, lowercased, for voice brand matching. */
export const ALL_BRANDS = [...new Set(CATALOG.flatMap((p) => p.brands))];

/** Every distinct tag, used by search to recognise "organic", "gluten-free"... */
export const ALL_TAGS = [...new Set(CATALOG.flatMap((p) => p.tags))];
