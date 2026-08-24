# Deployment

The app can be hosted two ways. They are not alternatives so much as two points on
a spectrum — the static deployment is the whole app minus cross-device sync.

| | Static hosting | With the Node server |
|---|---|---|
| Voice, NLP, list, suggestions, search | ✅ | ✅ |
| All four languages | ✅ | ✅ |
| Persistence | `localStorage` (per browser) | JSON file (shared across devices) |
| Setup | Toggle a repo setting | Connect a repo to a host |
| Cost | Free | Free tier |

Start with static. Add the server if you want the list to follow you between
phone and laptop.

---

## Option 1 — GitHub Pages (fastest, no account setup)

The repository root contains an `index.html` that redirects to `web/`, and the app
runs entirely in the browser, so Pages needs no build step and no workflow.

1. Push to GitHub on the `main` branch:

```bash
git push -u origin main
```

2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Set branch to **`main`** and folder to **`/ (root)`**, then **Save**.
5. Wait about a minute. Your URL will be:

```
https://<your-username>.github.io/VoiceCommand/
```

The badge in the app header will read **Offline**, which is correct and expected:
there is no server, and the list lives in `localStorage`.

> **HTTPS is required for the microphone.** GitHub Pages serves HTTPS, so this is
> handled. Opening the files directly with `file://` will *not* work — browsers
> block both ES module imports and microphone access on that scheme.

---

## Option 2 — Render (adds cross-device sync)

`render.yaml` is included, so Render can configure itself.

1. Sign in at <https://render.com> with GitHub.
2. **New → Web Service**, and select this repository.
3. Render reads `render.yaml`. Confirm the values:
   - **Environment**: Node
   - **Build command**: *(leave empty — there are no dependencies to install)*
   - **Start command**: `npm start`
   - **Plan**: Free
4. **Create Web Service**.

Your URL will look like `https://voice-command-shopping-assistant.onrender.com`.

Two things to know about the free tier:

- **It sleeps after ~15 minutes idle**, and the next request takes 30–50 seconds to
  wake it. The client handles this: its health probe times out after 3.5 seconds
  and the app starts in offline mode rather than hanging on a blank screen. It
  reconnects on the next command.
- **The filesystem may be ephemeral.** Lists survive restarts only if a disk is
  attached. Without one the store degrades to memory-only and says so in the logs;
  the browser's `localStorage` copy means nothing is lost from the user's view.

### Other Node hosts

The same service runs anywhere that can execute `npm start`:

| Host | Notes |
|---|---|
| **Railway** | Auto-detects Node. Set no variables; it provides `PORT`. |
| **Fly.io** | `fly launch` — accept the Node defaults. Attach a volume for durable lists. |
| **Any VPS** | `node server/index.js` behind nginx or Caddy for TLS. |

**Environment variables** (all optional):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Listen port. Most hosts set this for you. |
| `HOST` | `0.0.0.0` | Bind address. |
| `DATA_DIR` | `server/.data` | Where `lists.json` is written. Point at a mounted volume for durable storage. |
| `CORS_ORIGIN` | `*` | Restrict the API to one origin if you split the front end onto a separate host. |

---

## Option 3 — split hosting

If you want the front end on a CDN and the API elsewhere, host `web/` and
`shared/` as static files and set the API base URL when constructing the client
in [`web/app/main.js`](../web/app/main.js):

```js
const api = new ApiClient({ baseUrl: 'https://your-api-host.example.com' });
```

Then set `CORS_ORIGIN` on the server to the static host's origin.

---

## Verifying a deployment

```bash
curl https://your-deployment.example.com/api/health
```

A healthy response looks like:

```json
{
  "ok": true,
  "status": "healthy",
  "persistent": true,
  "catalog": { "products": 136, "brands": 187, "tags": 131 },
  "nlp": { "matcherIndex": 906, "grammarRules": { "en": 126, "hi": 71, "es": 61, "fr": 55 } },
  "languages": ["en", "hi", "es", "fr"]
}
```

`"persistent": false` means the filesystem is read-only and lists are in memory
only — the app still works, but restarts lose server-side state.

Then open the page and check:

- The header badge reads **Synced** (server) or **Offline** (static). Both are
  valid; it should just match how you deployed.
- Typing `add two litres of milk` into the text box adds Milk × 2 under
  **Dairy & Eggs**.
- Tapping the mic prompts for microphone permission.

---

## Troubleshooting

**The mic button is greyed out and says "Voice not supported here."**
The browser has no `SpeechRecognition`. Firefox does not implement it. Use Chrome,
Edge, or Safari. The text input works in every browser.

**The mic prompts and immediately fails.**
The page is not on HTTPS. Browsers only grant microphone access on secure origins
(`localhost` counts as secure; a plain-HTTP IP address does not).

**Modules fail to load with a MIME type error.**
The host is serving `.js` as `text/plain`. GitHub Pages and Render both get this
right; a misconfigured nginx may not. Ensure `.js` is served as
`text/javascript`.

**The page loads but nothing renders.**
Check that the URL ends in `/web/` (or that the root redirect ran). The app imports
its modules relatively, so serving `web/index.html` from `/` breaks those paths —
this is exactly why the root `index.html` redirects instead of duplicating the app.

**First request after idle hangs.**
A sleeping free-tier instance. Wait ~40 seconds, or just use the app — it starts
offline and reconnects automatically.
