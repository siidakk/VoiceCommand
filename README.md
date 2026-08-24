# Voice Command Shopping Assistant

A voice-driven shopping list manager with natural-language understanding, multilingual
input and smart suggestions.

Speak naturally — *"add two litres of milk"*, *"I don't need bread"*,
*"find toothpaste under $5"* — and the list updates, categorises itself
into supermarket aisles, and tells you what you are probably running low on.

**Built with zero runtime dependencies.** No frameworks, no build step, no npm install.
Speech recognition uses the browser's native Web Speech API; the server is Node's
built-in `http` module; the tests use Node's built-in test runner. `package.json`
lists no dependencies at all.

---

## Live demo

| | |
|---|---|
| **Application URL** | https://voicecommand-dc704.web.app_ |
| **Repository** | https://github.com/siidakk/VoiceCommand |
| **Project Console** | https://console.firebase.google.com/project/voicecommand-dc704/overview |

The app is fully functional as a static page — speech recognition runs in the
browser and the list persists locally — so **Firebase Hosting** is enough to run
all of it. The Node server is optional and adds cross-device sync only.

> **Browser support.** Speech recognition needs Chrome, Edge, or Safari.
> Firefox has no `SpeechRecognition` implementation — the app detects this,
> says so once, and keeps working through the text input.

---

## Quick start

```bash
git clone https://github.com/siidakk/VoiceCommand.git
```

```bash
cd VoiceCommand && npm start
```

Open <http://localhost:3000>. There is nothing to install first — `npm start` runs
`node server/index.js` and the project has no dependencies.

Run the test suite:

```bash
npm test
```

---

## Features

Every feature the brief asked for, and where it lives in the code.

### 1. Voice input

| Requirement | How it works | Code |
|---|---|---|
| **Voice command recognition** | Native `SpeechRecognition` with interim results, hands-free continuous mode, and explicit handling for every error code the API emits | [`web/app/speech.js`](web/app/speech.js) |
| **Natural language processing** | A six-stage pipeline: normalise → digitise numbers → split clauses → match intent → extract quantity/unit → fuzzy-match products | [`shared/nlp/`](shared/nlp/) |
| **Multilingual support** | English, Hindi, Spanish and French — each with its own intent grammar, number words, unit names and product aliases | [`shared/i18n/`](shared/i18n/), [`shared/nlp/grammar.js`](shared/nlp/grammar.js) |

The NLP understands varied phrasing for the same intent. All of these add bananas:

> "add bananas" · "I need bananas" · "I want to buy bananas" ·
> "buy bananas" · "put bananas on my list" · "we're out of bananas" ·
> "don't forget bananas" · "pick up bananas" · "bananas"

### 2. Smart suggestions

| Requirement | How it works | Code |
|---|---|---|
| **Product recommendations** | Learns *your* repurchase interval from purchase history — the median gap between your own purchases — and flags an item at 80% of that interval. Surfaced **proactively** as *"It looks like you're running low on Bread"*, with one tap to add | [`shared/engine/recommender.js`](shared/engine/recommender.js) |
| **Seasonal recommendations** | Month-based seasonality plus a promotions table, ranked so in-season *and* discounted items lead | [`shared/data/seasonal.js`](shared/data/seasonal.js) |
| **Substitutes** | A curated substitution graph with reasons (dairy-free, cheaper, healthier, vegan…). Offered on **three** triggers: when you *mention* a product (say milk, get offered almond milk), when an item is **out of stock**, and when you **ask** ("what can I use instead of milk") | [`shared/data/substitutes.js`](shared/data/substitutes.js) |

> **Predictions are visible on the first visit.** A repurchase predictor has
> nothing to work from until you have shopped with it for a fortnight, so a new
> list is seeded with five weeks of sample history. The suggestions panel says so
> plainly and clears it in one tap; real purchases append to the same history and
> take over naturally.

Suggestions always say **why**: *"You usually rebuy this every 4 days"*,
*"25% off this week"*, *"Goes well with Pasta"*. An unexplained recommendation is
noise — the reason is what makes it actionable.

### 3. Shopping list management

| Requirement | How it works |
|---|---|
| **Add / remove / modify** | By voice or by tap; every voice action has a visible equivalent control |
| **Automatic categorisation** | Catalog lookup first, then a keyword table, then a nearest-neighbour vote among similar products. Items sort into **supermarket walking order**, not insertion order |
| **Quantity management** | Digits and words (`"twenty five"`, `"दो"`, `"media docena"`), with units — measures (kg, L) are distinguished from containers (bottles, packs) |

