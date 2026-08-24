# Voice command reference

Everything the assistant understands, in all four languages. The in-app **?**
button shows a shorter, tappable version of this list in the current language.

Commands are matched case-insensitively, punctuation is ignored, and filler words
("um", "well", "just", "please") are stripped before matching.

---

## English

### Adding items

| Say | Result |
|---|---|
| `add milk` | Adds Milk |
| `I need apples` | Adds Apples |
| `I want bananas` / `I want to buy bananas` | Adds Bananas |
| `I would like bread` | Adds Bread |
| `buy eggs` / `get eggs` / `grab eggs` | Adds Eggs |
| `add cheese to my list` | Adds Cheese |
| `put rice on my list` | Adds Rice |
| `we're out of coffee` / `I'm out of coffee` | Adds Coffee |
| `running low on sugar` | Adds Sugar |
| `don't forget the butter` | Adds Butter |
| `pick up tomatoes` / `throw in tomatoes` | Adds Tomatoes |
| `milk` (bare product name) | Adds Milk |

### Quantities and units

| Say | Result |
|---|---|
| `add 3 apples` | Apples × 3 |
| `add twenty five apples` | Apples × 25 |
| `add two litres of milk` | Milk × 2, unit L |
| `add 500 grams of cheese` | Cheese × 500, unit g |
| `add 2 bottles of water` | Bottled Water × 2, unit bottle |
| `buy a dozen eggs` | Eggs × 12 |
| `half a dozen bananas` | Bananas × 6 |
| `a couple of waters` | Bottled Water × 2 |
| `one and a half kilos of rice` | Rice × 1.5, unit kg |
| `change milk to 3` | Sets Milk to 3 |
| `set rice to 2` / `update rice to 2` | Sets Rice to 2 |

Recognised units — **measures**: kg, g, l, ml, lb · **containers**: dozen, bottle,
can, pack, box, bag, jar, carton, loaf, bunch, head, roll, tube, bar, cup, tub,
pieces.

### Removing and completing

| Say | Result |
|---|---|
| `remove milk` / `delete milk` | Removes Milk |
| `remove milk from my list` | Removes Milk |
| `take bread off my list` | Removes Bread |
| `I don't need bread` | Removes Bread |
| `no more chips` / `get rid of chips` | Removes Chips |
| `change milk to 0` | Removes Milk |
| `I got the eggs` / `I bought the eggs` | Marks Eggs bought |
| `mark bread as bought` / `check off bread` | Marks Bread bought |
| `clear my list` / `start over` / `new list` | Empties the list |

### Searching

| Say | Result |
|---|---|
| `find toothpaste` / `search for toothpaste` | Searches |
| `find me organic apples` | Filters by the `organic` tag |
| `show me Colgate toothpaste` | Filters by brand |
| `find toothpaste under 5 dollars` | Price ceiling — lists only the tubes under $5 |
| `find toothpaste under 4` | Bare number is read as dollars |
| `find milk between 2 and 5 dollars` | Price range |
| `find cheese more than 4 dollars` | Price floor |
| `find chocolate around 3 dollars` | ±20% band |
| `find shampoo under 500 rupees` | Converted to dollars, then compared |
| `find 1 litre milk` | Filters to that pack size across brands |
| `find 1 litre milk` | Filters by pack size |
| `find dairy` / `show me frozen` | Browses a category |
| `how much is milk` / `price of milk` | Searches and shows price |

Comparators: under · below · less than · cheaper than · up to · at most ·
within · over · above · more than · at least · between X and Y · from X to Y ·
around · about.

Currencies: dollars/bucks · rupees/rs · euros · pounds. Prices are stored and
shown in dollars; a foreign amount is converted into dollars before comparison,
and a bare number is already dollars.

A price search answers with **variants**, not just products: "find toothpaste
under $5" lists each qualifying brand-and-size at its own price, and each one can
be added separately.

Attribute tags: organic · gluten free · sugar free · no added sugar · vegan ·
dairy free · lactose free · fresh · frozen · whole wheat · high protein ·
high fibre · unsalted · salted · diet · skimmed · low fat · spicy · boneless ·
antibacterial · whitening · sensitive.

### Suggestions and alternatives

| Say | Result |
|---|---|
| `what should I buy` / `what do I need` | Ranked suggestions |
| `any suggestions` / `suggest something` | Ranked suggestions |
| `what's in season` / `what's on sale` | Seasonal panel |
| `what can I use instead of milk` | Substitutes for Milk |
| `alternative to butter` / `substitute for butter` | Substitutes for Butter |

### Reviewing and undoing

| Say | Result |
|---|---|
| `what's on my list` / `read my list` | Speaks the summary |
| `how many items do I have` | Speaks the count |
| `undo` / `go back` | Reverts the last change |
| `help` / `what can I say` | Speaks example commands |

### Compound commands

| Say | Result |
|---|---|
| `add milk and eggs` | Two items, one command |
| `add salt and pepper` | Two items — *not* split as two commands |
| `add 2 litres of milk and 3 apples` | Two items with separate quantities |
| `add milk and remove bread` | Two different commands |
| `add milk then find toothpaste` | Add, then search |

---

## हिन्दी (Hindi)

