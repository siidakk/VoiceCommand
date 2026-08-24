# Testing

## Automated

```bash
npm test
```

151 tests, four suites, Node's built-in runner. No test framework is installed.

```
tests/nlp.test.js      48  normalisation · numbers · units · grammar · matcher · filters · pipeline
tests/engine.test.js   49  catalog integrity · list ops · categorisation · recommender · search · executor
tests/i18n.test.js     24  locale parity · placeholder consistency · currency
tests/api.test.js      30  every endpoint, against a real server on an ephemeral port
```

Run one suite:

```bash
node --test tests/nlp.test.js
```

### What the tests are actually protecting

Several cases are regressions for bugs that occurred during development. They are
commented as such in the source, because a test whose motivation is invisible tends
to get deleted by the next person:

| Test | Bug it prevents |
|---|---|
| `preserves Devanagari vowel signs` | `\p{M}` missing from the allowed character class reduced `दूध` to `द ध`, breaking all Hindi matching |
| `resolves Devanagari quantity phrases` | JavaScript's `\b` is ASCII-only, so `/\bआधा दर्जन\b/` never matched and "आधा दर्जन" parsed as `0.5 12` instead of `6` |
| `"pepper" resolves to the spice` | "peppers" singularises to "pepper", which gave Bell Peppers priority and made "salt and pepper" wrong |
| `extracts a maximum price and leaves a clean query` | Regex alternation matched "dollar" before "dollars", stranding an `s` in the product query |
| `refuses to serve outside the public directories` | Path normalisation clamps `..` at the root, so `/web/../../package.json` passed a whitelist check performed *before* normalising |
| `refuses a stale write instead of clobbering` | `sendError` spread a payload containing `ok: true` *after* its own `ok: false`, making a 409 look like a success |

### Determinism

Anything time-dependent takes an injected clock. The recommender tests build a
synthetic purchase history relative to a fixed `NOW` and assert exact learned
intervals, so "flags a due repurchase" is a real assertion rather than a
tautology.

The API suite boots the actual server into a temporary `DATA_DIR` on port 34871 and
drives it over real HTTP — no mocks, so routing, body parsing, persistence and
error paths are all genuinely exercised.

---

## Manual: voice

Speech recognition needs a microphone and a real browser, so this part is a
checklist rather than an automated suite.

Serve over HTTPS or `localhost` — browsers block microphone access elsewhere.

```bash
npm start
```

Open <http://localhost:3000> in Chrome, Edge, or Safari.

### Core paths

| # | Say | Expect |
|---|---|---|
| 1 | "add milk" | Milk appears under **Dairy & Eggs**, spoken "Added Milk", chip `+ Milk` |
| 2 | "add two litres of milk" | Merges into Milk × 3 (2 added to the existing 1) |
| 3 | "I need apples and bread" | Two items, two chips, both categorised |
| 4 | "add 2 bottles of water" | Bottled Water × 2, unit shown as bottles |
| 5 | "change milk to 5" | Quantity updates, row flashes |
| 6 | "remove bread" | Bread disappears, chip `− Bread` |
| 7 | "remove caviar" | "I could not find Caviar on your list" — no crash |
| 8 | "I got the eggs" | Eggs struck through, moves to the bottom of its group |
| 9 | "what's on my list" | Speaks the item count |
| 10 | "clear my list" | Confirms, empties, **Undo** appears |
| 11 | "undo" | List returns |

### Understanding and recovery

| # | Say | Expect |
|---|---|---|
| 12 | "add panir" | Paneer added **and** a "Did you mean…?" chip if another candidate is close |
| 13 | "add strawberries" | Added, plus a `Frozen Berries →` chip (strawberries are out of stock) |
| 14 | "add quantum widget" | Added as a free-text item marked `custom`, filed under Other |
| 15 | (mumble something) | "Sorry, I did not catch that" plus closest guesses — never a crash |
| 16 | "add milk and remove bread" | Two separate actions |
| 17 | "add salt and pepper" | Two items in one command — **and Black Pepper, not Bell Peppers** |

### Search

| # | Say | Expect |
|---|---|---|
| 18 | "find toothpaste under 5 dollars" | Search tab opens, 1 result, `under $5.00` filter chip |
| 19 | "find me organic apples" | Filtered by the organic tag |
| 20 | "find gluten free bread" | Returns bread **and says the attribute was relaxed** |
| 21 | "find dairy" | Browses the whole dairy category |
| 22 | "what can I use instead of milk" | Almond / Oat / Soy Milk with reasons |

### Multilingual

Switch the language picker, then:

| Language | Say | Expect |
|---|---|---|
| हिन्दी | "दो लीटर दूध जोड़ो" | दूध × 2 लीटर, reply "दूध 2 लीटर जोड़ दिया", prices in ₹ |
| Español | "añade dos litros de leche" | Leche × 2 L, reply "Añadido 2 L de leche", prices in € |
| Français | "ajoute deux litres de lait" | Lait × 2 L, reply "2 L de lait ajouté", prices in € |

The whole UI — headings, categories, product names, units, currency — should switch,
and the existing list should keep its items while renaming them.

### Error handling

| # | Do | Expect |
|---|---|---|
| 23 | Deny the microphone permission | Red banner explaining it, text input still usable, mic greyed |
| 24 | Open in Firefox | Amber banner "no speech recognition", everything else works |
| 25 | Stop the server (`Ctrl-C`) and keep using the app | Badge flips to **Offline**, commands keep working locally |
| 26 | Restart the server and run a command | Badge returns to **Synced** |
| 27 | Enable **Hands-free**, then stay silent | Keeps listening, no error spam from `no-speech` |
| 28 | Switch to another browser tab while listening | Recognition stops (battery and privacy) |

### Mobile

Open the deployed URL on a phone, or use device emulation at 375×812:

- No horizontal scrolling.
- The mic dock is pinned above the home indicator and reachable by thumb.
- One column; the suggestions panel sits below the list.
- Tapping the mic prompts for permission on the first use.
- Spoken confirmations make the app usable without looking at it.

### Accessibility

- Tab through: language, voice toggle, help, tabs, list controls, text input, mic.
- Every icon button has an `aria-label`.
- The live region announces assistant replies even with voice replies muted.
- `prefers-reduced-motion` replaces the mic pulse with a static outline.
- `prefers-color-scheme` switches the palette; both themes are defined explicitly.
