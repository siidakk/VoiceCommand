# Approach

*The brief asked for a write-up of at most 200 words. The summary below is 175.
Everything after it is supporting detail, not part of the count.*

---

## Summary

I read the submission guideline "keep dependencies minimal and native whenever
possible" as a design constraint rather than packaging advice, and built the whole
project with zero runtime dependencies: the browser's Web Speech API for
recognition, Node's `http` for the server, Node's test runner for tests.

The core decision is an isomorphic `shared/` layer — parser, catalog, recommender
and command executor as plain ES modules, imported unbundled by the browser and
directly by Node. Both runtimes execute identical code, so a command run offline
produces the same list and the same spoken reply as one run against the server.
Offline loses sync, not capability.

NLP is a six-stage pipeline: normalise, digitise spoken numbers, split clauses,
match intent against a template grammar, extract quantity and unit, then fuzzy-match
products. Intents are declared as templates and ranked by specificity, which
resolves "I don't need bread" as removal without hand-tuned precedence.

Recommendations learn each household's own repurchase interval from history rather
than assuming a fixed cadence, and every suggestion states its reason — an
unexplained recommendation is noise.

---

## Supporting detail

### Why rule-based NLP

For a fixed command grammar over a known 136-product catalog, a rule-based parser
beats a model on every axis that matters here: it runs in microseconds, works
offline, costs nothing, needs no API key in a public repository, and is
deterministic enough to assert exact outputs in 48 unit tests.

The variation that actually needs tolerance is not phrasing — that is enumerable —
but *misrecognition*: "oat milk" comes back as "oatmilk", "paneer" as "panir",
"cereal" as "serial". That is handled by a scoring matcher (exact → despaced →
containment → token overlap → edit distance) which returns a confidence value
rather than a boolean, so the UI can distinguish "act on this" from "ask about
this".

### Specificity-ranked intent matching

Intents are declared as templates in a small DSL and compiled to anchored regexes:

```
'add {x} to my list'  ->  /^add\s+(?<x>.+?)\s+to\s+my\s+list$/iu
```

Every template is sorted by how much *literal* text it contains, longest first.
That single rule handles the ambiguities that would otherwise need manual
precedence lists: "i do not need bread" beats "i need {x}", and "show me my list"
beats "show me {x}". Adding a language means adding templates, not logic.

### Learned repurchase intervals

The obvious implementation of "you're running low on bread" is a fixed per-product
cadence. That is wrong for real households — some buy bread twice a week, some
monthly. So the recommender computes the median gap between *this user's own*
purchases once there are at least two intervals to learn from, and only falls back
to the catalog's generic `cycleDays` before that. An item surfaces at 80% of its
interval: early enough to be useful, late enough to be right.

### Honest failure

Three places where the app admits uncertainty instead of hiding it:

- A shaky product match is **added anyway** and accompanied by a one-tap
  correction. Dropping the item is the worse error.
- A search whose attribute filter matches nothing **relaxes the filter and says
  so**, rather than returning an empty screen.
- An out-of-stock item is added **with its substitutes offered inline**.

### What I would do next

- Replace the static promotions and stock tables with a retailer feed; they are
  already accessed through functions rather than read directly, so it is a
  one-file change.
- Add speaker-independent product learning: if a user consistently corrects
  "panir" to Paneer, persist that as an alias.
- Server-sent events for genuine multi-device live sync, rather than
  last-writer-wins on push.
