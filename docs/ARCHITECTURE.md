# Architecture

## The organising idea

One layer — `shared/` — contains all the domain logic and runs unchanged in two
runtimes:

- the **browser** imports it directly as ES modules, no bundler, no build step
- **Node** imports the same files for the server API

Nothing in `shared/` touches `window`, `document`, `fs` or `process`. That is the
constraint that makes the dual use possible, and it is worth the discipline because
of what it buys: **a command executed offline and a command executed against the
server produce the same list and the same spoken reply**, since they are the same
code path. There is no second implementation to drift.

```
┌─────────────────────────── browser ─────────────────────────────┐
│                                                                  │
│   Web Speech API                                                 │
│         │                                                        │
│         ▼                                                        │
│   web/app/speech.js  ── transcript ──▶ web/app/state.js          │
│                                            │        ▲            │
│                                  online?   │        │ notify()   │
│                          ┌─────────────────┴──┐     │            │
│                          │                    │     │            │
│                    api-client.js         (local)    │            │
│                          │                    │     │            │
│                          │                    ▼     │            │
│                          │            ┌── shared/ ──┴──┐         │
│                          │            │ nlp/  engine/  │         │
│                          │            │ data/  i18n/   │         │
│                          │            └────────────────┘         │
│                          │                                       │
│                          │                    web/app/ui/*  ─────┼──▶ DOM
└──────────────────────────┼───────────────────────────────────────┘
                           │ HTTP
┌──────────────────────────┼───────────────────────────────────────┐
│                          ▼                        node server    │
│   server/index.js ──▶ router.js ──▶ server/api/*                 │
│         │                                  │                     │
│         │ static files                     ▼                     │
│         │                            ┌── shared/ ──┐             │
│         ▼                            │ nlp/ engine/│             │
│   web/ + shared/                     └──────┬──────┘             │
│                                             ▼                     │
│                                       server/store.js             │
│                                    (atomic JSON file)             │
└───────────────────────────────────────────────────────────────────┘
```

---

## The NLP pipeline

Six stages, each a pure function in its own module, each separately testable.

```
"Add twenty five apples and remove bread"
        │
        ▼
1. normalize          nlp/normalize.js
   lowercase, fold Latin accents, expand contractions, strip punctuation
   → "add twenty five apples and remove bread"
        │
        ▼
2. digitize numbers   nlp/numbers.js
   word numerals, compound tens, "half a dozen", four languages
   → "add 25 apples and remove bread"
        │
        ▼
3. split clauses      nlp/normalize.js
   splits on a conjunction ONLY when a verb follows
   → ["add 25 apples", "remove bread"]
        │
        ▼   (per clause)
4. match intent       nlp/grammar.js
   template grammar, ranked by literal specificity
   → { intent: 'add', payload: '25 apples' }
        │
        ▼
5. quantity + unit    nlp/numbers.js + nlp/units.js
   → { quantity: 25, unit: null, rest: 'apples' }
        │
        ▼
6. match product      nlp/matcher.js
   exact → despaced → containment → token overlap → edit distance
   → { product: Apples, score: 1.0, confident: true }
```

### Design notes per stage

**normalize** — the one thing this must not do is destroy non-Latin text. Unicode
*marks* (`\p{M}`) are letters' vowel signs in Devanagari; excluding them from the
allowed character class silently reduces `दूध` to `द ध`. Diacritic folding is
therefore scoped to Latin base characters only.

**numbers** — JavaScript's `\b` is defined against the ASCII `\w` class, so
`/\bआधा\b/` can never match at the start of a string. Every multiword numeral
phrase is compiled with explicit Unicode boundaries
(`(?<![\p{L}\p{M}\p{N}])…(?![\p{L}\p{M}\p{N}])`) instead.

**split clauses** — the interesting case is knowing that "add milk **and** remove
bread" is two commands while "add salt **and** pepper" is one. The rule: split on a
conjunction only when the text after it begins with an action verb.

**grammar** — intents are templates compiled to anchored regexes, then sorted by
how much literal (non-placeholder) text they contain. Specificity ordering is what
makes "i do not need bread" beat "i need {x}", with no manual precedence table.
Non-English languages fall back to the English rule set after their own, because
code-switching is normal — an `hi-IN` recogniser routinely returns English words.

**units** — measures (kg, L) and containers (bottle, pack) are distinguished
because only the former describes the product itself. A unit word is only treated
as a unit when it follows a number, precedes "of", or ends the phrase — otherwise
"canned tomatoes" would parse as a quantity of cans.

**matcher** — returns a *score*, not a boolean. Confidence requires both a high
score and a clear margin over the runner-up, so a near-tie becomes a "did you
mean?" rather than a coin flip. An unmatched phrase is not an error: it becomes a
free-text item, because the user must be able to add anything.

---

## The engine

