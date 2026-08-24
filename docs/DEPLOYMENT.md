# Deployment

The brief asks for deployment on a reliable platform, naming **Firebase, Google
Cloud and AWS**. All three are covered below. **Firebase Hosting is the
recommended route** — it is the fastest, it is free, and it needs no build step
because this project has none.

## Which route do I need?

The app is fully functional as a static site: speech recognition runs in the
browser, and the list persists in `localStorage`. The Node server is optional —
it adds cross-device sync and nothing else.

| | Static hosting | With the Node server |
|---|---|---|
| Voice, NLP, list, suggestions, search, variants | ✅ | ✅ |
| All four languages | ✅ | ✅ |
| Persistence | This browser | Shared across devices |
| Cost | Free | Free tier / small |
| Setup | ~5 minutes | ~15 minutes, needs billing enabled |

Unless you specifically want a list to follow you from phone to laptop, **use
Firebase Hosting**. The connection badge will read "On this device", which is
the correct state, not a fault.

---

## Option 1 — Firebase Hosting (recommended)

`firebase.json` is already in the repository, so there is nothing to configure.

### One-time setup

Install the CLI (needs Node, which you already have):

```bash
npm install -g firebase-tools
```

Sign in — this opens a browser window:

```bash
firebase login
```

### Create the project

Go to <https://console.firebase.google.com>, click **Add project**, give it a
name such as `voice-shopping-assistant`, and finish the wizard. You can turn
Google Analytics off; it is not needed.

Then, from inside the repository, link the folder to that project:

```bash
firebase use --add
```

Pick your project from the list and accept the default alias. This writes a
`.firebaserc` file, which is git-ignored because it is specific to your account.

> **Do not run `firebase init`.** It would offer to overwrite the `firebase.json`
> already in the repo. `firebase use --add` is all that is needed.

### Deploy

```bash
npm run deploy:firebase
```

That runs `firebase deploy --only hosting`. It prints your live URL, which looks
like:

```
https://voice-shopping-assistant.web.app
```

**Put that URL in the "Application URL" row at the top of [README.md](../README.md).**

Every later deploy is the same one command.

### Why `public` is the repo root

The app ships unbundled — the page in `web/` imports its modules from `shared/`
at runtime. Both directories therefore have to be served as they are, so
`firebase.json` sets `"public": "."` and uses `ignore` to keep `server/`,
`tests/` and `docs/` out of the upload. The root `index.html` redirects to
`/web/`, so the bare URL lands on the app.

---

## Option 2 — Google Cloud Run (adds cross-device sync)

Runs the full Node server. Needs billing enabled on the Google Cloud project
(there is a generous free tier, but the card is required).

```bash
gcloud run deploy voice-shopping-assistant --source . --region asia-south1 --allow-unauthenticated
```

Cloud Run detects Node from `package.json`, runs `npm start`, and provides the
`PORT` environment variable, which the server already reads. No Dockerfile is
needed.

Two things to know:

- **Cloud Run instances are stateless.** The JSON store falls back to
  memory-only, and lists reset when an instance recycles. The browser's
  `localStorage` copy means no user loses their list, but server-side sync is
  best-effort. For durable storage, set `DATA_DIR` to a mounted Cloud Storage
  volume, or swap `server/store.js` for Firestore.
- Pick a region near your users; `asia-south1` is Mumbai.

---

## Option 3 — AWS

**Static (equivalent to the Firebase route):**

```bash
aws s3 sync . s3://YOUR-BUCKET --exclude ".git/*" --exclude "server/*" --exclude "tests/*" --exclude "docs/*" --exclude "node_modules/*"
```

Enable static website hosting on the bucket with `index.html` as the index
document, and put CloudFront in front of it for HTTPS — **which is required**,
because browsers only grant microphone access on secure origins.

**With the server:** AWS App Runner takes the repository directly and runs
`npm start`, in the same shape as Cloud Run. Elastic Beanstalk works too and is
the older equivalent.

---

## Option 4 — GitHub Pages (no CLI at all)

If you would rather click than type: **Settings → Pages → Deploy from a branch →
`main` / `/ (root)` → Save**. The URL becomes
`https://<username>.github.io/VoiceCommand/`.

This is the same static deployment as Firebase, with fewer steps but a less
professional-looking URL.

---

## Environment variables (server routes only)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Listen port. Cloud Run and App Runner set this for you. |
| `HOST` | `0.0.0.0` | Bind address. |
| `DATA_DIR` | `server/.data` | Where `lists.json` is written. Point at a mounted volume for durable storage. |
| `CORS_ORIGIN` | `*` | Restrict the API to one origin if the front end is hosted separately. |

---

## Verifying a deployment

Open the URL and check:

- The page loads and the header shows **$ USD**.
- The suggestions panel shows *"It looks like you're running low on…"* — the
  seeded sample history means this appears immediately, on a first visit.
- Typing `find toothpaste under 5 dollars` lists several tubes at different
  prices, all under $5.
- Tapping the mic prompts for microphone permission.

For a server deployment, also:

```bash
curl https://your-deployment.example.com/api/health
```

`"persistent": false` in the response means the filesystem is read-only and
lists are held in memory — the app still works, but restarts lose server-side
state.

---

## Troubleshooting

**The mic button is greyed out: "Voice not supported here."**
Firefox has no `SpeechRecognition` implementation. Use Chrome, Edge, or Safari.
The text input works everywhere.

**The mic prompts and immediately fails.**
The page is not on HTTPS. Firebase, Cloud Run and CloudFront all provide it;
a bare S3 website endpoint or a plain-HTTP IP does not. (`localhost` counts as
secure, which is why it works in development.)

**Modules fail to load with a MIME type error.**
The host is serving `.js` as `text/plain`. Firebase and GitHub Pages get this
right; a hand-rolled nginx may not. Serve `.js` as `text/javascript`.

**The page loads but nothing renders.**
The URL must end in `/web/`, or the root redirect must have run. The app imports
its modules relatively, so serving `web/index.html` from `/` breaks those paths —
which is exactly why the root `index.html` redirects rather than duplicating the
app.

**`firebase deploy` says "No project active".**
Run `firebase use --add` first and pick your project.

**The badge says "On this device" and I expected sync.**
That is correct for a static deployment: there is no server. Use Cloud Run or
App Runner if you want cross-device sync.