### 4. Voice-activated search

| Requirement | Example |
|---|---|
| **Item search** | *"find me organic apples"*, *"show me Colgate toothpaste"*, *"find 1 litre milk"* |
| **Price range filtering** | *"find toothpaste under $5"*, *"milk between 2 and 5 dollars"*, *"shampoo under 500 rupees"* |

**One product, many prices.** A shop does not sell "toothpaste" at a single
price — it sells Crest 75 ml at $2.29 and Sensodyne 150 ml at $5.79. Each of the
136 products carries a **variant table**, one row per brand-and-size combination
(532 in all), and filtering happens *per variant*:

```
"find toothpaste under $5"   →  Toothpaste, from $2.29  (8 of 9 options)
                                   Crest · 75 ml       $2.29
                                   Colgate · 75 ml     $2.79
                                   Crest · 100 ml      $2.99
                                   …
                                   Colgate · 150 ml    $4.99
```

The $5.79 tube is excluded rather than the whole product being answered yes-or-no.
Each option is separately addable, and a list line remembers which one you chose,
so two tubes of toothpaste at different prices stay two lines with the right
total.

Prices are US dollars in every language: switching the interface language changes
the words, not the shop. A price spoken in another currency is converted to
dollars before comparison, so *"shampoo under 500 rupees"* works and the UI shows
the converted ceiling so you can see what it understood.

### 5. UI/UX

- **Minimalist** — the list is the page. Everything else is one tap away.
- **Real-time visual feedback** — live interim transcript while you speak, a
  confidence reading, action chips (`+ Milk`, `− Bread`), and the affected row
  flashes so you can see *which* item a command changed.
- **Voice-only** — every action is confirmed aloud, and *"what's on my list"*
  reads the items back ("3 items: 3 kg Apples, Bread, 2 L Milk"), not just a
  count. A list you cannot hear is not a voice interface.
- **Mobile-first** — thumb-reachable mic dock, 60px tap target, single column
  under 900px, safe-area insets for notched phones, and a screen-reader live
  region that works independently of the voice-reply setting.
- **Loading states** — mic states (idle → listening → processing), `aria-busy`
  on panels during work, and a sync indicator.
- **Error handling** — every failure mode has its own message: microphone blocked,
  no microphone, browser unsupported, speech service unreachable, server down.
  Severity is distinguished: a missing server is a warning (the app still works),
  a blocked microphone is an error.

### 6. Hosting