| Module | Responsibility |
|---|---|
| `list-manager.js` | Pure state transitions. Every operation returns a new state; nothing mutates. This is what lets the client keep an undo stack by holding old references. |
| `categorizer.js` | Catalog lookup → strong qualifiers (`dog`, `baby`) → keyword table → nearest-neighbour vote. Returns `other` rather than guessing when confidence is low. |
| `recommender.js` | Five ranked signals: learned repurchase due, frequently bought, pairings, seasonal/sale, cold-start staples. |
| `search.js` | Resolves brand, size and price filters against **variants**, not products, and converts a spoken currency into the dollar base first. Relaxes an unsatisfiable tag filter rather than returning nothing. |
| `executor.js` | The single dispatch point from parsed intent to state change plus spoken reply. Pure — persistence is the caller's job. |

### State shape

```js
{
  items: [{
    id, productId|null, name, category,
    quantity, unit, bought, addedAt, updatedAt, note
  }],
  history: [{ productId, name, category, quantity, at }],
  version: number,
  updatedAt: ISO string
}
```

`history` is deliberately preserved by "clear my list" — the list is what the user
asked to clear; the memory is what makes suggestions good.

### Variants and pricing

Prices are US dollars, and every locale shows dollars — switching the interface
language changes the words, not the shop. The multi-currency machinery exists for
*input*, not output: "under 500 rupees" is converted to $6.02 so it can be
compared with the catalog, and the UI shows the converted ceiling.

A product does not have *a* price. Each carries a **variant table** — one row per
brand-and-size combination, 532 across the catalog — generated from a stated
model rather than hand-written:

```
size    price scales sub-linearly with pack size (bulk is cheaper per unit)
brand   a tier multiplier by position in the product's brand list
anchor  the median size at the first brand costs exactly product.price
```

The anchor is what keeps the model honest: the declared price stays meaningful,
and every other variant is a visible multiple of it.

Filtering resolves against variants, because that is where prices differ. A list
item stores `variantId` and freezes `unitPrice`, so two tubes of toothpaste at
different prices remain two lines whose sum matches the displayed total — pricing
both from the product's headline price was a real bug, and
`lineUnitPrice()` is the single place that decides what a line costs.

`hydrate()` validates every field of anything read from storage, because
`localStorage` and a JSON file are both untrusted input: they may come from an
older version of the app or a hand-edited file.

---

## The server

Node built-ins only.

- **`index.js`** — static file serving plus API routing. Static paths are
  whitelisted to `/web/` and `/shared/`; `server/` and the data file are never
  reachable over HTTP. Path resolution normalises *before* testing the whitelist,
  because normalisation clamps `..` at the root and would otherwise turn
  `/web/../../package.json` into a path that passes a naive prefix check.
- **`router.js`** — a ~70-line router with `:param` support, plus body reading that
  enforces its size limit *as the request streams* rather than after buffering.
- **`store.js`** — one JSON file, one list state per session. Writes go to a temp
  file and are renamed into place, so a crash mid-write cannot truncate the store.
  On a read-only filesystem (several free hosts) it degrades to memory-only and
  logs it, rather than failing to boot.

### API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness plus catalog/NLP diagnostics |
| `GET` | `/api/list` | Read the session's list |
| `PUT` | `/api/list` | Replace it (optimistic-concurrency aware) |
| `DELETE` | `/api/list` | Clear it |
| `POST` | `/api/list/item` | Add one item directly |
| `PUT` | `/api/list/item/:id` | Set quantity / bought |
| `DELETE` | `/api/list/item/:id` | Remove one item |
| `POST` | `/api/command` | Parse and execute an utterance |
| `POST` | `/api/parse` | Parse only, no side effects (debugging) |
| `GET`/`POST` | `/api/search` | Structured / spoken search |
| `GET` | `/api/suggestions` | Ranked suggestions for the session |
| `GET` | `/api/seasonal` | In-season and discounted picks |
| `GET` | `/api/substitutes/:id` | Alternatives for a product |
| `GET` | `/api/catalog` | Catalog metadata for the UI |

Sessions are identified by an `x-session-id` header the client generates and stores
locally. There are no accounts: this identifies a browser, not a person.

---

## The client

`state.js` is the only module that decides *where* a command runs, and the only one
that writes storage. Everything else is either input (`speech.js`), output
(`tts.js`, `ui/*`), or transport (`api-client.js`).

Rendering is a single subscription: anything that changes state calls `notify()`,
and the entire UI re-renders from that state. For a list this size, targeted DOM
patching would be more code and more bugs; a full re-render makes "the screen
always matches the state" true by construction.

All user-derived text is set with `textContent`. There is no path from a spoken
phrase to parsed markup, which is the whole XSS story.

### Offline behaviour

| | Server reachable | Server absent |
|---|---|---|
| Command parsing | Server (`/api/command`) | Browser (`shared/`) |
| List storage | JSON file + `localStorage` | `localStorage` |
| Suggestions | Browser | Browser |
| Cross-device sync | Yes | No |

Suggestions are always computed client-side even when online: the inputs (the list
and its history) are already in the browser, so a round trip would add latency
without adding information.

A transport failure mid-session silently downgrades to local execution rather than
losing the command.
