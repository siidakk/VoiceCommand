# Voice Command Shopping Assistant

A voice-driven shopping list manager with natural-language understanding, multilingual
input and smart suggestions.

Speak naturally — *"add two litres of milk"*, *"I don't need bread"*,
*"find toothpaste under 200 rupees"* — and the list updates, categorises itself
into supermarket aisles, and tells you what you are probably running low on.

**Built with zero runtime dependencies.** No frameworks, no build step, no npm install.
Speech recognition uses the browser's native Web Speech API; the server is Node's
built-in `http` module; the tests use Node's built-in test runner. `package.json`
lists no dependencies at all.

---

## Live demo

| | |
|---|---|
| **Application URL** | _see [Deployment](#deployment) — the app is one settings toggle away from a live URL_ |
| **Repository** | https://github.com/siidakk/VoiceCommand |

The app is fully functional as a static page (no server required), so GitHub Pages
alone is enough to host it. Deploying the Node server additionally gives you
cross-device list sync.

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
| **Product recommendations** | Learns *your* repurchase interval from purchase history — the median gap between your own purchases — and flags an item when 80% of that interval has elapsed. Surfaced **proactively**, as *"It looks like you're running low on Bread"*, with one tap to add | [`shared/engine/recommender.js`](shared/engine/recommender.js) |
| **Seasonal recommendations** | Month-based seasonality plus a promotions table, ranked so in-season *and* discounted items lead | [`shared/data/seasonal.js`](shared/data/seasonal.js) |
| **Substitutes** | A curated substitution graph with reasons (dairy-free, cheaper, healthier, vegan…), offered automatically when an item is out of stock | [`shared/data/substitutes.js`](shared/data/substitutes.js) |

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
| **Price range filtering** | *"find toothpaste under 200 rupees"*, *"milk between 50 and 100"*, *"find toothpaste under 5 dollars"* |

The catalog is an Indian grocery store, priced in rupees — and priced
*realistically*, not converted: milk is ₹66 a litre, not $3.49 × 83. Prices stay
in rupees in every language, because changing the interface language changes the
words, not the shop.

A spoken price in another currency is converted into rupees before comparison, so
"under 5 dollars" becomes "under ₹415" and is compared against real shelf prices
instead of silently comparing different units. A bare number ("under 200") is
read as rupees.

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
| Search | "find toothpaste under 200 rupees" · "find me organic apples" |
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

**Static hosting** (fastest — gives you a working URL with no account setup):
enable GitHub Pages on this repository, source `main` / `/ (root)`. The root
`index.html` redirects to `web/`, and the app runs entirely client-side with
`localStorage` persistence.

**With the server** (adds cross-device sync): deploy to Render, Railway or Fly.
`render.yaml` is included; the start command is `npm start` and it needs no
environment variables.

Step-by-step instructions for both, including the trade-offs, are in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

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

**Why write Indian prices instead of converting dollar ones?** Because
`$3.49 × 83 = ₹290` for a litre of milk, and the real price is about ₹66. A
converted catalog would look plausible in code and absurd on screen, and every
price-range search would return the wrong thing. The rates that remain exist to
interpret spoken input ("under five dollars" → ₹415), not to re-denominate the
shop.

**Why a JSON file instead of a database?** A shopping list is small, and the
guidelines ask for minimal dependencies. Writes are atomic (temp file + rename) so
a crash cannot corrupt the store, and the server degrades to memory-only rather
than crashing on a read-only filesystem, which several free hosts use.

The 200-word summary requested by the brief is in
[docs/APPROACH.md](docs/APPROACH.md).

---

## License

MIT — see [LICENSE](LICENSE).