Deployable as a static site, a Node service, or both. See [Deployment](#deployment).

---

## Architecture

```
┌─────────────────────────── browser ────────────────────────────┐
│  Web Speech API ──▶ speech.js ──▶ state.js ──▶ views           │
│                                      │           ▲              │
│                                      │           │              │
│                                      ▼           │              │
│                            ┌──── shared/ ────┐   │              │
│                            │  nlp/  engine/  │───┘              │
│                            │  data/  i18n/   │                  │
│                            └────────┬────────┘                  │
│                                     │  (same modules)           │
└─────────────────────────────────────┼───────────────────────────┘
                                      │
┌─────────────────────── node server ─┼───────────────────────────┐
│  http ──▶ router ──▶ api/ ──────────┘                           │
│                       │                                          │
│                       ▼                                          │
│                    store.js  (atomic JSON file)                  │
└──────────────────────────────────────────────────────────────────┘
```

The central decision: **`shared/` runs unchanged in both runtimes.** The parser,
the catalog, the recommender and the command executor are plain ES modules with no
platform assumptions, imported directly by the browser (no bundler) and by Node.

That gives one property worth the design: **an offline command and an online command
produce identical results**, because they run the same code. Offline is a degraded
*deployment*, not a degraded feature set — the only thing lost without a server is
cross-device sync.

```
shared/
  data/       catalog (136 products), categories, substitutions, seasonality
  nlp/        normalize · numbers · units · grammar · matcher · filters
  engine/     list-manager · categorizer · recommender · search · executor
  i18n/       en · hi · es · fr
server/
  index.js    http server, static files, routing
  store.js    persistence with atomic writes
  api/        list · command · discovery
web/
  app/        speech · tts · api-client · state · ui/
  styles/     one stylesheet
tests/        nlp · engine · i18n · api
```

Full detail in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Voice commands

A quick reference — the complete grammar for all four languages is in
[docs/VOICE-COMMANDS.md](docs/VOICE-COMMANDS.md), and the in-app **?** button
lists tappable examples in the current language.

| Intent | Say |
|---|---|
| Add | "add milk" · "I need apples and bread" · "add 2 bottles of water" |
| Quantity | "add two litres of milk" · "change milk to 3" · "buy a dozen eggs" |
| Remove | "remove milk from my list" · "I don't need bread" · "clear my list" |
| Search | "find toothpaste under $5" · "find me organic apples" · "find 1 litre milk" |
| Suggest | "what should I buy" · "what's on sale" |
| Substitute | "what can I use instead of milk" |
| Review | "what's on my list" · "I got the eggs" |

Compound commands work: *"add milk and remove bread"* runs two actions, while
*"add salt and pepper"* correctly adds two items to one list.

---

## Testing

```bash
npm test
```

151 tests across four suites, using Node's built-in runner — no test framework
dependency.

| Suite | Covers |
|---|---|
| `tests/nlp.test.js` | normalisation, numbers, units, grammar, matching, filters, full pipeline |
| `tests/engine.test.js` | catalog integrity, list operations, categorisation, recommendations, search, executor |
| `tests/i18n.test.js` | locale key parity, placeholder consistency, currency conversion |
| `tests/api.test.js` | every HTTP endpoint against a real server on an ephemeral port |

Several tests are regressions for bugs found during development and are commented
as such — Devanagari being stripped by the normaliser, JavaScript's `\b` not working
on non-Latin scripts, `"salt and pepper"` resolving to the wrong pepper, and a path
traversal that survived a whitelist check performed in the wrong order.

See [docs/TESTING.md](docs/TESTING.md) for the manual voice-testing checklist.

---

## Deployment

**Firebase Hosting** is the recommended route and the one the repo is
configured for. `firebase.json` is committed, so after a one-time
`firebase login` and `firebase use --add`:

```bash
npm run deploy:firebase
```

That prints your live URL. **Google Cloud Run** and **AWS** are also covered, as
is GitHub Pages if you would rather click than type — with the trade-offs of
each — in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Design decisions

A few choices worth explaining, since they were deliberate rather than default:

**Why no dependencies?** The submission guidelines ask to "keep dependencies minimal
and native whenever possible". Taken seriously, that rules out React, Express and a
test framework — and it turns out none of them are needed here. The cost is writing
a small router and a small DOM helper; the benefit is a repo that clones and runs
with no install step and has no supply chain.

**Why the Web Speech API rather than a cloud STT service?** No API key to leak in a
public repository, no free-tier quota to exhaust during review, no audio leaving the
device, and no dependency. The trade-off is browser support, which is handled
explicitly rather than assumed.

**Why a rule-based parser rather than an LLM?** For a fixed command grammar over a
known catalog it is faster (microseconds, offline), free, deterministic, and
testable — 48 parser tests assert exact outputs, which is not possible against a
model. The fuzzy matcher handles the variation that actually matters: misrecognised
product names.

**Why does a low-confidence match still get added?** Because dropping the item is
the worse error. `"panir"` adds Paneer *and* surfaces a one-tap correction chip.
Either outcome costs the user one tap; silently doing nothing costs them a
forgotten item.

**Why generate the variant table instead of hand-writing it?** 532 rows of
brand-and-size pricing written by hand would be 532 chances to fat-finger a
number, and no reviewer could tell a typo from a decision. Instead they are
derived from a stated model — price scales sub-linearly with pack size, brands
carry a tier multiplier — anchored so the median size at the first brand costs
exactly the product's declared price. Every other price is a visible multiple of
that anchor rather than an invented figure.

**Why seed a sample purchase history?** Because the repurchase predictor is the
most interesting thing in the app and it is invisible for the first fortnight of
real use. Seeding it makes the feature demonstrable in the first five seconds;
disclosing it in the panel and clearing it in one tap keeps that honest.

**Why a JSON file instead of a database?** A shopping list is small, and the
guidelines ask for minimal dependencies. Writes are atomic (temp file + rename) so
a crash cannot corrupt the store, and the server degrades to memory-only rather
than crashing on a read-only filesystem, which several free hosts use.

The 200-word summary requested by the brief is in
[docs/APPROACH.md](docs/APPROACH.md).

---

## License

MIT — see [LICENSE](LICENSE).