Both Devanagari and romanised (Hinglish) forms work, and English commands are
also accepted — code-switching is normal in `hi-IN` speech.

| कहें | परिणाम |
|---|---|
| `दूध जोड़ो` / `दूध डालो` / `dudh jodo` | दूध जोड़ता है |
| `मुझे ब्रेड चाहिए` / `mujhe bread chahiye` | ब्रेड जोड़ता है |
| `दो लीटर दूध जोड़ो` | दूध × 2, लीटर |
| `आधा दर्जन अंडे` | अंडे × 6 |
| `डेढ़ किलो चावल` | चावल × 1.5 किलो |
| `तीन सेब जोड़ो` / `teen seb jodo` | सेब × 3 |
| `दूध हटाओ` / `दूध निकालो` / `dudh hatao` | दूध हटाता है |
| `ब्रेड नहीं चाहिए` | ब्रेड हटाता है |
| `सूची साफ़ करो` / `list saaf karo` | सूची खाली करता है |
| `लिस्ट में क्या है` | सूची सुनाता है |
| `टूथपेस्ट 5 डॉलर से कम` | कीमत से खोजता है |
| `शैम्पू 500 रुपये से कम` | कीमत से खोजता है |
| `क्या खरीदूं` / `सुझाव दो` | सुझाव दिखाता है |
| `दूध की जगह क्या` | विकल्प दिखाता है |
| `दूध खरीद लिया` | खरीदा हुआ चिह्नित करता है |
| `मदद` | उदाहरण सुनाता है |

Numbers: एक, दो, तीन, चार, पांच, छह, सात, आठ, नौ, दस, बारह, बीस, सौ ·
ek, do, teen, char, panch, chhe, saat, aath, nau, das · आधा, डेढ़, ढाई, दर्जन.

---

## Español (Spanish)

| Di | Resultado |
|---|---|
| `añade leche` / `agrega leche` | Añade Leche |
| `necesito pan` / `me falta pan` | Añade Pan |
| `quiero comprar huevos` | Añade Huevos |
| `pon arroz en la lista` | Añade Arroz |
| `añade dos litros de leche` | Leche × 2, L |
| `media docena de huevos` | Huevos × 6 |
| `un par de manzanas` | Manzanas × 2 |
| `cambia leche a 3` | Fija Leche en 3 |
| `quita la leche` / `elimina la leche` | Quita Leche |
| `ya no necesito pan` | Quita Pan |
| `borra la lista` / `vacía la lista` | Vacía la lista |
| `qué hay en mi lista` | Lee la lista |
| `busca manzanas` / `encuentra manzanas` | Busca |
| `pasta de dientes menos de 5 euros` | Filtra por precio |
| `qué debería comprar` / `sugerencias` | Sugerencias |
| `alternativa a leche` / `en lugar de leche` | Sustitutos |
| `ya compré huevos` | Marca como comprado |
| `ayuda` | Ejemplos |

Números: uno, dos, tres, cuatro, cinco, seis, siete, ocho, nueve, diez, doce,
veinte, cien · medio, media, docena, par.

---

## Français (French)

| Dites | Résultat |
|---|---|
| `ajoute du lait` / `ajouter du lait` | Ajoute Lait |
| `j'ai besoin de pain` / `il me faut du pain` | Ajoute Pain |
| `je voudrais des œufs` / `je veux des œufs` | Ajoute Œufs |
| `mets du riz sur la liste` | Ajoute Riz |
| `ajoute deux litres de lait` | Lait × 2, L |
| `une douzaine d'œufs` | Œufs × 12 |
| `une demi-douzaine d'œufs` | Œufs × 6 |
| `change lait en 3` | Fixe Lait à 3 |
| `retire le lait` / `supprime le lait` | Retire Lait |
| `je n'ai plus besoin de pain` | Retire Pain |
| `vide la liste` / `efface la liste` | Vide la liste |
| `ma liste` / `lis ma liste` | Lit la liste |
| `trouve des pommes` / `cherche des pommes` | Recherche |
| `dentifrice moins de 5 euros` | Filtre par prix |
| `que dois-je acheter` / `suggestions` | Suggestions |
| `alternative à lait` / `à la place de lait` | Substituts |
| `j'ai acheté des œufs` | Marque comme acheté |
| `aide` | Exemples |

Nombres : un, deux, trois, quatre, cinq, six, sept, huit, neuf, dix, douze,
vingt, cent · demi, douzaine, paire.

---

## Behaviour worth knowing

**Unknown products are still added.** Say "add rice paper" and you get a
free-text item, categorised by keyword (pantry) and marked `custom`. The
assistant never refuses to add something just because it is not in the catalog.

**Uncertain matches are added *and* queried.** "add panir" adds Paneer and shows
a tappable correction chip. One tap either way.

**Out-of-stock items are added with alternatives.** "add strawberries" adds them
and offers Frozen Berries inline.

**Repeat adds merge.** Saying "add milk" twice gives one row with quantity 2, not
two rows — unless the first was already marked bought.

**The list sorts by supermarket aisle**, not by when you added things, so reading
it while shopping follows your walking route.

**Clearing the list keeps your purchase history**, because that history is what
makes the suggestions useful.
